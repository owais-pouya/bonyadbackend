import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { login, logout, me } from "../controllers/authController.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many login attempts. Try again in 15 minutes.",
});

router.post("/login", loginLimiter, asyncHandler(login));
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
