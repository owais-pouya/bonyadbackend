import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validateId } from "../middleware/validateId.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  createEnquiry,
  listEnquiries,
  deleteEnquiry,
} from "../controllers/enquiriesController.js";

const router = Router();

const createLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Too many enquiries. Please wait a few minutes.",
});

// Public: customers send a sample enquiry
router.post("/", createLimiter, asyncHandler(createEnquiry));

// Admin-only: read and clean up enquiries
router.get("/", requireAuth, asyncHandler(listEnquiries));
router.delete("/:id", requireAuth, validateId, asyncHandler(deleteEnquiry));

export default router;
