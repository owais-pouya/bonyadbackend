import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { validateMaterial } from "../middleware/validateMaterial.js";
import { requireAuth } from "../middleware/auth.js";
import {
  listMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from "../controllers/materialsController.js";

const router = Router();

// Public reads
router.get("/", asyncHandler(listMaterials));
router.get("/:id", asyncHandler(getMaterial));

// Admin-only writes
router.post("/", requireAuth, validateMaterial, asyncHandler(createMaterial));
router.put("/:id", requireAuth, validateMaterial, asyncHandler(updateMaterial));
router.delete("/:id", requireAuth, asyncHandler(deleteMaterial));

export default router;
