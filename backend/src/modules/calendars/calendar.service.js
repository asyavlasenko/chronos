import { INVITE_KINDS, INVITE_STATUSES, ROLES } from '../../constants/index.js';
import { findMember } from '../../middlewares/calendarAccess.js';
import ApiError from '../../utils/ApiError.js';
import Event from '../events/event.model.js';
import Invite from '../invites/invite.model.js';
import { INVITE_POPULATE, serializeInvite } from '../invites/invite.serializer.js';
import { createInvite } from '../invites/invite.service.js';
import User from '../users/user.model.js';
import Calendar from './calendar.model.js';
import { MEMBER_POPULATE, serializeCalendar } from './calendar.serializer.js';

const isOwner = (calendar, userId) => findMember(calendar, userId)?.role === ROLES.OWNER;

async function countEvents(calendarIds) {
  const rows = await Event.aggregate([
    { $match: { calendar: { $in: calendarIds } } },
    { $group: { _id: '$calendar', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

async function findPendingInvites(calendarIds) {
  const byCalendar = new Map();
  if (calendarIds.length === 0) return byCalendar;

  const invites = await Invite.find({
    kind: INVITE_KINDS.CALENDAR,
    calendar: { $in: calendarIds },
    status: INVITE_STATUSES.PENDING,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: 1 });

  invites.forEach((invite) => {
    const key = String(invite.calendar);
    byCalendar.set(key, [...(byCalendar.get(key) || []), invite]);
  });
  return byCalendar;
}

async function serializeMany(calendars, userId) {
  const ids = calendars.map((calendar) => calendar._id);
  const ownedIds = calendars
    .filter((calendar) => isOwner(calendar, userId))
    .map((calendar) => calendar._id);

  const [counts, invites] = await Promise.all([countEvents(ids), findPendingInvites(ownedIds)]);

  return calendars.map((calendar) =>
    serializeCalendar(calendar, userId, {
      eventsCount: counts.get(String(calendar._id)) || 0,
      pendingInvites: invites.get(String(calendar._id)) || [],
    }),
  );
}

async function serializeOne(calendar, userId) {
  await calendar.populate(MEMBER_POPULATE);
  const [serialized] = await serializeMany([calendar], userId);
  return serialized;
}

async function setMemberFields(calendar, memberId, changes) {
  const fields = Object.fromEntries(
    Object.entries(changes).map(([key, value]) => [`members.$.${key}`, value]),
  );
  const updated = await Calendar.findOneAndUpdate(
    { _id: calendar._id, 'members.user': memberId },
    { $set: fields },
    { new: true },
  );
  if (!updated) throw new ApiError(404, 'Учасника не знайдено');
  return updated;
}

export async function listForUser(userId) {
  const calendars = await Calendar.find({ 'members.user': userId })
    .sort({ createdAt: 1, _id: 1 })
    .populate(MEMBER_POPULATE);

  const isMyMain = (calendar) => calendar.isMain && String(calendar.owner) === String(userId);
  calendars.sort((a, b) => Number(isMyMain(b)) - Number(isMyMain(a)));

  return serializeMany(calendars, userId);
}

export async function create(userId, data) {
  const calendar = await Calendar.create({
    ...data,
    owner: userId,
    isMain: false,
    members: [{ user: userId, role: ROLES.OWNER }],
  });
  await calendar.populate(MEMBER_POPULATE);
  return serializeCalendar(calendar, userId);
}

export function getById(calendar, userId) {
  return serializeOne(calendar, userId);
}

export async function update(calendar, userId, changes) {
  calendar.set(changes);
  await calendar.save();
  return serializeOne(calendar, userId);
}

export async function remove(calendar) {
  if (calendar.isMain) throw new ApiError(403, 'Головний календар не можна видалити');

  const eventIds = await Event.distinct('_id', { calendar: calendar._id });
  await Invite.deleteMany({ $or: [{ calendar: calendar._id }, { event: { $in: eventIds } }] });
  await Event.deleteMany({ calendar: calendar._id });
  await calendar.deleteOne();
}

export async function updateMembership(calendar, userId, changes) {
  if (changes.isHidden && calendar.isMain) {
    throw new ApiError(403, 'Головний календар не можна сховати');
  }

  const updated = await setMemberFields(calendar, userId, changes);
  return serializeOne(updated, userId);
}

export async function share(calendar, inviter, { email, role }) {
  if (calendar.isMain) throw new ApiError(403, 'Головний календар не можна зробити спільним');

  if (email === inviter.email) {
    throw new ApiError(409, 'Не можна запросити себе', [
      { field: 'email', message: 'Це твій email, ти вже власник календаря' },
    ]);
  }

  const invitee = await User.findOne({ email }).select('_id');
  if (invitee && findMember(calendar, invitee._id)) {
    throw new ApiError(409, 'Цей користувач уже має доступ до календаря', [
      { field: 'email', message: 'Цей користувач уже є учасником календаря' },
    ]);
  }

  const invite = await createInvite({
    kind: INVITE_KINDS.CALENDAR,
    email,
    invitedBy: inviter,
    calendar,
    role,
  });
  await invite.populate(INVITE_POPULATE);
  return serializeInvite(invite);
}

export async function updateMemberRole(calendar, userId, memberId, role) {
  const member = findMember(calendar, memberId);
  if (!member) throw new ApiError(404, 'Учасника не знайдено');
  if (member.role === ROLES.OWNER) throw new ApiError(403, 'Роль власника змінити не можна');

  const updated = await setMemberFields(calendar, memberId, { role });
  return serializeOne(updated, userId);
}

export async function removeMember(calendar, userId, memberId) {
  const isSelf = String(memberId) === String(userId);
  if (!isSelf && !isOwner(calendar, userId)) {
    throw new ApiError(403, 'Прибирати інших учасників може лише власник календаря');
  }

  const member = findMember(calendar, memberId);
  if (!member) throw new ApiError(404, 'Учасника не знайдено');
  if (member.role === ROLES.OWNER) {
    throw new ApiError(403, 'Власник не може вийти з власного календаря');
  }

  await Calendar.updateOne({ _id: calendar._id }, { $pull: { members: { user: member.user } } });
}

export async function cancelInvite(calendar, inviteId) {
  const { deletedCount } = await Invite.deleteOne({
    _id: inviteId,
    kind: INVITE_KINDS.CALENDAR,
    calendar: calendar._id,
    status: INVITE_STATUSES.PENDING,
  });
  if (deletedCount === 0) throw new ApiError(404, 'Запрошення не знайдено');
}
