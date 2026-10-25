import "dotenv/config";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error("FATAL: JWT_SECRET is not set.");
  process.exit(1);
}

const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "2h";
const isProd = process.env.NODE_ENV === "production";

export const COOKIE_NAME = "bonyad_token";

// Secure cookies are required on https (Vercel). Default: on in production, off locally.
const secure =
  process.env.COOKIE_SECURE !== undefined && process.env.COOKIE_SECURE.trim() !== ""
    ? process.env.COOKIE_SECURE.trim() === "true"
    : isProd;

// The frontend proxies /api to this backend (see frontend/vercel.json), so the browser sees
// one site and "lax" is enough. Use COOKIE_SAMESITE=none only if the browser calls this
// backend directly from another domain (needs Secure=true).
const sameSite = (process.env.COOKIE_SAMESITE ?? "lax").trim().toLowerCase();

export const cookieOptions = {
  httpOnly: true,
  sameSite,
  secure: sameSite === "none" ? true : secure,
  maxAge: 2 * 60 * 60 * 1000, // matches JWT_EXPIRES_IN=2h
  path: "/",
};

export function signToken(admin) {
  return jwt.sign(
    { sub: admin.id, email: admin.email, role: admin.role },
    SECRET,
    { expiresIn: EXPIRES_IN },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET); // throws on invalid/expired
}
