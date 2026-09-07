import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/asyncHandler.js";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ detail: "Not found." });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) return res.status(err.status).json({ detail: err.message });
  const e = err as { name?: string; code?: number; message?: string };
  if (e?.name === "ValidationError") return res.status(400).json({ detail: e.message });
  if (e?.code === 11000) return res.status(400).json({ detail: "Duplicate value." });
  console.error(err);
  res.status(500).json({ detail: "Server error." });
}
