import client from './client';

export async function getTelegramStatus() {
  const { data } = await client.get('/telegram');
  return data;
}

export async function createTelegramLink() {
  const { data } = await client.post('/telegram/link');
  return data;
}

export async function disconnectTelegram() {
  await client.delete('/telegram/link');
}

export async function sendTelegramTest() {
  await client.post('/telegram/test');
}
