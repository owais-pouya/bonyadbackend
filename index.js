import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pool, closePool } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRouter from "./routes/auth.js";
import materialsRouter from "./routes/materials.js";
import enquiriesRouter from "./routes/enquiries.js";

const app = express();

// Behind Vercel's proxy: needed so req.ip (rate limiting) is the real client IP.
app.set("trust proxy", 1);

// Allowed browser origins (only relevant when the browser calls this API directly;
// the deployed frontend proxies /api so it is same-origin).
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

// CORS must echo the origin AND allow credentials for the httpOnly cookie.
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Parses the bonyad_token cookie into req.cookies.
app.use(cookieParser());

app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "bonyad-backend",
    time: new Date().toISOString(),
  });
});

// Deployment check: confirms the database is reachable and tables exist.
app.get("/api/health/db", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT (SELECT count(*) FROM materials)::int AS materials,
              (SELECT count(*) FROM admins)::int    AS admins`,
    );
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    console.error("DB health check failed:", err.message);
    res.status(503).json({ ok: false, error: "Database not reachable or schema missing" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/materials", materialsRouter);
app.use("/api/enquiries", enquiriesRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

// Boot: verify DB, then listen. Skipped on Vercel (see vercel.json).
const PORT = Number(process.env.PORT ?? 4000);
const isVercel = !!process.env.VERCEL;

if (!isVercel) {
  try {
    await pool.query("SELECT 1");
    console.log("Postgres connection OK");
  } catch (err) {
    console.error("Cannot reach Postgres:", err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`bonyad-backend listening on http://localhost:${PORT}`);
  });

  const shutdown = (sig) => {
    console.log(`\n${sig} received, shutting down...`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Vercel serverless entry point
export default app;
