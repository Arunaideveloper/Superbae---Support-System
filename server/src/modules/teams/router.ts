import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireStaff } from "../../middleware/auth.js";
import { teamStats } from "./controller.js";

const router = Router();
router.use(requireStaff);
router.get("/stats", asyncHandler(teamStats));

export default router;
