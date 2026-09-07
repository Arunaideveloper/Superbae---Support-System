import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodTypeAny } from "zod";

/**
 * Validate (and coerce) one part of the request against a Zod schema.
 * On success the parsed value replaces req[part] so controllers get clean,
 * typed data. On failure a 400 with a readable message is returned.
 */
export function validate(schema: ZodTypeAny, part: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return res.status(400).json({ detail: formatZodError(result.error) });
    }
    // Assign parsed data back (query/params are read-only getters in Express 5,
    // but Express 4 allows reassignment; guard just in case).
    try {
      (req as any)[part] = result.data;
    } catch {
      /* ignore if not writable */
    }
    next();
  };
}

function formatZodError(err: ZodError): string {
  const first = err.errors[0];
  if (!first) return "Invalid request.";
  const path = first.path.join(".");
  return path ? `${path}: ${first.message}` : first.message;
}
