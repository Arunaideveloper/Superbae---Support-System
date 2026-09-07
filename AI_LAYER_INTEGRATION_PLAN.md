# Superbae — AI Layer Integration Plan

**Goal:** Fold the `superbae-ai-feature-customer-support-bot` project (the shared
AI layer) into the **Superbae Support System** (the main product), so the product's
"Ara" assistant is powered by the real RAG engine, and the AI admin/usage/fraud/
recommendation capabilities appear inside the product's admin dashboard.

**Status:** Proposed plan — no code changed yet. Approve, then execute.

**Author:** Analysis by Claude · Date: 2026-09-02

---

## 1. Executive summary

The two repositories are the **same feature at two maturity levels** and were
explicitly designed to be merged. The AI project's own README states the main
Superbae backend should own auth, durable persistence, and audit storage, while
the AI layer provides the routing, RAG, and provider adapters through injectable
boundaries. This plan keeps the Python AI layer as a **sidecar microservice** and
wires the Support System's Express backend to it. We do **not** rewrite the Python
in Node — that would discard FAISS, sentence-transformers, and 132 passing tests.

Two decisions drive the whole plan:

1. **Canonical stack:** consolidate the Support System on **`server` + `web`**
   (see §2). Archive `backend` + `frontend`.
2. **Integration style:** **sidecar** — the AI service runs as its own container;
   Express calls it over HTTP. Minimal blast radius, reversible, respects the AI
   layer's designed boundaries.

---

## 2. Which Support System stack for production — and why

The Support System currently ships **two divergent copies** of itself:

| Concern | `server` + `web` (RECOMMENDED) | `backend` + `frontend` |
|---|---|---|
| Security middleware | helmet, express-rate-limit, Zod request validation | none of these |
| Automated tests | logic + schema unit tests + real-MongoDB smoke test in CI | typecheck only |
| Features | adds Teams module; richer UI (article editor, ticket detail, users manager); (app)/(customer) route groups | fewer modules/components |
| Framework version | Next 14 / React 18 | Next 15 / React 19 |
| Pointed to by README / docker-compose / docs | No | Yes |
| Last modified | Newest files in repo | Older |

**Recommendation: make `server` + `web` canonical.** For production, security,
validation, and test coverage matter far more than being on the newest Next
release. Next 14 / React 18 is a mature, fully production-ready baseline. The one
thing `backend`/`frontend` has that's worth keeping — the Next 15 / React 19
upgrade — is a small, contained follow-up we can port onto `web` later. Adopting
the weaker stack to get a newer framework version would be trading away real
production readiness for a cosmetic version bump.

**Actions:**
- Move `backend/` and `frontend/` into `_archive_tgz/` (or delete after a tagged
  snapshot). Keep only if you explicitly want the React 19 reference.
- Rewrite the root `README.md`, `docker-compose.yml`, and `docs/` to describe
  `server` + `web` only (today they describe `backend` + `frontend`).
- Delete the stale `.github/workflows/backend.yml` and `frontend.yml`; keep
  `superbae-ci.yml` (the "new stack" workflow), and remove its `paths:` filter so
  it runs as the primary CI.

> Do this consolidation **before** wiring in the AI layer, so we integrate once.

---

## 3. Target architecture

```
                       Browser (web — Next.js)
                                |
                     /api/*  (same-origin proxy)
                                v
        +------------------------------------------------+
        |   Support System backend  (server — Express)   |
        |   auth · tickets · KB · teams · users          |
        |   assistant module  <-- integration seam       |
        +------------------------------------------------+
             |  (owns auth, Mongo persistence, audit)
             |  internal HTTP + X-AI-Admin-Key
             v
        +------------------------------------------------+
        |   AI layer  (FastAPI — Python, sidecar)        |
        |   POST /chat  (RAG: FAISS + embeddings)        |
        |   /ai/providers · /ai/models · /ai/services    |
        |   /ai/usage/* · /ai/fraud/* · /ai/recommend/*  |
        +------------------------------------------------+
             |                         ^
             v                         | injected implementations
        Provider APIs             AIConfigurationRepository
      (OpenAI/Gemini/            AIUsageRepository · AuditSink
       OpenRouter)               PricingCatalog  --> MongoDB
```

Key principle from the AI layer's README, preserved here: the AI service does
**not** create a competing database. The Support System's MongoDB stays the single
source of durable truth; the AI service reaches it only through injected repository
implementations, or (simpler first cut) the Express backend proxies and persists.

---

## 4. The integration seam (exact files)

The Support System's assistant already has one clean plug-in point.

- `server/src/modules/assistant/service.ts` → `llmAnswer(question)` is the single
  function that produces an LLM answer today (currently a direct Gemini call in
  `callGemini`). **This is where the RAG service call goes.**
- `server/src/modules/assistant/controller.ts` → `ask()` already handles a `null`
  answer by returning `{ answer: null, source: "unavailable" }`, so the client
  falls back to keyword matching. Fallback behavior needs no change.
- `web/src/lib/api.ts` → `assistantAsk()` already posts `{ question, session_key }`
  to `/api/assistant/ask`. No frontend change needed for the chat path.
- `web/next.config.mjs` already proxies `/api/*` to the Express backend.

So the minimum viable integration is: **replace the body of `llmAnswer()`** to POST
to the Python service's `/chat` (passing conversation history for context), map its
`{ response }` back to a string, and keep the existing null-on-failure contract.

---

## 5. Phased execution

### Phase 0 — Consolidate (prerequisite)
Archive `backend`/`frontend`; repoint README, docker-compose, docs, CI to
`server`/`web`. Verify `server` typecheck + tests + smoke, and `web` build, still pass.

### Phase 1 — Run the AI layer as a sidecar
- Add a `Dockerfile` for the Python service (`superbae-ai/`), copying the AI project
  in as a new top-level folder of the Support System (e.g. `ai-layer/`).
- Add an `ai` service to `docker-compose.yml` alongside `mongo`, `backend`(=server),
  `web`. Expose it on an internal port only (not published to the host in prod).
- Build the FAISS index at image build or first boot (`python build_index.py` over
  `knowledge_sources/`). Confirm `GEMINI_MODEL` default is a real, current model id
  — the project currently defaults to `gemini-3.1-flash-lite`, which must be verified.

### Phase 2 — Wire the chat path
- In `server`, add `AI_SERVICE_URL` and `AI_ADMIN_API_KEY` to `env.ts` + `.env.example`.
- Rewrite `llmAnswer()` to call `POST {AI_SERVICE_URL}/chat` with `{ message, history }`.
  Pull recent turns from the existing `AssistantConversation` to populate `history`.
- Keep `llmConfigured()` meaning "AI service reachable/enabled" so the graceful
  fallback and `/config`'s `llm_enabled` flag still work.
- Update Zod `askSchema` only if we start accepting history from the client (optional;
  history can be assembled server-side from `session_key`).

### Phase 3 — Persist the injectable boundaries (durable, not in-memory)
Implement, against Mongo, the adapters the AI layer leaves open (today they are
in-memory and reset on restart):
- `AIConfigurationRepository` → providers/models/services/runtime settings + version.
- `AIUsageRepository` → safe, content-free usage events (AI-003).
- `AuditSink` → admin-change audit trail into the Support System's audit storage.
- `PricingCatalog` (optional) → USD/million-token rates for cost estimates.
First cut can keep these in the Python process; production cut injects Mongo-backed
implementations (or has Express own them and the AI layer call back).

### Phase 4 — Surface AI admin in the real dashboard
- Delete the AI project's temporary Vite `frontend/` (README says it is not a
  security boundary).
- Add admin pages under `web/src/app/(app)/` for: AI providers/models/services,
  usage & cost analytics, fraud assessments, and recommendation rules/templates.
- Express proxies `/api/ai/*` → Python `/ai/*`, gating with the existing
  `requireStaff` middleware and attaching `X-AI-Admin-Key` server-side (the key
  never reaches the browser).

### Phase 5 — Knowledge base reconciliation (single source of truth)
The AI layer's `knowledge_sources/` PDFs/docx overlap with the Support System's
`Superbae Design/` files (Fits, me Section, Knowledge Base). Pick one canonical
location, and decide whether the RAG index is built from those files, from the
product's own published KB `Article` collection, or both. Long term, feeding the
live KB into the index keeps Ara's answers in sync with what agents publish.

### Phase 6 — CI, docs, verification
- Extend `superbae-ci.yml` with a Python job: `python -m unittest discover -s tests`.
- Add an integration smoke test: boot Mongo + Express + AI sidecar, hit
  `/api/assistant/ask`, assert a grounded answer or a clean fallback.
- Rewrite docs to reflect the merged system.

---

## 6. Security & auth

- The browser never sees `AI_ADMIN_API_KEY`; only Express holds it and forwards it.
- All `/api/ai/*` admin routes go through the Support System's `requireStaff`.
- The AI sidecar is not published to the host in production — only Express reaches it.
- Keep the AI layer's guarantees intact: prompts/responses/keys are never logged,
  returned, or stored in usage events; `hmac.compare_digest` for the admin key.
- Confirm no `.env` with real secrets is ever committed (the stray `server/.env`
  today holds only placeholders — verify before pushing to a real remote).

---

## 7. Risks & open questions

1. **Model id default** — `gemini-3.1-flash-lite` must be verified as a real model.
2. **Index build cost** — FAISS + sentence-transformers pulls a sizable model; the
   image gets large and first boot is slow. Consider prebuilding the index artifact.
3. **Two runtimes** — Node + Python raises ops complexity. Sidecar keeps them
   decoupled, but deployment now needs both. (Still cheaper than a Python rewrite.)
4. **Next 14 vs 15** — decide whether to port the React 19 upgrade onto `web` now
   or defer. Recommended: defer; it's independent of this merge.
5. **History semantics** — assemble chat history server-side from `session_key`
   vs trusting the client. Server-side is safer and matches existing persistence.
6. **In-memory config resets** — until Phase 3, AI admin changes reset on restart.
   Acceptable for a first internal cut; must be done before real admin use.

---

## 8. Rough effort

| Phase | Scope | Est. |
|---|---|---|
| 0 | Consolidate stacks, repoint docs/CI | ~0.5 day |
| 1 | Dockerize AI sidecar, compose wiring, index build | ~1 day |
| 2 | Wire chat path through `llmAnswer()` | ~0.5 day |
| 3 | Mongo-backed repository/usage/audit adapters | ~2–3 days |
| 4 | Admin pages in `web` + Express proxy | ~2–3 days |
| 5 | KB reconciliation / live-KB indexing | ~1–2 days |
| 6 | CI, integration tests, docs | ~1 day |

A working end-to-end chat path (Phases 0–2) is reachable in ~2 days; the full
admin + durable persistence in ~1.5–2 weeks.

---

## 9. Recommended first move

Do Phase 0 + Phase 2 as a thin vertical slice: consolidate on `server`/`web`, run
the AI sidecar locally, and route `llmAnswer()` to `/chat`. That proves the seam
end-to-end with the least code, before investing in the durable admin plumbing.

---

## 10. Progress log

**2026-09-02 — Phases 0–2 executed (vertical slice complete).**

Phase 0 — Consolidation (non-destructive; nothing deleted/moved):
- `docker-compose.yml` rewritten to build `server` + `web` + `mongo`.
- New `infrastructure/docker/server.Dockerfile` and `web.Dockerfile`.
- `superbae-ci.yml` promoted to primary CI (all pushes/PRs); `backend.yml` /
  `frontend.yml` neutralized to manual-dispatch with a deprecation banner.
- Root `README.md` rewritten for the canonical stack.
- Deprecation markers: `backend/DEPRECATED.md`, `frontend/DEPRECATED.md`,
  `docs/00_CANONICAL_STACK.md`. (Legacy folders remain on disk, recoverable.)

Phase 1 — AI sidecar vendored:
- AI project copied into `ai-layer/` (backend + docs + 132 tests + knowledge
  sources; the temporary Vite admin client was intentionally left out).
- Added `ai-layer/requirements.txt` (project shipped none; derived from imports),
  `ai-layer/docker-entrypoint.sh` (builds the FAISS index on first start), and
  `infrastructure/docker/ai.Dockerfile`.
- Added the `ai` service to `docker-compose.yml`; `GEMINI_MODEL` pinned to the
  known-valid `gemini-1.5-flash` (not the project's `gemini-3.1-flash-lite`).

Phase 2 — Chat path wired:
- `server/src/config/env.ts` gains `AI_SERVICE_URL` + `AI_ADMIN_API_KEY`;
  `server/.env.example` documents them.
- `server/src/modules/assistant/service.ts`: new `callAIService()` posts to the
  sidecar's `/chat`; `llmAnswer()` now prefers the RAG sidecar, falls back to the
  legacy direct-Gemini path, then to null (client keyword matching). 15s timeout.
- `server` typecheck passes (tsc --noEmit, exit 0).

**Remaining:** Phase 3 (durable Mongo-backed AIConfigurationRepository /
AIUsageRepository / AuditSink — today in-memory, resets on restart), Phase 4 (AI
admin pages in `web` + Express `/api/ai/*` proxy gated by requireStaff), Phase 5
(knowledge-source single source of truth vs live KB indexing), Phase 6 (Python CI
job + integration smoke test + docs rewrite).

**To run the merged system:** set a real `GEMINI_API_KEY` in the `ai` service
env, then `docker-compose up --build`. First `ai` boot builds the index (downloads
the embedding model). With no key, Ara gracefully falls back to curated Q&A.

**2026-09-02 — Phase 3 executed (durable persistence for AI config/usage/audit).**

- New `ai-layer/backend/mongo_store.py`: MongoDB-backed `MongoConfigurationRepository`
  (providers/models/services/runtime/version), `MongoAuditSink` (admin audit trail),
  and `MongoAIUsageRepository` (AI-003 usage events) — implementing the AI layer's
  existing persistence Protocols. Writes into the SAME Superbae MongoDB (one source
  of truth); `pymongo` imported lazily.
- Singletons rewired (`ai_admin_service.py`, `ai_usage_service.py`): use the Mongo
  adapters when `AI_MONGODB_URI` is set, else the in-memory defaults — so existing
  tests and no-DB local runs are unchanged.
- `pymongo` added to `ai-layer/requirements.txt`; `docker-compose.yml` `ai` service
  now sets `AI_MONGODB_URI`/`AI_MONGODB_DB` and depends on `mongo`.
- Verified: 16/16 mongomock assertions (config round-trip + durability across
  instances, revision-conflict optimistic concurrency, audit insert, usage filters
  incl. case-insensitive provider + time range, usage summary) and the in-memory
  fallback. Existing 85-test light suite still green (no regressions).

Still in-memory (resets on restart) — **Phase 3b**: fraud assessments
(`fraud_detection_service`) and recommendation rules/templates/features
(`recommendation_service`). Same pattern applies when wanted.
