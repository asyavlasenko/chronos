/** GET /calendars → { calendars: [...] } */
export async function listCalendars() {
  throw new Error('TODO(@teammate2): calendars.api.listCalendars');
}

/** GET /calendars/:id → { calendar } (з учасниками) */
export async function getCalendar() {
  throw new Error('TODO(@teammate2): calendars.api.getCalendar');
}

/** POST /calendars { name, description?, color } → { calendar } */
export async function createCalendar() {
  throw new Error('TODO(@teammate2): calendars.api.createCalendar');
}

/** PATCH /calendars/:id { name?, description?, color? } → { calendar } */
export async function updateCalendar() {
  throw new Error('TODO(@teammate2): calendars.api.updateCalendar');
}

/** DELETE /calendars/:id → 204 */
export async function deleteCalendar() {
  throw new Error('TODO(@teammate2): calendars.api.deleteCalendar');
}

/** PATCH /calendars/:id/visibility { isHidden?, color? } → { membership } */
export async function updateVisibility() {
  throw new Error('TODO(@teammate2): calendars.api.updateVisibility');
}

/** POST /calendars/:id/share { email, role } → { invite } */
export async function shareCalendar() {
  throw new Error('TODO(@teammate2): calendars.api.shareCalendar');
}

/** PATCH /calendars/:id/members/:userId { role } → { calendar } */
export async function updateMember() {
  throw new Error('TODO(@teammate2): calendars.api.updateMember');
}

/** DELETE /calendars/:id/members/:userId → 204 */
export async function removeMember() {
  throw new Error('TODO(@teammate2): calendars.api.removeMember');
}
