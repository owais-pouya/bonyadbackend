import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { createEnquiry } from "../controllers/enquiriesController.js";

const router = Router();
router.post("/", asyncHandler(createEnquiry));
export default router;
