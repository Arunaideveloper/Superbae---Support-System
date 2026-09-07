import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { attachUser, requireStaff } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { askSchema, logSchema, assistantConfigSchema, qaSchema, updateQaSchema } from "../../schemas.js";
import {
  config, log, ask,
  adminGetConfig, adminUpdateConfig,
  adminListQA, adminCreateQA, adminUpdateQA, adminDeleteQA,
  adminListConversations, adminGetConversation,
} from "./controller.js";

const router = Router();

// Public endpoints — optional auth so turns can be attributed when signed in.
router.get("/config", attachUser, asyncHandler(config));
router.post("/log", attachUser, validate(logSchema), asyncHandler(log));
router.post("/ask", attachUser, validate(askSchema), asyncHandler(ask));

// Admin endpoints — staff only.
router.get("/admin/config", requireStaff, asyncHandler(adminGetConfig));
router.patch("/admin/config", requireStaff, validate(assistantConfigSchema), asyncHandler(adminUpdateConfig));
router.get("/admin/qa", requireStaff, asyncHandler(adminListQA));
router.post("/admin/qa", requireStaff, validate(qaSchema), asyncHandler(adminCreateQA));
router.patch("/admin/qa/:id", requireStaff, validate(updateQaSchema), asyncHandler(adminUpdateQA));
router.delete("/admin/qa/:id", requireStaff, asyncHandler(adminDeleteQA));
router.get("/admin/conversations", requireStaff, asyncHandler(adminListConversations));
router.get("/admin/conversations/:id", requireStaff, asyncHandler(adminGetConversation));

export default router;
