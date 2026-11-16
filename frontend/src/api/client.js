import axios from 'axios';

const NO_RETRY_URL = /^\/auth\/(login|register|refresh|logout|password-reset)/;

const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken = null;
let unauthorizedHandler = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = client
      .post('/auth/refresh')
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

client.interceptors.request.use((request) => {
  if (accessToken) request.headers.Authorization = `Bearer ${accessToken}`;
  return request;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isUnauthorized = error.response?.status === 401;
    if (!isUnauthorized || !original || original.retried || NO_RETRY_URL.test(original.url)) {
      throw error;
    }
    original.retried = true;

    const sentWith = original.headers?.Authorization;
    const hasNewerToken = Boolean(accessToken) && sentWith !== `Bearer ${accessToken}`;
    if (!hasNewerToken) {
      try {
        await refreshSession();
      } catch (refreshError) {
        if (!refreshError.response) throw refreshError;
        setAccessToken(null);
        if (unauthorizedHandler) unauthorizedHandler();
        throw error;
      }
    }
    return client(original);
  },
);

export default client;
