import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireStaff } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { createUserSchema, updateUserSchema } from "../../schemas.js";
import { list, create, retrieve, update } from "./controller.js";

const router = Router();

router.use(requireStaff);
router.get("/", asyncHandler(list));
router.post("/", validate(createUserSchema), asyncHandler(create));
router.get("/:id", asyncHandler(retrieve));
router.patch("/:id", validate(updateUserSchema), asyncHandler(update));

export default router;
