export const PARTICIPANT_POPULATE = { path: 'participants.user', select: 'name email' };
export const CREATOR_POPULATE = { path: 'creator', select: 'name email' };
export const EVENT_POPULATE = [PARTICIPANT_POPULATE, CREATOR_POPULATE];

const idOf = (value) => (value ? String(value._id ?? value) : null);

const isPopulated = (value) => Boolean(value) && typeof value.email === 'string';

export function serializeParticipant(participant) {
  const populated = isPopulated(participant.user);
  return {
    user: idOf(participant.user),
    name: populated ? participant.user.name : participant.email.split('@')[0],
    email: participant.email,
    status: participant.status,
    invitedAt: participant.invitedAt,
    respondedAt: participant.respondedAt,
  };
}

export function serializeEvent(event) {
  return {
    id: String(event._id),
    title: event.title,
    description: event.description,
    type: event.type,
    calendar: idOf(event.calendar),
    creator: idOf(event.creator),
    creatorName: isPopulated(event.creator) ? event.creator.name : null,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
    color: event.color ?? null,
    location: event.location,
    reminderMinutesBefore: event.reminderMinutesBefore,
    isCompleted: event.isCompleted,
    completedAt: event.completedAt,
    priority: event.priority,
    participants: event.participants.map(serializeParticipant),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

export function serializeOwnEvent(event) {
  return { ...serializeEvent(event), isInvited: false, sourceCalendar: null };
}

export function serializeInvitedEvent(event, sourceCalendar, mainCalendarId = null) {
  const serialized = serializeEvent(event);
  return {
    ...serialized,
    calendar: mainCalendarId ?? serialized.calendar,
    isInvited: true,
    sourceCalendar: sourceCalendar
      ? { id: String(sourceCalendar._id), name: sourceCalendar.name, color: sourceCalendar.color }
      : null,
  };
}
