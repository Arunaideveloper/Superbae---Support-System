import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireAuth, requireStaff } from "../../middleware/auth.js";
import {
  list, retrieve, create, update, listMessages, postMessage,
  assign, setStatus, setPriority, stats,
} from "./controller.js";

const router = Router();

router.use(requireAuth);

// Staff-only dashboard stats (declared before :id so "stats" isn't read as an id).
router.get("/stats", requireStaff, asyncHandler(stats));

router.get("/", asyncHandler(list));
router.post("/", asyncHandler(create));
router.get("/:id", asyncHandler(retrieve));
router.patch("/:id", asyncHandler(update));

router.get("/:id/messages", asyncHandler(listMessages));
router.post("/:id/messages", asyncHandler(postMessage));

router.post("/:id/assign", requireStaff, asyncHandler(assign));
router.post("/:id/status", requireStaff, asyncHandler(setStatus));
router.post("/:id/priority", requireStaff, asyncHandler(setPriority));

export default router;
