import type {
  Me, Ticket, TicketInput, TicketUpdate,
  TicketListRow, TicketDetail, TicketMessage, TicketEvent, TicketStats, AdminUser,
  TeamStatsResponse, EscalationsResponse, SlaReportResponse,
  KbCategory, KbArticle,
  UsageSummary, UsageBreakdown,
  FraudAssessment, FraudListResponse,
} from "@/lib/types";

const BASE = "/api";

/* ---- token storage (SSR-safe) ---- */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access");
}
export function setTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
}
export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export class UnauthorizedError extends Error {}
export class NotFoundError extends Error {}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  if (res.status === 401) throw new UnauthorizedError("unauthorized");
  return res;
}

function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") u.append(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

/* ---- contract normalizers (server serializes refs as objects) ---- */
function nameOf(v: any): string { if (!v) return ""; if (typeof v === "string") return v; return v.username ?? ""; }
function nameOrNull(v: any): string | null { if (!v) return null; if (typeof v === "string") return v; return v.username ?? null; }
function normRow(t: any): TicketListRow { return { ...t, created_by: nameOf(t.created_by), assigned_to: nameOrNull(t.assigned_to) }; }
function normLegacyTicket(t: any): Ticket { return { ...t, created_by: nameOf(t.created_by) }; }
function normMessage(m: any): TicketMessage { return { ...m, author: nameOf(m.author) }; }
function normEvent(e: any): TicketEvent { return { ...e, actor: nameOrNull(e.actor) }; }
function normDetail(d: any): TicketDetail {
  return {
    ...d,
    messages: Array.isArray(d.messages) ? d.messages.map(normMessage) : [],
    events: Array.isArray(d.events) ? d.events.map(normEvent) : [],
  };
}

/* ---- auth ---- */
export async function login(username: string, password: string): Promise<{ access: string; refresh: string }> {
  const res = await fetch(`${BASE}/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("invalid");
  return res.json();
}
export async function getMe(): Promise<Me> {
  const res = await request("/me/");
  if (!res.ok) throw new UnauthorizedError("unauthorized");
  return res.json();
}

/* ---- legacy simple ticket calls (user-facing) ---- */
export async function listTickets(): Promise<Ticket[]> {
  const res = await request("/tickets/?page_size=100");
  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.results ?? [];
  return rows.map(normLegacyTicket);
}
export async function createTicket(payload: TicketInput): Promise<Ticket> {
  const res = await request("/tickets/", { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("create failed");
  return normLegacyTicket(await res.json());
}
export async function updateTicket(id: number | string, payload: TicketUpdate): Promise<Ticket> {
  const res = await request(`/tickets/${id}/`, { method: "PATCH", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("update failed");
  return normLegacyTicket(await res.json());
}

/* ---- rich workspace calls ---- */
export async function fetchTickets(
  params: { assigned?: string; search?: string; status?: string; priority?: string } = {}
): Promise<TicketListRow[]> {
  const { assigned, ...rest } = params;
  const query = qs({ ...rest, assigned_to: assigned });
  const res = await request(`/tickets/${query}`);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.results ?? [];
  return rows.map(normRow);
}
export async function fetchTicket(id: number | string): Promise<TicketDetail> {
  const res = await request(`/tickets/${id}/`);
  if (!res.ok) throw new Error("load failed");
  return normDetail(await res.json());
}
export async function postTicketMessage(id: number | string, body: string, isInternal: boolean): Promise<TicketMessage> {
  const res = await request(`/tickets/${id}/messages/`, { method: "POST", body: JSON.stringify({ body, is_internal: isInternal }) });
  if (!res.ok) throw new Error("send failed");
  return normMessage(await res.json());
}
export async function patchTicket(id: number | string, data: Record<string, unknown>): Promise<TicketDetail> {
  const res = await request(`/tickets/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("update failed");
  return fetchTicket(id);
}
export async function assignTicket(id: number | string, assignedTo: string | null): Promise<TicketDetail> {
  const res = await request(`/tickets/${id}/assign/`, { method: "POST", body: JSON.stringify({ assigned_to: assignedTo }) });
  if (!res.ok) throw new Error("assign failed");
  return fetchTicket(id);
}
export async function adminCreateTicket(payload: { subject: string; description?: string; priority: string; requester?: string; category?: string }): Promise<TicketDetail> {
  const res = await request("/tickets/", { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) {
    let msg = "Could not create ticket.";
    try { const j = await res.json(); const parts = Object.values(j).flat(); if (parts.length) msg = parts.join(" "); } catch {}
    throw new Error(msg);
  }
  return normDetail(await res.json());
}
export async function fetchTicketStats(): Promise<TicketStats> {
  const res = await request("/tickets/stats/");
  const s = await res.json();
  return { all: s.all ?? s.total ?? 0, mine: s.mine ?? 0, unassigned: s.unassigned ?? 0, by_status: s.by_status ?? {} };
}

/* ---- admin: users ---- */
export async function fetchUsers(role?: string): Promise<AdminUser[]> {
  const res = await request(`/users/${qs({ role })}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}
export async function createUser(payload: { username: string; email: string; password: string; role: string }): Promise<AdminUser> {
  const res = await request("/users/", { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) {
    let msg = "Could not create user.";
    try { const j = await res.json(); const parts = Object.values(j).flat(); if (parts.length) msg = parts.join(" "); } catch {}
    throw new Error(msg);
  }
  return res.json();
}
export async function updateUser(id: number | string, data: Record<string, unknown>): Promise<AdminUser> {
  const res = await request(`/users/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Could not update user.");
  return res.json();
}

/* ---- staff dashboards ---- */
export async function fetchTeamStats(): Promise<TeamStatsResponse> {
  const res = await request("/teams/stats/");
  if (!res.ok) throw new Error("load failed");
  const data = await res.json();
  return { teams: data.teams ?? [], agents: data.agents ?? [] };
}
export async function fetchEscalations(): Promise<EscalationsResponse> {
  const res = await request("/tickets/escalations/");
  if (!res.ok) throw new Error("load failed");
  const data = await res.json();
  return { count: data.count ?? 0, critical: data.critical ?? 0, breached: data.breached ?? 0, results: data.results ?? [] };
}
export async function fetchSlaReport(): Promise<SlaReportResponse> {
  const res = await request("/tickets/sla-report/");
  if (!res.ok) throw new Error("load failed");
  return res.json();
}

/* ---- public knowledge base (no auth required) ---- */
export async function publicCategories(): Promise<KbCategory[]> {
  const res = await fetch(`${BASE}/public/kb/categories`);
  if (!res.ok) throw new Error("load failed");
  return res.json();
}
export async function publicArticles(params: { category?: string; search?: string } = {}): Promise<KbArticle[]> {
  const res = await fetch(`${BASE}/public/kb/articles${qs(params)}`);
  if (!res.ok) throw new Error("load failed");
  return res.json();
}
export async function publicArticle(idOrSlug: string): Promise<KbArticle> {
  const res = await fetch(`${BASE}/public/kb/articles/${encodeURIComponent(idOrSlug)}`);
  if (res.status === 404) throw new NotFoundError("not found");
  if (!res.ok) throw new Error("load failed");
  return res.json();
}
export async function submitArticleFeedback(idOrSlug: string, helpful: boolean, comment = ""): Promise<void> {
  await fetch(`${BASE}/public/kb/articles/${encodeURIComponent(idOrSlug)}/feedback`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ helpful, comment }),
  });
}

/* ---- Ara assistant (public; optional auth attributes the turn) ---- */
export async function assistantAsk(
  question: string,
  sessionKey = ""
): Promise<{ answer: string | null; source: string }> {
  try {
    const res = await fetch(`${BASE}/assistant/ask`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ question, session_key: sessionKey }),
    });
    if (!res.ok) return { answer: null, source: "unavailable" };
    return res.json();
  } catch {
    return { answer: null, source: "unavailable" };
  }
}

/* ---- admin knowledge base (staff only) ---- */
async function kbErr(res: Response, fallback: string): Promise<string> {
  try { const j = await res.json(); return j?.detail || fallback; } catch { return fallback; }
}

export async function kbListArticles(params: { status?: string; category?: string; search?: string } = {}): Promise<KbArticle[]> {
  const res = await request(`/kb/articles${qs(params)}`);
  if (!res.ok) throw new Error("Could not load articles.");
  return res.json();
}
export async function kbCreateArticle(payload: { title: string; body?: string; category?: string | null; status?: string; visibility?: string }): Promise<KbArticle> {
  const res = await request(`/kb/articles`, { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await kbErr(res, "Could not create the article."));
  return res.json();
}
export async function kbUpdateArticle(id: string, payload: Record<string, unknown>): Promise<KbArticle> {
  const res = await request(`/kb/articles/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await kbErr(res, "Could not update the article."));
  return res.json();
}
export async function kbDeleteArticle(id: string): Promise<void> {
  const res = await request(`/kb/articles/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(await kbErr(res, "Could not delete the article."));
}
export async function kbListCategoriesAdmin(): Promise<KbCategory[]> {
  const res = await request(`/kb/categories`);
  if (!res.ok) throw new Error("Could not load categories.");
  return res.json();
}
export async function kbCreateCategory(payload: { name: string; description?: string; icon?: string; color?: string; order?: number }): Promise<KbCategory> {
  const res = await request(`/kb/categories`, { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await kbErr(res, "Could not create the category."));
  return res.json();
}
export async function kbUpdateCategory(id: string, payload: Record<string, unknown>): Promise<KbCategory> {
  const res = await request(`/kb/categories/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await kbErr(res, "Could not update the category."));
  return res.json();
}
export async function kbDeleteCategory(id: string): Promise<void> {
  const res = await request(`/kb/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(await kbErr(res, "Could not delete the category."));
}

/* ---- AI usage analytics (staff only) ---- */
export async function fetchAiUsageSummary(): Promise<UsageSummary> {
  const res = await request("/ai/usage/summary");
  if (!res.ok) throw new Error("Could not load AI usage summary.");
  return res.json();
}
export async function fetchAiUsageBreakdown(dim: "provider" | "model" | "feature"): Promise<UsageBreakdown[]> {
  const res = await request(`/ai/usage/by-${dim}`);
  if (!res.ok) throw new Error("Could not load AI usage breakdown.");
  return res.json();
}

/* ---- AI fraud detection (staff only) ---- */
export async function listFraudAssessments(params: { status?: string } = {}): Promise<FraudListResponse> {
  const res = await request(`/ai/fraud/assessments${qs(params)}`);
  if (!res.ok) throw new Error("Could not load fraud assessments.");
  return res.json();
}
export async function analyzeFraud(activity: Record<string, unknown>): Promise<FraudAssessment> {
  const res = await request("/ai/fraud/analyze", { method: "POST", body: JSON.stringify(activity) });
  if (!res.ok) {
    let msg = "Fraud analysis failed.";
    try { const j = await res.json(); if (j?.detail) msg = j.detail; } catch {}
    throw new Error(msg);
  }
  return res.json();
}
export async function updateFraudAssessment(
  id: string,
  payload: { investigation_status: string; review_notes?: string }
): Promise<FraudAssessment> {
  const res = await request(`/ai/fraud/assessments/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("Could not update the assessment.");
  return res.json();
}

/* ---- public guest ticket (no auth) ---- */
export interface PublicTicketResult {
  id: string; reference: string; subject: string; status: string;
  email: string; emailed: boolean; emailConfigured: boolean; createdAt: string;
}
export async function createPublicTicket(payload: { name?: string; email: string; subject: string; description?: string }): Promise<PublicTicketResult> {
  const res = await fetch(`${BASE}/public/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = "Could not submit your request. Please try again.";
    try { const j = await res.json(); if (j?.detail) msg = j.detail; } catch {}
    throw new Error(msg);
  }
  return res.json();
}
