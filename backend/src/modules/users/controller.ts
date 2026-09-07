import type { Request, Response } from "express";
import { User } from "../../models/User.js";
import { hashPassword } from "../../utils/password.js";
import { serializeUser } from "../../utils/serialize.js";
import { ApiError } from "../../utils/asyncHandler.js";

/**
 * Map a requested role to the flag pair we store.
 *   admin    -> staff + superuser
 *   agent    -> staff
 *   customer -> neither
 */
function flagsForRole(role: string): { isStaff: boolean; isSuperuser: boolean } {
  switch (role) {
    case "admin":
      return { isStaff: true, isSuperuser: true };
    case "agent":
      return { isStaff: true, isSuperuser: false };
    default:
      return { isStaff: false, isSuperuser: false };
  }
}

function roleFilter(role?: string): Record<string, unknown> {
  switch (role) {
    case "admin":
      return { isSuperuser: true };
    case "agent":
      return { isStaff: true, isSuperuser: false };
    case "customer":
      return { isStaff: false };
    default:
      return {};
  }
}

/** GET /api/users?role= — staff only. */
export async function list(req: Request, res: Response) {
  const role = typeof req.query.role === "string" ? req.query.role : undefined;
  const q = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filter: Record<string, unknown> = { ...roleFilter(role) };
  if (q) {
    filter.$or = [
      { username: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
    ];
  }
  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json(users.map(serializeUser));
}

/** POST /api/users — create a customer, agent or admin. Staff only. */
export async function create(req: Request, res: Response) {
  const { username, email, password, role } = req.body || {};
  if (!username || !password) throw new ApiError(400, "username and password are required.");

  const exists = await User.findOne({ username: String(username).trim() });
  if (exists) throw new ApiError(400, "That username is already taken.");

  const flags = flagsForRole(String(role || "customer"));
  const user = await User.create({
    username: String(username).trim(),
    email: email ? String(email).trim() : "",
    passwordHash: await hashPassword(String(password)),
    ...flags,
    isActive: true,
  });
  res.status(201).json(serializeUser(user));
}

/** GET /api/users/:id — staff only. */
export async function retrieve(req: Request, res: Response) {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found.");
  res.json(serializeUser(user));
}

/**
 * PATCH /api/users/:id — staff only.
 * Supports blocking/unblocking (is_active), changing role, email, and password.
 */
export async function update(req: Request, res: Response) {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found.");

  const body = req.body || {};
  if (body.is_active !== undefined) user.isActive = !!body.is_active;
  if (body.email !== undefined) user.email = String(body.email).trim();
  if (body.role !== undefined) {
    const flags = flagsForRole(String(body.role));
    user.isStaff = flags.isStaff;
    user.isSuperuser = flags.isSuperuser;
  }
  if (body.password) user.passwordHash = await hashPassword(String(body.password));

  await user.save();
  res.json(serializeUser(user));
}
