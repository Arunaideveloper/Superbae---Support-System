import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";

async function main() {
  await connectDB();
  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Superbae server listening on http://localhost:${env.PORT}`);
    if (!env.GEMINI_API_KEY) {
      console.log("Ara LLM: disabled (no GEMINI_API_KEY). Ara runs on curated Q&A matching.");
    } else {
      console.log(`Ara LLM: enabled (${env.ASSISTANT_LLM_MODEL}).`);
    }
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
