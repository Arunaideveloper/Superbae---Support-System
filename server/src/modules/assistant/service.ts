/**
 * Ara assistant logic.
 *
 * Answer resolution order (each step falls through on failure):
 *   1. Superbae AI layer (FastAPI RAG sidecar) via AI_SERVICE_URL — the real
 *      Ara: FAISS retrieval + multi-provider routing. This is primary.
 *   2. Legacy direct-Gemini call grounded in curated Q&A + published KB articles
 *      (only if GEMINI_API_KEY is set) — a fallback if the sidecar is unreachable.
 *   3. null — the caller returns { source: "unavailable" } and the client falls
 *      back to its own curated-Q&A keyword matching, so Ara always responds.
 */
import { env } from "../../config/env.js";
import { AssistantQA, AssistantConversation } from "../../models/Assistant.js";
import { Article } from "../../models/Article.js";

export const SYSTEM_PROMPT = `You are Ara, the friendly AI stylist and support assistant for Superbae, a wardrobe and outfit-styling app.
Answer only using the provided CONTEXT (curated Q&A and help articles). Be warm, concise and practical.
If the context does not cover the question, say you are not sure and suggest contacting support or opening a ticket.
Never invent account details, prices or policies that are not in the context.`;

/** Ara has a server-side brain if either the AI sidecar or a Gemini key is set. */
export function llmConfigured(): boolean {
  return !!env.AI_SERVICE_URL || !!env.GEMINI_API_KEY;
}

/**
 * Ask the Superbae AI layer's RAG /chat endpoint. Returns the answer text, or
 * null on any failure (unset URL, timeout, non-2xx, empty body) so the caller
 * can fall back. History can be supplied for multi-turn context.
 */
export async function callAIService(
  question: string,
  history: { role: "user" | "assistant"; content: string }[] = []
): Promise<string | null> {
  if (!env.AI_SERVICE_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(`${env.AI_SERVICE_URL.replace(/\/$/, "")}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, history }),
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const text = typeof data?.response === "string" ? data.response.trim() : "";
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Assemble grounding context from active Q&A and published, public KB articles. */
export async function buildContext(question: string): Promise<string> {
  const qa = await AssistantQA.find({ active: true }).sort({ order: 1 }).limit(50);
  const articles = await Article.find({ status: "published", visibility: "everyone" })
    .sort({ views: -1 })
    .limit(20);

  const qaBlock = qa.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n\n");
  const articleBlock = articles
    .map((a) => `# ${a.title}\n${(a.body || "").slice(0, 1500)}`)
    .join("\n\n");

  return `CURATED Q&A:\n${qaBlock}\n\nHELP ARTICLES:\n${articleBlock}`.slice(0, 12000);
}

/** Call the Gemini REST API directly. Returns the answer text, or null on any failure. */
export async function callGemini(question: string, context: string): Promise<string | null> {
  if (!env.GEMINI_API_KEY) return null;
  const model = env.ASSISTANT_LLM_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    env.GEMINI_API_KEY
  )}`;

  const payload = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: `CONTEXT:\n${context}\n\nQUESTION: ${question}` }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
    return text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Produce a server-side answer. Prefers the AI sidecar; on failure falls back to
 * the legacy direct-Gemini path; returns null if neither yields an answer.
 */
export async function llmAnswer(
  question: string,
  history: { role: "user" | "assistant"; content: string }[] = []
): Promise<string | null> {
  const viaSidecar = await callAIService(question, history);
  if (viaSidecar) return viaSidecar;

  if (env.GEMINI_API_KEY) {
    const context = await buildContext(question);
    return callGemini(question, context);
  }
  return null;
}

/** Persist a conversation turn (question + answer) keyed by session. */
export async function logTurn(
  sessionKey: string,
  userId: string | null,
  question: string,
  answer: string,
  source: string
) {
  const now = new Date();
  let convo = sessionKey ? await AssistantConversation.findOne({ sessionKey }) : null;
  if (!convo) {
    convo = await AssistantConversation.create({
      sessionKey: sessionKey || "",
      user: userId || null,
      messages: [],
      lastAt: now,
    });
  }
  convo.messages.push({ role: "user", text: question, source: "", createdAt: now } as any);
  convo.messages.push({ role: "assistant", text: answer, source, createdAt: now } as any);
  convo.lastAt = now;
  if (userId && !convo.user) convo.user = userId as any;
  await convo.save();
  return convo;
}
