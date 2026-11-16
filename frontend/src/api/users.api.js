import client from './client';

export async function getMe() {
  const { data } = await client.get('/users/me');
  return data;
}

export async function updateMe(patch) {
  const { data } = await client.patch('/users/me', patch);
  return data;
}

export async function changePassword({ currentPassword, newPassword }) {
  const { data } = await client.post('/users/me/password', { currentPassword, newPassword });
  return data;
}

export async function logoutEverywhere() {
  const { data } = await client.post('/users/me/logout-everywhere');
  return data;
}
