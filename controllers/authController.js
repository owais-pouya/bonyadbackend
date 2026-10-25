import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import { signToken, COOKIE_NAME, cookieOptions } from "../config/auth.js";

export async function login(req, res) {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    const err = new Error("Email and password are required");
    err.status = 400;
    throw err;
  }

  const { rows } = await query(
    "SELECT id, email, password_hash, role FROM admins WHERE lower(email) = lower($1)",
    [email],
  );
  const admin = rows[0];
  const ok = admin && (await bcrypt.compare(password, admin.password_hash));
  if (!ok) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }

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
