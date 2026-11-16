import client from './client';

export async function listCalendars() {
  const { data } = await client.get('/calendars');
  return data.calendars;
}

export async function getCalendar(id) {
  const { data } = await client.get(`/calendars/${id}`);
  return data.calendar;
}

export async function createCalendar({ name, description, color }) {
  const { data } = await client.post('/calendars', { name, description, color });
  return data.calendar;
}

export async function updateCalendar(id, patch) {
  const { data } = await client.patch(`/calendars/${id}`, patch);
  return data.calendar;
}

export async function deleteCalendar(id) {
  await client.delete(`/calendars/${id}`);
}

export async function updateVisibility(id, patch) {
  const { data } = await client.patch(`/calendars/${id}/visibility`, patch);
  return data.calendar;
}

export async function shareCalendar(id, { email, role }) {
  const { data } = await client.post(`/calendars/${id}/share`, { email, role });
  return data.invite;
}

export async function updateMemberRole(id, userId, role) {
  const { data } = await client.patch(`/calendars/${id}/members/${userId}`, { role });
  return data.calendar;
}

export async function removeMember(id, userId) {
  await client.delete(`/calendars/${id}/members/${userId}`);
}

export async function cancelInvite(id, inviteId) {
  await client.delete(`/calendars/${id}/invites/${inviteId}`);
}
