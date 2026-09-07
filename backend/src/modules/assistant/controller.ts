import type { Request, Response } from "express";
import { AssistantConfig, AssistantQA, AssistantConversation } from "../../models/Assistant.js";
import { llmConfigured, llmAnswer, logTurn } from "./service.js";
import { ApiError } from "../../utils/asyncHandler.js";

/** The assistant config is a singleton; create the default row on first read. */
async function getOrCreateConfig() {
  let cfg = await AssistantConfig.findOne({ key: "singleton" });
  if (!cfg) cfg = await AssistantConfig.create({ key: "singleton" });
  return cfg;
}

function serializeConfig(cfg: any) {
  return {
    enabled: cfg.enabled !== false,
    name: cfg.name || "Ara",
    greeting: cfg.greeting || "",
    suggested_questions: cfg.suggestedQuestions || [],
    llm_enabled: llmConfigured(),
  };
}

function serializeQA(q: any) {
  return {
    id: String(q._id),
    question: q.question,
    answer: q.answer,
    keywords: q.keywords || "",
    active: q.active !== false,
    order: q.order || 0,
  };
}

/* --------------------------------- Public --------------------------------- */

/** GET /api/assistant/config — config + active Q&A for client-side matching. */
export async function config(_req: Request, res: Response) {
  const cfg = await getOrCreateConfig();
  const qa = await AssistantQA.find({ active: true }).sort({ order: 1 });
  res.json({ ...serializeConfig(cfg), qa: qa.map(serializeQA) });
}

/** POST /api/assistant/log — record a client-resolved turn. */
export async function log(req: Request, res: Response) {
  const b = req.body || {};
  await logTurn(
    String(b.session_key || ""),
    req.user?._id ? String(req.user._id) : null,
    String(b.question || ""),
    String(b.answer || ""),
    String(b.source || "keyword")
  );
  res.status(201).json({ ok: true });
}

/**
 * POST /api/assistant/ask — server-side LLM answer.
 * Returns { answer, source } where source is "llm"; if no key is configured the
 * answer is null and source is "unavailable" so the client falls back to its
 * own keyword matching.
 */
export async function ask(req: Request, res: Response) {
  const question = String(req.body?.question || "").trim();
  if (!question) throw new ApiError(400, "question is required.");

  if (!llmConfigured()) {
    return res.json({ answer: null, source: "unavailable" });
  }
  const answer = await llmAnswer(question);
  if (!answer) {
    return res.json({ answer: null, source: "unavailable" });
  }
  await logTurn(
    String(req.body?.session_key || ""),
    req.user?._id ? String(req.user._id) : null,
    question,
    answer,
    "llm"
  );
  res.json({ answer, source: "llm" });
}

/* --------------------------------- Admin ---------------------------------- */

export async function adminGetConfig(_req: Request, res: Response) {
  const cfg = await getOrCreateConfig();
  res.json(serializeConfig(cfg));
}

export async function adminUpdateConfig(req: Request, res: Response) {
  const cfg = await getOrCreateConfig();
  const b = req.body || {};
  if (b.enabled !== undefined) cfg.enabled = !!b.enabled;
  if (b.name !== undefined) cfg.name = String(b.name);
  if (b.greeting !== undefined) cfg.greeting = String(b.greeting);
  if (b.suggested_questions !== undefined && Array.isArray(b.suggested_questions)) {
    cfg.suggestedQuestions = b.suggested_questions.map((s: unknown) => String(s));
  }
  await cfg.save();
  res.json(serializeConfig(cfg));
}

export async function adminListQA(_req: Request, res: Response) {
  const qa = await AssistantQA.find({}).sort({ order: 1, createdAt: 1 });
  res.json(qa.map(serializeQA));
}

export async function adminCreateQA(req: Request, res: Response) {
  const b = req.body || {};
  if (!b.question || !b.answer) throw new ApiError(400, "question and answer are required.");
  const qa = await AssistantQA.create({
    question: String(b.question),
    answer: String(b.answer),
    keywords: b.keywords || "",
    active: b.active !== false,
    order: b.order || 0,
  });
  res.status(201).json(serializeQA(qa));
}

export async function adminUpdateQA(req: Request, res: Response) {
  const qa = await AssistantQA.findById(req.params.id);
  if (!qa) throw new ApiError(404, "Q&A not found.");
  const b = req.body || {};
  if (b.question !== undefined) qa.question = String(b.question);
  if (b.answer !== undefined) qa.answer = String(b.answer);
  if (b.keywords !== undefined) qa.keywords = String(b.keywords);
  if (b.active !== undefined) qa.active = !!b.active;
  if (b.order !== undefined) qa.order = b.order;
  await qa.save();
  res.json(serializeQA(qa));
}

export async function adminDeleteQA(req: Request, res: Response) {
  const qa = await AssistantQA.findById(req.params.id);
  if (!qa) throw new ApiError(404, "Q&A not found.");
  await qa.deleteOne();
  res.status(204).end();
}

export async function adminListConversations(_req: Request, res: Response) {
  const convos = await AssistantConversation.find({})
    .sort({ lastAt: -1 })
    .limit(100)
    .populate("user", "username email");
  res.json(
    convos.map((c) => ({
      id: String(c._id),
      session_key: c.sessionKey,
      user: c.user ? { id: String((c.user as any)._id), username: (c.user as any).username } : null,
      message_count: c.messages.length,
      last_at: c.lastAt,
      created_at: (c as any).createdAt || null,
    }))
  );
}

export async function adminGetConversation(req: Request, res: Response) {
  const c = await AssistantConversation.findById(req.params.id).populate("user", "username email");
  if (!c) throw new ApiError(404, "Conversation not found.");
  res.json({
    id: String(c._id),
    session_key: c.sessionKey,
    user: c.user ? { id: String((c.user as any)._id), username: (c.user as any).username } : null,
    messages: c.messages.map((m: any) => ({
      role: m.role,
      text: m.text,
      source: m.source || "",
      created_at: m.createdAt,
    })),
    last_at: c.lastAt,
  });
}
