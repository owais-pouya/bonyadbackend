import { verifyToken, COOKIE_NAME } from "../config/auth.js";
import { httpError } from "./errorHandler.js";

// Reject if no valid JWT cookie.
export function requireAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next(httpError(401, "Not authenticated"));
  try {
    req.admin = verifyToken(token); // { sub, email, role, iat, exp }
    next();
  } catch {
    next(httpError(401, "Session expired or invalid"));
  }
}
