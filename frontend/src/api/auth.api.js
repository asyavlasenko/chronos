import client, { refreshSession } from './client';

export async function register({ email, password, name, timezone, country, next }) {
  const { data } = await client.post('/auth/register', {
    email,
    password,
    name,
    timezone,
    country,
    next,
  });
  return data;
}

export async function verifyEmail(token) {
  const { data } = await client.post('/auth/verify-email', { token });
  return data;
}

export async function resendVerification(email) {
  const { data } = await client.post('/auth/verify-email/resend', { email });
  return data;
}

export async function login({ email, password, remember = true }) {
  const { data } = await client.post('/auth/login', { email, password, remember });
  return data;
}

export async function logout() {
  const { data } = await client.post('/auth/logout');
  return data;
}

export function refresh() {
  return refreshSession();
}

export async function requestPasswordReset(email) {
  const { data } = await client.post('/auth/password-reset', { email });
  return data;
}

export async function confirmPasswordReset({ token, password }) {
  const { data } = await client.post('/auth/password-reset/confirm', { token, password });
  return data;
}
