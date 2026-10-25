import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { validateMaterial } from "../middleware/validateMaterial.js";
import { validateId } from "../middleware/validateId.js";
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
router.get("/:id", validateId, asyncHandler(getMaterial));

// Admin-only writes
router.post("/", requireAuth, validateMaterial, asyncHandler(createMaterial));
router.put("/:id", requireAuth, validateId, validateMaterial, asyncHandler(updateMaterial));
router.delete("/:id", requireAuth, validateId, asyncHandler(deleteMaterial));

export default router;
