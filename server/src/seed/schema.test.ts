/**
 * DB-free tests for the Zod request schemas. Run: `npx tsx src/seed/schema.test.ts`.
 * Guards the API contract: required fields, enums, lengths and coercions.
 */
import {
  registerSchema, loginSchema, createTicketSchema, updateTicketSchema,
  statusSchema, createArticleSchema, feedbackSchema, qaSchema, askSchema, assignSchema,
} from "../schemas.js";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, extra ?? ""); }
}
const good = (s: any, v: unknown) => s.safeParse(v).success;
const bad = (s: any, v: unknown) => !s.safeParse(v).success;

// register
ok("register accepts valid", good(registerSchema, { username: "amy", password: "secret1" }));
ok("register rejects short password", bad(registerSchema, { username: "amy", password: "x" }));
ok("register rejects missing username", bad(registerSchema, { password: "secret1" }));
ok("register rejects bad email", bad(registerSchema, { username: "amy", password: "secret1", email: "nope" }));
ok("register allows empty email string", good(registerSchema, { username: "amy", password: "secret1", email: "" }));

// login
ok("login requires both fields", bad(loginSchema, { username: "amy" }));

// tickets
ok("createTicket needs subject", bad(createTicketSchema, { description: "hi" }));
ok("createTicket ok minimal", good(createTicketSchema, { subject: "Help" }));
ok("createTicket rejects bad priority", bad(createTicketSchema, { subject: "Help", priority: "urgent" }));
ok("createTicket accepts valid priority", good(createTicketSchema, { subject: "Help", priority: "critical" }));
ok("createTicket rejects bad requester id", bad(createTicketSchema, { subject: "Help", requester: "123" }));
ok("createTicket accepts 24-hex requester", good(createTicketSchema, { subject: "Help", requester: "a".repeat(24) }));

// updateTicket requires at least one field
ok("updateTicket rejects empty", bad(updateTicketSchema, {}));
ok("updateTicket accepts status only", good(updateTicketSchema, { status: "resolved" }));
ok("status endpoint rejects invalid", bad(statusSchema, { status: "done" }));
ok("assign accepts null (unassign)", good(assignSchema, { assigned_to: null }));
ok("assign rejects non-id", bad(assignSchema, { assigned_to: "x" }));

// articles
ok("createArticle needs title", bad(createArticleSchema, { body: "text" }));
ok("createArticle ok", good(createArticleSchema, { title: "Guide" }));
ok("createArticle rejects bad status", bad(createArticleSchema, { title: "Guide", status: "live" }));

// feedback
ok("feedback needs boolean helpful", bad(feedbackSchema, { helpful: "yes" }));
ok("feedback ok", good(feedbackSchema, { helpful: true }));

// qa & ask
ok("qa needs question+answer", bad(qaSchema, { question: "Q?" }));
ok("qa ok", good(qaSchema, { question: "Q?", answer: "A." }));
ok("ask needs question", bad(askSchema, { session_key: "s" }));
ok("ask ok", good(askSchema, { question: "How?" }));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
