/** GET /events?from&to&calendars&types&q → { events: [...] } (дати — ISO UTC) */
export async function listEvents() {
  throw new Error('TODO(@teammate2): events.api.listEvents');
}

/** GET /events/:id → { event } */
export async function getEvent() {
  throw new Error('TODO(@teammate2): events.api.getEvent');
}

/** POST /events { title, type, calendar, startAt, endAt?, … } → { event } */
export async function createEvent() {
  throw new Error('TODO(@teammate2): events.api.createEvent');
}

/** PATCH /events/:id { … } → { event } */
export async function updateEvent() {
  throw new Error('TODO(@teammate2): events.api.updateEvent');
}

/** DELETE /events/:id → 204 */
export async function deleteEvent() {
  throw new Error('TODO(@teammate2): events.api.deleteEvent');
}

/** POST /events/:id/invite { emails: [] } → { event } */
export async function inviteToEvent() {
  throw new Error('TODO(@teammate2): events.api.inviteToEvent');
}
