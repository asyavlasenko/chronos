import {
  EVENT_TYPES,
  INVITE_KINDS,
  INVITE_STATUSES,
  PARTICIPANT_STATUSES,
  ROLES,
} from '../../constants/index.js';
import { assertCalendarRole, findMember } from '../../middlewares/calendarAccess.js';
import ApiError from '../../utils/ApiError.js';
import Calendar from '../calendars/calendar.model.js';
import Invite from '../invites/invite.model.js';
import { createInvite } from '../invites/invite.service.js';
import User from '../users/user.model.js';
import Event, { TYPE_RULE_MESSAGES, typeRuleViolations } from './event.model.js';
import {
  isRescheduled,
  notifyEventCancelled,
  notifyEventChanged,
  scheduleSnapshot,
} from './event.notifications.js';
import { EVENT_POPULATE, serializeInvitedEvent, serializeOwnEvent } from './event.serializer.js';

const LIST_LIMIT = 2000;
const MAX_PARTICIPANTS = 20;
const MINUTE_MS = 60 * 1000;
const SOURCE_CALENDAR_POPULATE = { path: 'calendar', select: 'name color' };

const idOf = (value) => String(value?._id ?? value);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validationError = (details) => new ApiError(400, 'Помилка валідації', details);

const isParticipant = (participant, user) =>
  participant.email === user.email || idOf(participant.user) === user.id;

async function findEvent(id) {
  const event = await Event.findById(id);
  if (!event) throw new ApiError(404, 'Подію не знайдено');
  return event;
}

async function assertCanModify(user, event) {
  const { membership } = await assertCalendarRole(user.id, event.calendar, ROLES.EDITOR);
  const isCreator = idOf(event.creator) === user.id;

  if (membership.role !== ROLES.OWNER && !isCreator) {
    throw new ApiError(403, 'Змінювати можна лише власні події');
  }
}

async function present(event) {
  await event.populate(EVENT_POPULATE);
  return serializeOwnEvent(event);
}

function applyDefaultEnd(event, user) {
  if (event.type === EVENT_TYPES.ARRANGEMENT && event.startAt && !event.endAt) {
    event.set(
      'endAt',
      new Date(event.startAt.getTime() + user.defaultArrangementDuration * MINUTE_MS),
    );
  }
}

async function addParticipants(event, emails, user) {
  const known = new Set(event.participants.map((participant) => participant.email));
  const added = [...new Set(emails)].filter((email) => email !== user.email && !known.has(email));

  const users = await User.find({ email: { $in: added } }).select('email');
  const userIdByEmail = new Map(users.map((found) => [found.email, found._id]));

  added.forEach((email) => {
    event.participants.push({
      email,
      user: userIdByEmail.get(email) ?? null,
      status: PARTICIPANT_STATUSES.PENDING,
    });
  });

  return added;
}

function removeParticipants(event, keptEmails) {
  const removed = event.participants
    .filter((participant) => !keptEmails.includes(participant.email))
    .map((participant) => participant.email);

  event.set(
    'participants',
    event.participants.filter((participant) => keptEmails.includes(participant.email)),
  );

  return removed;
}

const sendInvites = (event, user, emails) =>
  Promise.all(
    emails.map((email) =>
      createInvite({ kind: INVITE_KINDS.EVENT, email, invitedBy: user, event }),
    ),
  );

const findSorted = (conditions) =>
  Event.find({ $and: conditions })
    .sort({ startAt: 1, _id: 1 })
    .limit(LIST_LIMIT)
    .populate([...EVENT_POPULATE, SOURCE_CALENDAR_POPULATE]);

export async function list(user, { from, to, calendars, types, q, includeHidden }) {
  const memberships = await Calendar.find({ 'members.user': user._id }).select(
    'owner isMain members',
  );
  const memberIds = new Set(memberships.map((calendar) => calendar.id));
  const main = memberships.find((calendar) => calendar.isMain && idOf(calendar.owner) === user.id);

  const visible = memberships.filter((calendar) =>
    calendars
      ? calendars.includes(calendar.id)
      : includeHidden || !findMember(calendar, user.id).isHidden,
  );

  const scopes = [{ calendar: { $in: visible.map((calendar) => calendar._id) } }];
  if (main && (!calendars || calendars.includes(main.id))) {
    scopes.push({
      calendar: { $nin: memberships.map((calendar) => calendar._id) },
      participants: {
        $elemMatch: {
          status: PARTICIPANT_STATUSES.ACCEPTED,
          $or: [{ user: user._id }, { email: user.email }],
        },
      },
    });
  }

  const conditions = [{ $or: scopes }];
  if (from) {
    conditions.push(
      { isFloating: { $ne: true } },
      { startAt: { $lt: to } },
      { $or: [{ endAt: { $gt: from } }, { endAt: null, startAt: { $gte: from } }] },
    );
  }
  if (types) conditions.push({ type: { $in: types } });
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    conditions.push({ $or: [{ title: pattern }, { description: pattern }] });
  }

  const events = await findSorted(conditions);

  return events.map((event) =>
    memberIds.has(idOf(event.calendar))
      ? serializeOwnEvent(event)
      : serializeInvitedEvent(event, event.calendar, main?.id),
  );
}

export async function create(user, { participants: emails = [], ...fields }) {
  await assertCalendarRole(user.id, fields.calendar, ROLES.EDITOR);

  const event = new Event({ ...fields, creator: user._id });
  applyDefaultEnd(event, user);
  const invited = await addParticipants(event, emails, user);

  await event.save();
  await sendInvites(event, user, invited);

  return present(event);
}

export async function getById(user, id) {
  const event = await findEvent(id);
  await event.populate(EVENT_POPULATE);

  const calendar = await Calendar.findById(event.calendar).select('name color members');
  if (calendar && findMember(calendar, user.id)) return serializeOwnEvent(event);

  const participant = event.participants.find((item) => isParticipant(item, user));
  if (!participant) throw new ApiError(403, 'У тебе немає доступу до цієї події');

  const main =
    participant.status === PARTICIPANT_STATUSES.ACCEPTED
      ? await Calendar.findOne({ owner: user._id, isMain: true }).select('_id')
      : null;

  return serializeInvitedEvent(event, calendar, main?.id);
}

export async function update(user, id, { participants: emails, isCompleted, calendar, ...fields }) {
  const event = await findEvent(id);
  await assertCanModify(user, event);

  if (calendar && calendar !== idOf(event.calendar)) {
    await assertCalendarRole(user.id, calendar, ROLES.EDITOR);
    event.set('calendar', calendar);
  }

  const before = scheduleSnapshot(event);
  event.set(fields);
  applyDefaultEnd(event, user);

  const violations = typeRuleViolations(event);
  if (fields.isFloating === false && event.isModified('isFloating') && !fields.startAt) {
    violations.push({ field: 'startAt', message: TYPE_RULE_MESSAGES.scheduleNeedsDate });
  }
  if (isCompleted && event.type !== EVENT_TYPES.TASK) {
    violations.push({ field: 'isCompleted', message: TYPE_RULE_MESSAGES.completedTaskOnly });
  }
  if (violations.length > 0) throw validationError(violations);

  if (isCompleted !== undefined && isCompleted !== event.isCompleted) {
    event.set({ isCompleted, completedAt: isCompleted ? new Date() : null });
  }

  const removed = emails ? removeParticipants(event, emails) : [];
  const added = emails ? await addParticipants(event, emails, user) : [];
  if (removed.length > 0 || added.length > 0) event.increment();

  await event.save();
  if (removed.length > 0) {
    await Invite.deleteMany({
      kind: INVITE_KINDS.EVENT,
      event: event._id,
      email: { $in: removed },
      status: INVITE_STATUSES.PENDING,
    });
  }
  await sendInvites(event, user, added);
  if (isRescheduled(before, event)) await notifyEventChanged(event, user, added);

  return present(event);
}

export async function remove(user, id) {
  const event = await findEvent(id);
  await assertCanModify(user, event);

  await Invite.deleteMany({ kind: INVITE_KINDS.EVENT, event: event._id });
  await event.deleteOne();
  await notifyEventCancelled(event, user);
}

export async function invite(user, id, emails) {
  const event = await findEvent(id);
  await assertCanModify(user, event);

  const added = await addParticipants(event, emails, user);
  if (event.participants.length > MAX_PARTICIPANTS) {
    throw validationError([
      { field: 'emails', message: `У події може бути не більше ${MAX_PARTICIPANTS} учасників` },
    ]);
  }

  if (added.length > 0) event.increment();
  await event.save();
  await sendInvites(event, user, added);

  return present(event);
}
