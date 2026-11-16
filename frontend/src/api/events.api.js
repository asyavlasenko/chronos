import client from './client';

export async function listEvents(params = {}) {
  const { data } = await client.get('/events', { params });
  return data.events;
}

export async function getEvent(id) {
  const { data } = await client.get(`/events/${id}`);
  return data.event;
}

export async function createEvent(payload) {
  const { data } = await client.post('/events', payload);
  return data.event;
}

export async function updateEvent(id, patch) {
  const { data } = await client.patch(`/events/${id}`, patch);
  return data.event;
}

export async function deleteEvent(id) {
  await client.delete(`/events/${id}`);
}

export async function inviteToEvent(id, emails) {
  const { data } = await client.post(`/events/${id}/invite`, { emails });
  return data.event;
}
