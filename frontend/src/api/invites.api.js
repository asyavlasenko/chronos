import client from './client';

export async function listMyInvites() {
  const { data } = await client.get('/invites');
  return data.invites;
}

export async function getInvite(token) {
  const { data } = await client.get(`/invites/${token}`);
  return data.invite;
}

export async function acceptInvite(token) {
  const { data } = await client.post(`/invites/${token}/accept`);
  return data.invite;
}

export async function declineInvite(token) {
  const { data } = await client.post(`/invites/${token}/decline`);
  return data.invite;
}
