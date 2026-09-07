import rateLimit from "express-rate-limit";

/** Tight limiter for auth endpoints to slow down credential stuffing. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many attempts. Please try again later." },
});

/** Gentle global limiter for the whole API. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many requests. Please slow down." },
});
