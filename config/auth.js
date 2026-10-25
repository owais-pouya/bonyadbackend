import "dotenv/config";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error("FATAL: JWT_SECRET is not set.");
  process.exit(1);
}

const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "2h";

export const COOKIE_NAME = "bonyad_token";

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.COOKIE_SECURE === "true",
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
