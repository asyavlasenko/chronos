import { INVITE_KINDS, INVITE_STATUSES } from '../../constants/index.js';
import { EVENT_POPULATE, serializeEvent } from '../events/event.serializer.js';

export const INVITE_POPULATE = [
  { path: 'invitedBy', select: 'name email' },
  { path: 'calendar', select: 'name description color members' },
  {
    path: 'event',
    populate: [...EVENT_POPULATE, { path: 'calendar', select: 'name description color members' }],
  },
];

export function effectiveStatus(invite, now = new Date()) {
  if (invite.status === INVITE_STATUSES.PENDING && invite.expiresAt <= now) {
    return INVITE_STATUSES.EXPIRED;
  }
  return invite.status;
}

function serializeCalendarBrief(calendar) {
  if (!calendar) return null;
  return {
    id: String(calendar._id),
    name: calendar.name,
    description: calendar.description,
    color: calendar.color,
    isShared: calendar.members.length > 1,
  };
}

export function serializeInvite(invite, { withToken = false } = {}) {
  const isEvent = invite.kind === INVITE_KINDS.EVENT;
  const calendar = isEvent ? invite.event?.calendar : invite.calendar;

  return {
    id: String(invite._id),
    kind: invite.kind,
    email: invite.email,
    status: effectiveStatus(invite),
    role: isEvent ? null : invite.role,
    expiresAt: invite.expiresAt,
    respondedAt: invite.respondedAt,
    createdAt: invite.createdAt,
    ...(withToken ? { token: invite.token } : {}),
    invitedBy: invite.invitedBy
      ? { id: String(invite.invitedBy._id), name: invite.invitedBy.name }
      : null,
    event: isEvent && invite.event ? serializeEvent(invite.event) : null,
    calendar: serializeCalendarBrief(calendar),
  };
}
