/**
 * Ara assistant logic. Ara works with zero configuration using the curated
 * Q&A knowledge base (client-side keyword matching). If a Gemini API key is
 * present in the server environment, the /ask endpoint additionally grounds an
 * LLM answer in the same Q&A plus published KB articles. No key => Ara simply
 * falls back to the built-in matching, so it always works.
 */
import { env } from "../../config/env.js";
import { AssistantQA, AssistantConversation } from "../../models/Assistant.js";
import { Article } from "../../models/Article.js";

export const SYSTEM_PROMPT = `You are Ara, the friendly AI stylist and support assistant for Superbae, a wardrobe and outfit-styling app.
Answer only using the provided CONTEXT (curated Q&A and help articles). Be warm, concise and practical.
If the context does not cover the question, say you are not sure and suggest contacting support or opening a ticket.
Never invent account details, prices or policies that are not in the context.`;

export function llmConfigured(): boolean {
  return !!env.GEMINI_API_KEY;
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

/** Call the Gemini REST API. Returns the answer text, or null on any failure. */
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

/** Produce an LLM-grounded answer if configured, else null (caller falls back). */
export async function llmAnswer(question: string): Promise<string | null> {
  if (!llmConfigured()) return null;
  const context = await buildContext(question);
  return callGemini(question, context);
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
