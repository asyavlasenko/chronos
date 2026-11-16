import { initials } from './text';

const EVENT_FIELDS = [
  'title',
  'description',
  'type',
  'calendar',
  'startAt',
  'endAt',
  'allDay',
  'color',
  'location',
  'reminderMinutesBefore',
  'priority',
  'isCompleted',
  'participants',
];

const toDateOrNull = (value) => (value ? new Date(value) : null);

const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

export function normalizeEvent(event) {
  const startAt = toDateOrNull(event.startAt);
  return {
    ...event,
    startAt,
    endAt: toDateOrNull(event.endAt),
    completedAt: toDateOrNull(event.completedAt),
    createdAt: toDateOrNull(event.createdAt),
    updatedAt: toDateOrNull(event.updatedAt),
    isDeadline: event.type === 'task' && Boolean(event.allDay) && Boolean(startAt),
  };
}

export function normalizeInvite(invite) {
  return {
    ...invite,
    expiresAt: toDateOrNull(invite.expiresAt),
    createdAt: toDateOrNull(invite.createdAt),
    invitedBy: invite.invitedBy
      ? { ...invite.invitedBy, initials: initials(invite.invitedBy.name), color: 'purple' }
      : null,
    event: invite.event ? normalizeEvent(invite.event) : null,
  };
}

export function normalizeCalendar(calendar) {
  return {
    isReadOnly: false,
    pendingInvites: [],
    ...calendar,
  };
}

export function toEventPayload(dto) {
  const payload = {};
  EVENT_FIELDS.forEach((key) => {
    if (dto[key] !== undefined) payload[key] = dto[key];
  });

  if ('startAt' in payload) payload.startAt = toIsoOrNull(payload.startAt);
  if ('endAt' in payload) payload.endAt = toIsoOrNull(payload.endAt);
  if (payload.participants) {
    payload.participants = payload.participants.map((p) => (typeof p === 'string' ? p : p.email));
  }
  return payload;
}
