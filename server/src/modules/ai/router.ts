import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireStaff } from "../../middleware/auth.js";
import {
  usageSummary, usageByProvider, usageByModel, usageByFeature,
  fraudList, fraudGet, fraudAnalyze, fraudUpdate,
} from "./controller.js";

const router = Router();

// All AI analytics endpoints are staff-only.
router.use(requireStaff);
router.get("/usage/summary", asyncHandler(usageSummary));
router.get("/usage/by-provider", asyncHandler(usageByProvider));
router.get("/usage/by-model", asyncHandler(usageByModel));
router.get("/usage/by-feature", asyncHandler(usageByFeature));

// Fraud detection
router.get("/fraud/assessments", asyncHandler(fraudList));
router.get("/fraud/assessments/:id", asyncHandler(fraudGet));
router.post("/fraud/analyze", asyncHandler(fraudAnalyze));
router.put("/fraud/assessments/:id", asyncHandler(fraudUpdate));

export default router;
