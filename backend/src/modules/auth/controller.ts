import type { Request, Response } from "express";
import { User } from "../../models/User.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccess, signRefresh, verifyRefresh } from "../../utils/jwt.js";
import { serializeUser } from "../../utils/serialize.js";
import { ApiError } from "../../utils/asyncHandler.js";

function tokensFor(userId: string) {
  return { access: signAccess(userId), refresh: signRefresh(userId) };
}

/** POST /api/register — create a customer account and sign them in. */
export async function register(req: Request, res: Response) {
  const { username, email, password } = req.body || {};
  if (!username || !password) throw new ApiError(400, "username and password are required.");

  const exists = await User.findOne({ username: String(username).trim() });
  if (exists) throw new ApiError(400, "That username is already taken.");

  const user = await User.create({
    username: String(username).trim(),
    email: email ? String(email).trim() : "",
    passwordHash: await hashPassword(String(password)),
    isStaff: false,
    isSuperuser: false,
    isActive: true,
  });

  const tokens = tokensFor(String(user._id));
  res.status(201).json({ user: serializeUser(user), ...tokens });
}

/** POST /api/login — verify credentials and issue tokens. */
export async function login(req: Request, res: Response) {
  const { username, password } = req.body || {};
  if (!username || !password) throw new ApiError(400, "username and password are required.");

  const user = await User.findOne({ username: String(username).trim() });
  if (!user || !(await verifyPassword(String(password), user.passwordHash))) {
    throw new ApiError(401, "Invalid username or password.");
  }
  if (user.isActive === false) throw new ApiError(403, "This account is blocked.");

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = tokensFor(String(user._id));
  res.json({ user: serializeUser(user), ...tokens });
}

/** POST /api/refresh — exchange a valid refresh token for a new access token. */
export async function refresh(req: Request, res: Response) {
  const { refresh: token } = req.body || {};
  if (!token) throw new ApiError(400, "refresh token is required.");
  let payload;
  try {
    payload = verifyRefresh(String(token));
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token.");
  }
  if (payload.type !== "refresh") throw new ApiError(401, "Invalid token type.");

  const user = await User.findById(payload.sub);
  if (!user || user.isActive === false) throw new ApiError(401, "Account is no longer active.");

  res.json({ access: signAccess(String(user._id)) });
}

/** GET /api/me — the currently authenticated user. */
export async function me(req: Request, res: Response) {
  res.json(serializeUser(req.user));
}
