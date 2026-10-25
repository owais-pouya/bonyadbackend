import { httpError } from "./errorHandler.js";

// Tiny in-memory limiter. On serverless each instance has its own memory,
// so this is best-effort protection against password guessing, not a hard guarantee.
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
    } else {
      entry.count += 1;
      if (entry.count > max) {
        return next(httpError(429, message ?? "Too many requests, try again later."));
      }
    }
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    }
    next();
  };
}
