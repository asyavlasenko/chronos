import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

const TTL_UNITS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

export function ttlToMs(ttl) {
  const match = /^(\d+)([smhd])$/.exec(String(ttl));
  if (!match) return Number(ttl) * 1000;
  return Number(match[1]) * TTL_UNITS[match[2]];
}

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, tv: user.tokenVersion },
    env.jwt.accessSecret,
    {
      expiresIn: env.jwt.accessTtl,
    },
  );
}

export function signRefreshToken(user, { remember = true } = {}) {
  return jwt.sign(
    { sub: user.id, tv: user.tokenVersion, typ: 'refresh', rm: remember },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshTtl },
  );
}

export const verifyAccessToken = (token) => jwt.verify(token, env.jwt.accessSecret);

export const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
