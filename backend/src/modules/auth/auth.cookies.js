import env from '../../config/env.js';
import { ttlToMs } from '../../utils/tokens.js';

export const REFRESH_COOKIE = 'refreshToken';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.cookie.secure,
  path: '/api/auth',
});

export function setRefreshCookie(res, token, remember = true) {
  const maxAge = remember ? { maxAge: ttlToMs(env.jwt.refreshTtl) } : {};
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions(), ...maxAge });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
}
