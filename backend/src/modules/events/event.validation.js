import Joi from 'joi';

// GET /api/events?from&to&calendars&types&q
// { from: ISO date, to: ISO date (> from, максимум ~1 рік), calendars?: 'id1,id2', types?: 'arrangement,task', q?: string (..100) }
export const listEventsQuery = Joi.object().unknown(true); // TODO(@teammate1)

// POST /api/events
// { title (1..120), type (EVENT_TYPES), calendar (ObjectId), startAt (ISO), endAt? (ISO, > startAt, лише arrangement),
//   allDay?, color? (COLOR_KEYS|null), location? (..200), description? (..2000), reminderMinutesBefore? (0..10080),
//   priority? (PRIORITIES, task), participants?: [email] }
export const createEventSchema = Joi.object().unknown(true); // TODO(@teammate1)

// PATCH /api/events/:id — ті самі поля, усі опційні, + isCompleted? (task)
export const updateEventSchema = Joi.object().unknown(true); // TODO(@teammate1)

// POST /api/events/:id/invite — { emails: [email] (1..20) }
export const inviteToEventSchema = Joi.object().unknown(true); // TODO(@teammate1)

// params: { id: ObjectId }
export const eventIdParams = Joi.object().unknown(true); // TODO(@teammate1)
