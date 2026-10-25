import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { login, logout, me } from "../controllers/authController.js";

const router = Router();

router.post("/login", asyncHandler(login));
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
