import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import { signToken, COOKIE_NAME, cookieOptions } from "../config/auth.js";
import { httpError } from "../middleware/errorHandler.js";

export async function login(req, res) {
  const { email, password } = req.body ?? {};
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    throw httpError(400, "Email and password are required");
  }

  const { rows } = await query(
    "SELECT id, email, password_hash, role FROM admins WHERE lower(email) = lower($1)",
    [email.trim()],
  );
  const admin = rows[0];
  const ok = admin && (await bcrypt.compare(password, admin.password_hash));
  if (!ok) throw httpError(401, "Invalid email or password");

  const token = signToken(admin);
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ id: admin.id, email: admin.email, role: admin.role });
}

export function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
}

export function me(req, res) {
  res.json({ id: req.admin.sub, email: req.admin.email, role: req.admin.role });
}
