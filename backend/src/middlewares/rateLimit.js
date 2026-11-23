import ApiError from '../utils/ApiError.js';

const MAX_TRACKED_KEYS = 10000;
const SECOND_MS = 1000;

const byIp = (req) => req.ip;

export default function rateLimit({ windowMs, max, message, keyOf = byIp }) {
  if (!(max > 0)) return (req, res, next) => next();

  const hits = new Map();

  const prune = (now) => {
    hits.forEach((entry, key) => {
      if (entry.resetAt <= now) hits.delete(key);
    });
  };

  return function limit(req, res, next) {
    const now = Date.now();
    if (hits.size >= MAX_TRACKED_KEYS) prune(now);

    const key = keyOf(req);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count <= max) {
      next();
      return;
    }

    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / SECOND_MS)));
    next(new ApiError(429, message));
  };
}
