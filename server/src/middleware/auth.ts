import type { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../utils/jwt.js";
import { User, type UserDoc } from "../models/User.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: UserDoc | null; }
  }
}

// Attach req.user if a valid Bearer token is present (does not require it).
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token) {
    try {
      const payload = verifyAccess(token);
      if (payload.type === "access") {
        const user = (await User.findById(payload.sub)) as UserDoc | null;
        // Reject tokens for blocked accounts and tokens issued before a
        // revocation (password change / logout-all bumps tokenVersion).
        if (user && user.isActive !== false && (user.tokenVersion || 0) === (payload.tv || 0)) {
          req.user = user;
        }
      }
    } catch { /* invalid/expired -> anonymous */ }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ detail: "Authentication required." });
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ detail: "Authentication required." });
  if (!req.user.isStaff) return res.status(403).json({ detail: "Staff only." });
  next();
}
