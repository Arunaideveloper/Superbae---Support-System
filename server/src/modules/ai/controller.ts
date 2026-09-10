import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/asyncHandler.js";

/**
 * Thin, staff-only proxy to the AI layer's /ai/usage/* analytics endpoints.
 * The AI layer gates those behind the X-AI-Admin-Key header; we attach it here
 * so the admin key never reaches the browser. Read-only (GET) by design.
 */
const FILTER_KEYS = ["provider_id", "model_id", "feature", "status", "start_at", "end_at"] as const;

function pickFilters(query: Request["query"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of FILTER_KEYS) {
    const v = query[k];
    if (typeof v === "string" && v !== "") out[k] = v;
  }
  return out;
}

async function proxyGet(path: string, filters: Record<string, string>) {
  if (!env.AI_SERVICE_URL) throw new ApiError(503, "AI analytics service is not configured.");
  const url = new URL(env.AI_SERVICE_URL.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(filters)) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(url, {
      headers: { ...(env.AI_ADMIN_API_KEY ? { "X-AI-Admin-Key": env.AI_ADMIN_API_KEY } : {}) },
      signal: controller.signal,
    });
    const text = await resp.text();
    if (!resp.ok) {
      // Hide the AI layer's auth details; surface a clean status to the client.
      throw new ApiError(resp.status === 401 ? 502 : resp.status, "AI analytics request failed.");
    }
    return text ? JSON.parse(text) : null;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, "Could not reach the AI analytics service.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function usageSummary(req: Request, res: Response) {
  res.json(await proxyGet("/ai/usage/summary", pickFilters(req.query)));
}
export async function usageByProvider(req: Request, res: Response) {
  res.json(await proxyGet("/ai/usage/by-provider", pickFilters(req.query)));
}
export async function usageByModel(req: Request, res: Response) {
  res.json(await proxyGet("/ai/usage/by-model", pickFilters(req.query)));
}
export async function usageByFeature(req: Request, res: Response) {
  res.json(await proxyGet("/ai/usage/by-feature", pickFilters(req.query)));
}

/* ---- generic proxy supporting a request body (for fraud analyze/update) ---- */
async function proxyJson(
  method: string,
  path: string,
  opts: { query?: Record<string, string>; body?: unknown } = {}
) {
  if (!env.AI_SERVICE_URL) throw new ApiError(503, "AI service is not configured.");
  const url = new URL(env.AI_SERVICE_URL.replace(/\/$/, "") + path);
  if (opts.query) for (const [k, v] of Object.entries(opts.query)) if (v != null && v !== "") url.searchParams.set(k, v);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      method,
      headers: {
        ...(env.AI_ADMIN_API_KEY ? { "X-AI-Admin-Key": env.AI_ADMIN_API_KEY } : {}),
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const text = await resp.text();
    if (!resp.ok) {
      let detail = "AI fraud request failed.";
      try { const j = JSON.parse(text); if (typeof j?.detail === "string") detail = j.detail; } catch { /* keep default */ }
      throw new ApiError(resp.status === 401 ? 502 : resp.status, detail);
    }
    return text ? JSON.parse(text) : null;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, "Could not reach the AI fraud service.");
  } finally {
    clearTimeout(timeout);
  }
}

/* ---- fraud detection (staff only) ---- */
export async function fraudList(req: Request, res: Response) {
  const q: Record<string, string> = {};
  for (const k of ["activity_id", "status", "limit", "offset"]) {
    const v = req.query[k];
    if (typeof v === "string" && v !== "") q[k] = v;
  }
  res.json(await proxyJson("GET", "/ai/fraud/assessments", { query: q }));
}

export async function fraudGet(req: Request, res: Response) {
  res.json(await proxyJson("GET", `/ai/fraud/assessments/${encodeURIComponent(req.params.id)}`));
}

export async function fraudAnalyze(req: Request, res: Response) {
  res.status(201).json(await proxyJson("POST", "/ai/fraud/analyze", { body: req.body }));
}

export async function fraudUpdate(req: Request, res: Response) {
  // Stamp the reviewer from the authenticated staff user unless one was supplied.
  const body = { ...(req.body || {}), reviewed_by: req.body?.reviewed_by || req.user?.username };
  res.json(await proxyJson("PUT", `/ai/fraud/assessments/${encodeURIComponent(req.params.id)}`, { body }));
}
