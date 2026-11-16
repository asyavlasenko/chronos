import env from '../../config/env.js';
import {
  INVITE_KINDS,
  INVITE_STATUSES,
  INVITE_TTL_DAYS,
  PARTICIPANT_STATUSES,
  ROLES,
} from '../../constants/index.js';
import ApiError from '../../utils/ApiError.js';
import { sendInviteEmail } from '../../utils/mailer.js';
import { randomToken } from '../../utils/tokens.js';
import Calendar from '../calendars/calendar.model.js';
import Event from '../events/event.model.js';
import Invite from './invite.model.js';
import { INVITE_POPULATE } from './invite.serializer.js';
import { isInviteToken } from './invite.validation.js';

const TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

const NOT_FOUND = 'Запрошення не знайдено';
const TARGET_GONE = 'Подію або календар із цього запрошення вже видалено';
const WRONG_EMAIL = 'Це запрошення надіслано на інший email';
const ALREADY_PROCESSED = 'Запрошення вже опрацьовано';
const EXPIRED = 'Термін дії запрошення минув';

const formatWhen = (event, timeZone) =>
  event.startAt
    ? new Intl.DateTimeFormat('uk-UA', {
        timeZone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: event.allDay ? undefined : '2-digit',
        minute: event.allDay ? undefined : '2-digit',
      }).format(event.startAt)
    : null;

export async function createInvite({
  kind,
  email,
  invitedBy,
  event = null,
  calendar = null,
  role = ROLES.VIEWER,
}) {
  const isEvent = kind === INVITE_KINDS.EVENT;
  const target = isEvent ? { event: event._id } : { calendar: calendar._id };

  let invite = await Invite.findOne({ kind, email, status: INVITE_STATUSES.PENDING, ...target });
  if (invite) {
    invite.invitedBy = invitedBy._id;
    invite.role = role;
    invite.expiresAt = new Date(Date.now() + TTL_MS);
    await invite.save();
  } else {
    invite = await Invite.create({
      kind,
      email,
      token: randomToken(),
      invitedBy: invitedBy._id,
      role,
      ...target,
    });
  }

  try {
    await sendInviteEmail({
      to: email,
      inviterName: invitedBy.name,
      kind,
      title: isEvent ? event.title : calendar.name,
      when: isEvent ? formatWhen(event, invitedBy.timezone) : null,
      acceptUrl: `${env.clientUrl}/invite/${invite.token}`,
    });
  } catch (err) {
    console.error(`[mail] Не вдалося надіслати запрошення на ${email}: ${err.message}`);
  }

  return invite;
}

const hasTarget = (invite) =>
  invite.kind === INVITE_KINDS.EVENT ? Boolean(invite.event?.calendar) : Boolean(invite.calendar);

const findByToken = (token) =>
  isInviteToken(token) ? Invite.findOne({ token }).populate(INVITE_POPULATE) : null;

export async function listPendingInvites(email) {
  const invites = await Invite.find({
    email,
    status: INVITE_STATUSES.PENDING,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1, _id: -1 })
    .populate(INVITE_POPULATE);

  return invites.filter(hasTarget);
}

export async function getInviteByToken(token) {
  const invite = await findByToken(token);
  if (!invite) throw new ApiError(404, NOT_FOUND);
  if (!hasTarget(invite)) throw new ApiError(404, TARGET_GONE);

  return invite;
}

async function findPendingFor(token, user) {
  const invite = await findByToken(token);
  if (!invite) throw new ApiError(404, NOT_FOUND);
  if (invite.email !== user.email) throw new ApiError(403, WRONG_EMAIL);
  if (invite.status === INVITE_STATUSES.EXPIRED) throw new ApiError(410, EXPIRED);
  if (invite.status !== INVITE_STATUSES.PENDING) throw new ApiError(409, ALREADY_PROCESSED);

  if (invite.expiresAt <= new Date()) {
    await Invite.updateOne(
      { _id: invite._id, status: INVITE_STATUSES.PENDING },
      { $set: { status: INVITE_STATUSES.EXPIRED } },
    );
    throw new ApiError(410, EXPIRED);
  }

  if (!hasTarget(invite)) throw new ApiError(404, TARGET_GONE);

  return invite;
}

async function closeInvite(invite, status, respondedAt) {
  const closed = await Invite.findOneAndUpdate(
    { _id: invite._id, status: INVITE_STATUSES.PENDING },
    { $set: { status, respondedAt } },
    { new: true },
  ).populate(INVITE_POPULATE);
  if (!closed) throw new ApiError(409, ALREADY_PROCESSED);

  return closed;
}

const MEMBER_COLORS = ['purple', 'green', 'blue', 'pink', 'orange', 'graphite'];

function pickMemberColor(calendar) {
  const taken = new Set([calendar.color, ...calendar.members.map((m) => m.color)]);
  const free = MEMBER_COLORS.find((color) => !taken.has(color));
  return free || MEMBER_COLORS[calendar.members.length % MEMBER_COLORS.length];
}

const joinCalendar = (invite, user, joinedAt) =>
  Calendar.updateOne(
    { _id: invite.calendar._id, 'members.user': { $ne: user._id } },
    {
      $push: {
        members: {
          user: user._id,
          role: invite.role,
          color: pickMemberColor(invite.calendar),
          isHidden: false,
          joinedAt,
        },
      },
    },
  );

async function acceptEvent(invite, user, respondedAt) {
  const { email } = invite;
  const status = PARTICIPANT_STATUSES.ACCEPTED;

  const { matchedCount } = await Event.updateOne(
    { _id: invite.event._id, 'participants.email': email },
    {
      $set: {
        'participants.$.user': user._id,
        'participants.$.status': status,
        'participants.$.respondedAt': respondedAt,
      },
    },
  );
  if (matchedCount > 0) return;

  await Event.updateOne(
    { _id: invite.event._id, 'participants.email': { $ne: email } },
    {
      $push: {
        participants: {
          user: user._id,
          email,
          status,
          invitedAt: invite.createdAt,
          respondedAt,
        },
      },
    },
  );
}

const declineEvent = (invite, respondedAt) =>
  Event.updateOne(
    { _id: invite.event._id, 'participants.email': invite.email },
    {
      $set: {
        'participants.$.status': PARTICIPANT_STATUSES.DECLINED,
        'participants.$.respondedAt': respondedAt,
      },
    },
  );

export async function acceptInvite(token, user) {
  const invite = await findPendingFor(token, user);
  const now = new Date();

  if (invite.kind === INVITE_KINDS.EVENT) {
    await acceptEvent(invite, user, now);
  } else {
    await joinCalendar(invite, user, now);
  }

  return closeInvite(invite, INVITE_STATUSES.ACCEPTED, now);
}

export async function declineInvite(token, user) {
  const invite = await findPendingFor(token, user);
  const now = new Date();

  if (invite.kind === INVITE_KINDS.EVENT) await declineEvent(invite, now);

  return closeInvite(invite, INVITE_STATUSES.DECLINED, now);
}
