import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireAuth, requireStaff } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createTicketSchema, updateTicketSchema, messageSchema, assignSchema, statusSchema, prioritySchema,
} from "../../schemas.js";
import {
  list, retrieve, create, update, listMessages, postMessage,
  assign, setStatus, setPriority, stats, escalations, slaReport,
} from "./controller.js";

const router = Router();

router.use(requireAuth);

// Staff-only reports (declared before :id so these words aren't read as ids).
router.get("/stats", requireStaff, asyncHandler(stats));
router.get("/escalations", requireStaff, asyncHandler(escalations));
router.get("/sla-report", requireStaff, asyncHandler(slaReport));

router.get("/", asyncHandler(list));
router.post("/", validate(createTicketSchema), asyncHandler(create));
router.get("/:id", asyncHandler(retrieve));
router.patch("/:id", validate(updateTicketSchema), asyncHandler(update));

router.get("/:id/messages", asyncHandler(listMessages));
router.post("/:id/messages", validate(messageSchema), asyncHandler(postMessage));

router.post("/:id/assign", requireStaff, validate(assignSchema), asyncHandler(assign));
router.post("/:id/status", requireStaff, validate(statusSchema), asyncHandler(setStatus));
router.post("/:id/priority", requireStaff, validate(prioritySchema), asyncHandler(setPriority));

export default router;
