import axios from 'axios';

// Єдиний axios-клієнт. baseURL відносний: у dev Vite проксує /api на backend, у Docker — nginx.
const client = axios.create({
  baseURL: '/api',
  withCredentials: true, // refresh-токен у httpOnly cookie
  headers: { 'Content-Type': 'application/json' },
});

// TODO(@teammate2): інтерсептори
//  request:  додавати Authorization: Bearer <accessToken> з AuthProvider (setAccessToken нижче)
//  response: на 401 один раз викликати POST /auth/refresh, повторити запит; якщо знову 401 — logout
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export default client;
