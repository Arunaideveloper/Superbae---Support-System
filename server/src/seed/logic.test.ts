/**
 * DB-free verification of the pure business logic — the parts where subtle bugs
 * hide: SLA math, serializers, slug uniqueness. Run: `npx tsx src/seed/logic.test.ts`.
 * (The full HTTP smoke test, src/seed/smoke.ts, needs a running MongoDB.)
 */
import { slaStatus } from "../modules/tickets/service.js";
import { serializeTicket, serializeUser, serializeArticle, roleOf } from "../utils/serialize.js";
import { slugify, uniqueSlug } from "../utils/slug.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, extra ?? ""); }
}

async function main() {
  const now = new Date("2026-01-10T12:00:00Z");

  // ---- SLA: fresh critical ticket, no response yet, within window ----
  const fresh = {
    _id: "a", priority: "critical", status: "open",
    createdAt: new Date("2026-01-10T11:55:00Z"), // 5 min ago; FR target 15 min
    firstResponseAt: null, resolvedAt: null,
  };
  const s1 = slaStatus(fresh, now);
  check("critical FR not breached at 5min", s1.first_response.breached === false, s1.first_response);
  check("critical FR ~10 min remaining", s1.first_response.minutes_remaining === 10, s1.first_response.minutes_remaining);

  // ---- SLA: overdue first response ----
  const overdue = { ...fresh, createdAt: new Date("2026-01-10T11:30:00Z") }; // 30 min ago > 15
  const s2 = slaStatus(overdue, now);
  check("critical FR breached at 30min unanswered", s2.first_response.breached === true, s2.first_response);
  check("breached FR minutes_remaining negative", (s2.first_response.minutes_remaining as number) < 0);

  // ---- SLA: answered in time -> not breached, met stamped ----
  const answered = { ...overdue, firstResponseAt: new Date("2026-01-10T11:40:00Z") }; // 10 min after create < 15
  const s3 = slaStatus(answered, now);
  check("FR met within window not breached", s3.first_response.breached === false, s3.first_response);
  check("FR met_at set, remaining null", !!s3.first_response.met_at && s3.first_response.minutes_remaining === null);

  // ---- SLA: resolved before resolution target ----
  const resolved = {
    _id: "b", priority: "low", status: "resolved",
    createdAt: new Date("2026-01-09T12:00:00Z"),
    firstResponseAt: new Date("2026-01-09T13:00:00Z"),
    resolvedAt: new Date("2026-01-10T06:00:00Z"), // 18h < low resolution 48h
  };
  const s4 = slaStatus(resolved, now);
  check("resolved within target not breached", s4.resolution.breached === false, s4.resolution);
  check("resolution.resolved true", s4.resolution.resolved === true);

  // ---- SLA: unknown priority falls back to DEFAULT ----
  const weird = { _id: "c", priority: "nope", status: "open", createdAt: now, firstResponseAt: null, resolvedAt: null };
  const s5 = slaStatus(weird, now);
  check("unknown priority uses default (240m FR)", s5.first_response.minutes_remaining === 240, s5.first_response);

  // ---- Serializers ----
  const userDoc = {
    _id: "u1", username: "amy", email: "a@b.c", isStaff: true, isSuperuser: false, isActive: true,
    createdAt: now, lastLoginAt: null,
  };
  const su = serializeUser(userDoc);
  check("serializeUser role agent for staff non-super", su!.role === "agent", su);
  check("serializeUser snake_case fields", su!.is_staff === true && su!.is_superuser === false);
  check("roleOf admin for superuser", roleOf({ isSuperuser: true }) === "admin");
  check("roleOf customer for plain", roleOf({ isStaff: false }) === "customer");

  const ticketDoc = {
    _id: "t1", subject: "Hi", description: "d", status: "open", priority: "high",
    category: "", subcategory: "", source: "web", team: "", tags: ["x"],
    createdBy: { _id: "u1", username: "amy", email: "a@b.c", isStaff: false, isSuperuser: false },
    assignedTo: null, firstResponseAt: null, resolvedAt: null, createdAt: now, updatedAt: now,
  };
  const st = serializeTicket(ticketDoc, { message_count: 3, sla: slaStatus(ticketDoc, now) });
  check("serializeTicket populated created_by ref", st.created_by?.username === "amy", st.created_by);
  check("serializeTicket assigned_to null passes through", st.assigned_to === null);
  check("serializeTicket includes message_count + sla", st.message_count === 3 && !!st.sla);

  const artDoc = {
    _id: "ar1", title: "T", slug: "t", body: "b",
    category: { _id: "c1", name: "Cat", slug: "cat" }, status: "published", visibility: "everyone",
    author: null, views: 5, publishedAt: now, createdAt: now, updatedAt: now,
  };
  const sa = serializeArticle(artDoc, { helpful_percent: 67, feedback_count: 3 });
  check("serializeArticle nests populated category", sa.category?.name === "Cat", sa.category);
  check("serializeArticle helpful_percent passthrough", sa.helpful_percent === 67);
  check("serializeArticle category_id extracted", sa.category_id === "c1", sa.category_id);

  // ---- Slugs ----
  check("slugify basic", slugify("Hello, World!") === "hello-world", slugify("Hello, World!"));
  check("slugify trims dashes", slugify("  --Ara & You--  ") === "ara-you", slugify("  --Ara & You--  "));
  check("slugify empty -> item", slugify("!!!") === "item");

  const taken = new Set(["welcome", "welcome-2"]);
  const u = await uniqueSlug("Welcome", async (x) => taken.has(x));
  check("uniqueSlug skips taken -> welcome-3", u === "welcome-3", u);
  const u2 = await uniqueSlug("Fresh One", async (x) => taken.has(x));
  check("uniqueSlug free -> fresh-one", u2 === "fresh-one", u2);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
