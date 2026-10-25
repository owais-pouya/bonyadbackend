// Run: node seedAdmin.js
// Reads ADMIN_EMAIL / ADMIN_PASSWORD from .env. Idempotent.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { query, closePool } from "./config/db.js";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(password, 12);
  await query(
    `INSERT INTO admins (email, password_hash, role)
     VALUES (lower($1), $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email, hash],
  );
  console.log(`Admin seeded: ${email}`);
} catch (err) {
  console.error("Seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
