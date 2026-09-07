/**
 * End-to-end smoke test against an in-memory MongoDB. Exercises the real
 * Express app over HTTP: auth, users, tickets (+SLA/audit), KB (admin+public+
 * versioning+feedback) and the assistant. Run: `npx tsx src/seed/smoke.ts`.
 */
import mongoose from "mongoose";
import { createApp } from "../app.js";
import { runSeed } from "./seed.js";

/**
 * Connect strategy:
 *   - If MONGODB_URI is set, use that real MongoDB (recommended locally).
 *   - Otherwise spin up an in-memory MongoDB (needs internet to fetch the
 *     binary the first time).
 * Returns a stop() to tear whichever one down.
 */
async function connectForTest(): Promise<() => Promise<void>> {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    return async () => { await mongoose.disconnect(); };
  }
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());
  return async () => { await mongoose.disconnect(); await mem.stop(); };
}

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, extra ?? ""); }
}

async function main() {
  const stop = await connectForTest();
  const counts = await runSeed();
  console.log("Seeded:", counts);

  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.on("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;

  const call = async (method: string, path: string, body?: unknown, token?: string) => {
    const resp = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data: any = null;
    try { data = await resp.json(); } catch { /* 204 */ }
    return { status: resp.status, data };
  };

  // ---- Health ----
  const health = await call("GET", "/api/health");
  check("health ok", health.status === 200 && health.data.status === "ok");

  // ---- Auth ----
  const login = await call("POST", "/api/login", { username: "admin", password: "admin123" });
  check("admin login", login.status === 200 && !!login.data.access, login.data);
  const adminToken = login.data.access;

  const me = await call("GET", "/api/me", undefined, adminToken);
  check("me returns admin", me.status === 200 && me.data.role === "admin", me.data);

  const badLogin = await call("POST", "/api/login", { username: "admin", password: "wrong" });
  check("bad password rejected", badLogin.status === 401);

  const reg = await call("POST", "/api/register", { username: "newbie", password: "pass1234", email: "n@x.com" });
  check("register new customer", reg.status === 201 && reg.data.user.role === "customer", reg.data);
  const custToken = reg.data.access;

  const refreshed = await call("POST", "/api/refresh", { refresh: reg.data.refresh });
  check("refresh issues access", refreshed.status === 200 && !!refreshed.data.access);

  // ---- Users (staff only) ----
  const usersForbidden = await call("GET", "/api/users", undefined, custToken);
  check("customer blocked from users list", usersForbidden.status === 403);

  const usersList = await call("GET", "/api/users", undefined, adminToken);
  check("admin lists users", usersList.status === 200 && Array.isArray(usersList.data), usersList.data);

  const createAgent = await call("POST", "/api/users",
    { username: "agent2", password: "agent2pass", role: "agent" }, adminToken);
  check("admin creates agent", createAgent.status === 201 && createAgent.data.role === "agent", createAgent.data);

  const blocked = await call("PATCH", `/api/users/${createAgent.data.id}`, { is_active: false }, adminToken);
  check("admin blocks user", blocked.status === 200 && blocked.data.is_active === false, blocked.data);

  const agentsOnly = await call("GET", "/api/users?role=agent", undefined, adminToken);
  check("filter users by role=agent", agentsOnly.status === 200 && agentsOnly.data.every((u: any) => u.role === "agent"),
    agentsOnly.data);

  // ---- Tickets ----
  const created = await call("POST", "/api/tickets",
    { subject: "Can't log in", description: "help", priority: "critical" }, custToken);
  check("customer creates ticket", created.status === 201 && created.data.status === "open", created.data);
  const ticketId = created.data.id;
  check("new ticket has SLA", !!created.data.sla?.first_response?.due_at, created.data.sla);

  const list = await call("GET", "/api/tickets", undefined, adminToken);
  check("admin lists tickets (paginated)", list.status === 200 && typeof list.data.count === "number", list.data);

  const custList = await call("GET", "/api/tickets", undefined, custToken);
  check("customer sees only own tickets", custList.data.results.every((t: any) => t.created_by.id === reg.data.user.id),
    custList.data);

  // Staff reply stamps first response
  const reply = await call("POST", `/api/tickets/${ticketId}/messages`, { body: "Looking into it" }, adminToken);
  check("staff reply created", reply.status === 201 && reply.data.is_internal === false, reply.data);

  const note = await call("POST", `/api/tickets/${ticketId}/messages`,
    { body: "internal note", is_internal: true }, adminToken);
  check("staff internal note created", note.status === 201 && note.data.is_internal === true, note.data);

  const custView = await call("GET", `/api/tickets/${ticketId}`, undefined, custToken);
  check("customer does NOT see internal note",
    custView.status === 200 && custView.data.messages.every((m: any) => m.is_internal === false), custView.data);
  check("first response stamped after staff reply", !!custView.data.first_response_at, custView.data.first_response_at);

  const adminView = await call("GET", `/api/tickets/${ticketId}`, undefined, adminToken);
  check("admin sees internal note + events",
    adminView.data.messages.some((m: any) => m.is_internal) && adminView.data.events.length > 0, {
      msgs: adminView.data.messages.length, events: adminView.data.events.length,
    });

  const statusChange = await call("POST", `/api/tickets/${ticketId}/status`, { status: "resolved" }, adminToken);
  check("status change to resolved stamps resolved_at",
    statusChange.status === 200 && statusChange.data.status === "resolved" && !!statusChange.data.resolved_at,
    statusChange.data);

  const assign = await call("POST", `/api/tickets/${ticketId}/assign`, { assigned_to: createAgent.data.id }, adminToken);
  check("assign ticket", assign.status === 200 && assign.data.assigned_to?.id === createAgent.data.id, assign.data);

  const stats = await call("GET", "/api/tickets/stats", undefined, adminToken);
  check("ticket stats", stats.status === 200 && typeof stats.data.total === "number" && !!stats.data.by_status,
    stats.data);

  const custPriorityBlocked = await call("POST", `/api/tickets/${ticketId}/priority`, { priority: "low" }, custToken);
  check("customer blocked from priority endpoint", custPriorityBlocked.status === 403);

  // ---- KB admin ----
  const kbStats = await call("GET", "/api/kb/stats", undefined, adminToken);
  check("kb stats", kbStats.status === 200 && kbStats.data.published >= 1, kbStats.data);

  const cats = await call("GET", "/api/kb/categories", undefined, adminToken);
  check("kb categories seeded", cats.status === 200 && cats.data.length >= 5, cats.data?.length);

  const artList = await call("GET", "/api/kb/articles", undefined, adminToken);
  check("kb articles seeded", artList.status === 200 && artList.data.length >= 8, artList.data?.length);

  const newArt = await call("POST", "/api/kb/articles",
    { title: "Test Draft Article", body: "v1 body", status: "draft" }, adminToken);
  check("create draft article", newArt.status === 201 && newArt.data.status === "draft", newArt.data);
  const artId = newArt.data.id;

  const edit1 = await call("PATCH", `/api/kb/articles/${artId}`, { body: "v2 body" }, adminToken);
  check("edit article body", edit1.status === 200 && edit1.data.body === "v2 body", edit1.data);

  const versions = await call("GET", `/api/kb/articles/${artId}/versions`, undefined, adminToken);
  check("versions snapshot on content change", versions.status === 200 && versions.data.length >= 2,
    versions.data?.length);

  const restore = await call("POST", `/api/kb/articles/${artId}/restore`,
    { version: versions.data.find((v: any) => v.number === 1).id }, adminToken);
  check("restore v1 body", restore.status === 200 && restore.data.body === "v1 body", restore.data);

  const publish = await call("PATCH", `/api/kb/articles/${artId}`, { status: "published" }, adminToken);
  check("publish article stamps published_at", publish.status === 200 && !!publish.data.published_at, publish.data);

  // ---- KB public (no auth) ----
  const pubCats = await call("GET", "/api/public/kb/categories");
  check("public categories (published only)", pubCats.status === 200 && pubCats.data.length >= 1, pubCats.data?.length);

  const pubArts = await call("GET", "/api/public/kb/articles");
  check("public articles list", pubArts.status === 200 && pubArts.data.length >= 8, pubArts.data?.length);

  const firstSlug = pubArts.data[0].slug;
  const pubArt1 = await call("GET", `/api/public/kb/articles/${firstSlug}`);
  const pubArt2 = await call("GET", `/api/public/kb/articles/${firstSlug}`);
  check("public article view count increments",
    pubArt1.status === 200 && pubArt2.data.views === pubArt1.data.views + 1,
    { v1: pubArt1.data.views, v2: pubArt2.data.views });

  const fb1 = await call("POST", `/api/public/kb/articles/${pubArt1.data.id}/feedback`, { helpful: true });
  const fb2 = await call("POST", `/api/public/kb/articles/${pubArt1.data.id}/feedback`, { helpful: false });
  check("public feedback accepted", fb1.status === 201 && fb2.status === 201);

  const afterFb = await call("GET", `/api/public/kb/articles/${firstSlug}`);
  check("helpful percent computed", afterFb.data.helpful_percent === 50, afterFb.data.helpful_percent);

  // ---- Assistant ----
  const cfg = await call("GET", "/api/assistant/config");
  check("assistant config + qa", cfg.status === 200 && cfg.data.qa.length >= 6 && cfg.data.name === "Ara", {
    qa: cfg.data.qa?.length, llm: cfg.data.llm_enabled,
  });
  check("assistant llm disabled without key", cfg.data.llm_enabled === false);

  const ask = await call("POST", "/api/assistant/ask", { question: "How do I add clothes?", session_key: "s1" });
  check("ask returns unavailable without key (client falls back)",
    ask.status === 200 && ask.data.answer === null && ask.data.source === "unavailable", ask.data);

  const logTurn = await call("POST", "/api/assistant/log",
    { session_key: "s1", question: "How do I add clothes?", answer: "Tap +", source: "keyword" });
  check("assistant log turn", logTurn.status === 201);

  const convos = await call("GET", "/api/assistant/admin/conversations", undefined, adminToken);
  check("admin lists conversations", convos.status === 200 && convos.data.length >= 1, convos.data?.length);

  const adminQA = await call("POST", "/api/assistant/admin/qa",
    { question: "Q?", answer: "A." }, adminToken);
  check("admin creates QA", adminQA.status === 201, adminQA.data);

  // ---- Auth gating sanity ----
  const noToken = await call("GET", "/api/tickets");
  check("tickets require auth", noToken.status === 401);

  const notFound = await call("GET", "/api/does-not-exist");
  check("404 handler", notFound.status === 404);

  server.close();
  await stop();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
