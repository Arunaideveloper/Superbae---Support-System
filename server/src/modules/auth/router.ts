import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { registerSchema, loginSchema, refreshSchema } from "../../schemas.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { register, login, refresh, me } from "./controller.js";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), asyncHandler(register));
router.post("/login", authLimiter, validate(loginSchema), asyncHandler(login));
router.post("/refresh", validate(refreshSchema), asyncHandler(refresh));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
