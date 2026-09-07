import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface JwtPayload { sub: string; type: "access" | "refresh"; }

export function signAccess(userId: string): string {
  return jwt.sign({ sub: userId, type: "access" }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TTL as any });
}
export function signRefresh(userId: string): string {
  return jwt.sign({ sub: userId, type: "refresh" }, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TTL as any });
}
export function verifyAccess(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}
export function verifyRefresh(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}
