import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env, assertProductionSecrets } from "./config/env.js";
import { runSeed } from "./seed/seed.js";

async function main() {
  assertProductionSecrets();
  await connectDB();

  // Auto-seed demo accounts (admin/agent/priya) + KB on boot when SEED_DEMO is
  // on, so a fresh database is immediately usable. Idempotent: only creates
  // rows that don't already exist. Never blocks startup on failure.
  if (env.SEED_DEMO) {
    try {
      const counts = await runSeed();
      // eslint-disable-next-line no-console
      console.log("Demo seed ensured on boot:", counts);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Boot seed skipped (continuing):", err);
    }
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Superbae server listening on http://localhost:${env.PORT}`);
    if (env.AI_SERVICE_URL) {
      console.log(`Ara LLM: via AI sidecar at ${env.AI_SERVICE_URL} (RAG). Falls back to Gemini/keyword if it is down.`);
    } else if (env.GEMINI_API_KEY || env.OPENAI_API_KEY) {
      const chain = [
        env.GEMINI_API_KEY && `Gemini (${env.ASSISTANT_LLM_MODEL})`,
        env.OPENAI_API_KEY && `OpenAI (${env.OPENAI_MODEL})`,
      ].filter(Boolean).join(" -> ");
      console.log(`Ara LLM: enabled via direct ${chain}.`);
    } else {
      console.log("Ara LLM: disabled (no AI_SERVICE_URL or GEMINI_API_KEY). Ara runs on curated Q&A matching.");
    }
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
