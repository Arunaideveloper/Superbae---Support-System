import dotenv from "dotenv";
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "8001", 10),
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/superbae",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  ACCESS_TTL: process.env.ACCESS_TTL || "30m",
  REFRESH_TTL: process.env.REFRESH_TTL || "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  // Legacy direct-Gemini path (fallback when the AI sidecar is not configured).
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  ASSISTANT_LLM_MODEL: process.env.ASSISTANT_LLM_MODEL || "gemini-1.5-flash",
  // Superbae AI layer (FastAPI RAG sidecar). When set, Ara answers via its /chat.
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || "",
  AI_ADMIN_API_KEY: process.env.AI_ADMIN_API_KEY || "",
  // Shared secret so only Express can call the AI layer's /chat. Empty = open (dev only).
  AI_SERVICE_TOKEN: process.env.AI_SERVICE_TOKEN || "",
  // Seed demo accounts? Defaults on for dev; set SEED_DEMO=false in production.
  SEED_DEMO: (process.env.SEED_DEMO || "true").toLowerCase() !== "false",
};

/**
 * Fail fast in production if secrets were left at their insecure defaults.
 * Never let a real deployment run with "dev-*-secret".
 */
export function assertProductionSecrets() {
  if (env.NODE_ENV !== "production") return;
  const weak: string[] = [];
  if (env.JWT_ACCESS_SECRET === "dev-access-secret") weak.push("JWT_ACCESS_SECRET");
  if (env.JWT_REFRESH_SECRET === "dev-refresh-secret") weak.push("JWT_REFRESH_SECRET");
  if (weak.length) {
    throw new Error(
      `Refusing to start in production with default secret(s): ${weak.join(", ")}. Set strong values in the environment.`
    );
  }
}
