import { verifyToken, COOKIE_NAME } from "../config/auth.js";

// Reject if no valid JWT cookie.
export function requireAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    const err = new Error("Not authenticated");
    err.status = 401;
    return next(err);
  }
  try {
    req.admin = verifyToken(token); // { sub, email, role, iat, exp }
    next();
  } catch {
    const err = new Error("Session expired or invalid");
    err.status = 401;
    next(err);
  }
}
