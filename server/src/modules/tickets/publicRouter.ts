import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validate } from "../../middleware/validate.js";
import { publicTicketSchema } from "../../schemas.js";
import { createPublicTicket } from "./publicController.js";

// Public (no auth): a visitor can open a support ticket from the Help Center.
const router = Router();
router.post("/", validate(publicTicketSchema), asyncHandler(createPublicTicket));
export default router;
