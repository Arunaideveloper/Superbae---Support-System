import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireStaff } from "../../middleware/auth.js";
import { list, create, retrieve, update } from "./controller.js";

const router = Router();

router.use(requireStaff);
router.get("/", asyncHandler(list));
router.post("/", asyncHandler(create));
router.get("/:id", asyncHandler(retrieve));
router.patch("/:id", asyncHandler(update));

export default router;
