import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || "8001", 10),
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/superbae",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  ACCESS_TTL: process.env.ACCESS_TTL || "30m",
  REFRESH_TTL: process.env.REFRESH_TTL || "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  ASSISTANT_LLM_MODEL: process.env.ASSISTANT_LLM_MODEL || "gemini-1.5-flash",
};
