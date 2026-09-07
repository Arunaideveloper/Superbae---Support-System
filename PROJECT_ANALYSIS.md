# Superbae Support System — Whole-Project Analysis

_Independent review of the full repository as it stands on disk. Date: 2026-09-03._

---

## 1. What this project is

Superbae Support System is a **full-stack customer-support platform** for a
wardrobe / outfit-styling app called Superbae. It bundles four things:

- a **public help center + knowledge base** (Instagram-help-style self-service),
- a **ticketing system** with SLA tracking, escalations, internal notes and
  role-based access (customer / agent / admin),
- an **AI assistant, "Ara"**, backed by a real RAG engine, and
- an **admin dashboard** for agents and staff.

It is a monorepo containing a Node/Express API, a Next.js web app, a Python
FastAPI RAG service, Docker/nginx infra, docs, and the raw knowledge-base
source material.

---

## 2. Architecture (as actually built)

```
        Browser ── Next.js web app (frontend/)
                        │  /api/* rewrite (same-origin, no CORS in dev)
                        ▼
        Express API (server/) ── MongoDB (Mongoose)
          auth · tickets · KB · teams · users · assistant
                        │  internal HTTP + X-AI-Admin-Key
                        ▼
        FastAPI RAG sidecar (ai-layer/) ── FAISS + embeddings + LLM routing
                        │
                        ▼
        Provider APIs (Gemini / OpenAI / OpenRouter)
```

Three runtimes, cleanly separated: **Node** (product API), **Next.js**
(frontend), **Python** (AI). Docker Compose wires all four services + Mongo
together. The design deliberately keeps MongoDB as the single source of truth;
the AI layer runs as a reversible sidecar rather than being rewritten in Node.

### Verified tech stack

| Layer | Folder | Stack | State |
|---|---|---|---|
| Frontend | `frontend/` | **Next.js 16.3.4 + React 19.2.8** + TypeScript + Tailwind v4 + shadcn/Radix | Canonical, active |
| API | `server/` | Node + Express 4 + TS + MongoDB/Mongoose; Zod, helmet, rate-limit, JWT (access+refresh) | Canonical, active, tested |
| AI | `ai-layer/` | FastAPI (Python), FAISS retrieval, sentence-transformers, multi-provider LLM routing | Vendored sidecar, integrated through Phase 3 |
| DB | (Mongo) | MongoDB 8 (compose) / 7 (CI) | — |

---

## 3. Component-by-component

### server/ — the API (strong)
Clean modular layout: `modules/{auth,users,tickets,teams,kb,assistant}`, each
with router/controller/service; shared `models/`, `middleware/`, `utils/`,
`schemas.ts`. Security is real, not decorative: `helmet`, `express-rate-limit`,
Zod validation, JWT access+refresh, `trust proxy` set for correct client IP
behind a reverse proxy. In production it refuses to boot on the default JWT
secrets. Test story is genuine: logic tests, schema tests, and an end-to-end
**smoke test against a real MongoDB** — all run in CI (`superbae-ci.yml`).

### frontend/ — the web app (mostly built)
Next.js App Router. Public help center is **fully built** (`/help`, category,
article, search, markdown rendering with `rehype-sanitize`, helpful-vote,
contact-support hand-off). Admin area has real components (tickets, agents,
dashboard-home, escalations, sla, teams, users). Auth via JWT in
`localStorage`; API reached through Next's `/api` rewrite (env-driven
`API_PROXY`), so no CORS in dev and the same code works in Docker.

### ai-layer/ — the RAG assistant (mature, self-contained)
FastAPI app with retriever + FAISS index build, plus five services:
`ai_admin_service` (providers/models/services config), `ai_service` (chat),
`ai_usage_service` (usage/cost), `fraud_detection_service`,
`recommendation_service`. Ships its own knowledge sources (PDF/docx) and a real
test suite (`tests/`). A `mongo_store.py` was added so config/usage/audit
persist into the same Superbae MongoDB.

### Supporting pieces
`infrastructure/` (docker + nginx), `scripts/`, `docs/` (canonical-stack note +
assistant docs across api/architecture/database/user-flows), and
`Superbae Design/` (the raw knowledge-base .docx files).

---

## 4. AI integration status (from the progress log, verified against code)

The integration plan defines Phases 0–6. Executed so far:

- **Phase 0 — Consolidate:** compose/CI/README repointed to `server` + web;
  legacy folders deprecated (non-destructively). ✅
- **Phase 1 — Sidecar:** AI project vendored into `ai-layer/`; Dockerfile +
  entrypoint that builds the FAISS index on first boot; `ai` service added to
  compose. ✅
- **Phase 2 — Chat path:** `server/src/modules/assistant/service.ts` now calls
  the sidecar's `/chat` first (`callAIService`, 15s timeout), falls back to a
  direct-Gemini call, then to `null` so the client's keyword matcher still
  answers. Clean, well-commented, graceful degradation. ✅
- **Phase 3 — Durable persistence:** Mongo-backed config/usage/audit adapters
  added and tested (mongomock). ✅

**Remaining:** Phase 3b (persist fraud + recommendation state — still in-memory,
resets on restart), Phase 4 (AI-admin pages in the web app + Express `/api/ai/*`
proxy gated by `requireStaff`), Phase 5 (knowledge-base single source of truth),
Phase 6 (Python CI job + integration smoke test + docs rewrite).

---

## 5. Findings & risks

### 🔴 Critical — a live API key is sitting in plaintext
`ai-layer/backend/.env` contains a **real OpenAI secret key**
(`OPENAI_API_KEY="sk-REDACTED-…"`, ~160 chars) even though OpenAI is disabled in
that same file and the header comment claims the file is only placeholders.
- Good news: there is **no `.git` repo on disk**, and `.env` is gitignored, so
  it was almost certainly never pushed to a remote.
- Regardless, a real credential is on disk in cleartext. **Rotate/revoke that
  OpenAI key now**, then replace it with a placeholder. Never let a real key
  reach `.env.example` or any tracked file. (The Gemini and admin-key slots in
  the same file are correctly left as placeholders.)

### 🟠 Documentation has drifted from the code
The README (dated today) and every plan doc describe the canonical frontend as
**`web/` on Next 14 / React 18**. On disk there is **no `web/` folder** — the
canonical frontend is `frontend/` on **Next 16 / React 19**. It appears `web`
was renamed to `frontend` and upgraded, but the docs were only half-updated.
Anyone following the README's "Next 14/React 18" line, the `web/src/...` file
paths in the plans, or `docs/00_CANONICAL_STACK.md` will be misled. **Rewrite
the docs to say `frontend/` = Next 16 / React 19**, and fix the plan file paths.

### 🟠 No version control present
There's a `.github/workflows/` directory (three workflows) but **the project is
not a git repository** on this machine — `git` reports "not a git repository."
So the CI configs can't run, and there's no history, no snapshot, no undo. For a
project this size with active refactoring, this is a real gap. **`git init`, add
a proper `.gitignore` audit, commit a baseline, and push to a remote.**

### 🟡 Two near-duplicate backends
`backend/` is a nearly file-for-file older copy of `server/` (server adds the
teams module, Zod, helmet, rate-limit, and tests). It's correctly marked
`DEPRECATED.md`, but keeping a second, weaker, security-free copy of the whole
API in the tree invites accidental edits to the wrong one. Snapshot and delete.

### 🟡 Heavy repo clutter / multiple graveyards
There are **four** parallel "old stuff" locations: `_archive/`,
`_archive_tgz/` (5 tarballs incl. `superbae_web.tgz`, `superbae_web_v2.tgz`),
and `_to_delete/` (which itself contains full `frontend`, `web`, `frontend-vite`
copies, a partial Linux `node_modules`, and `.bak` files). Plus committed build
output (`frontend/.next/`) and vendored `node_modules`/`.venv` in the working
tree. This bloats the folder heavily and makes "which frontend is real?"
genuinely confusing (the FRONTEND_ANALYSIS doc had to spend a section
disambiguating three different "frontend" folders). **Pick one archive
location, delete the rest, and ensure `.next/`, `node_modules/`, `.venv/` are
gitignored and not tracked.**

### 🟡 Knowledge base is duplicated in two places
The same KB material lives in both `Superbae Design/*.docx` and
`ai-layer/backend/knowledge_sources/`. Phase 5 is meant to pick a single
canonical source and decide whether the RAG index is built from files, from the
live published KB `Article` collection, or both. Until then, Ara's answers can
drift from what agents actually publish. **Feeding the live KB into the index is
the right long-term answer.**

### 🟡 Model-id landmine
`ai-layer/backend/.env` still defaults `GEMINI_MODEL=gemini-3.1-flash-lite`,
which the integration plan itself flags as unverified. Compose pins the
known-good `gemini-1.5-flash`, but the raw `.env` default would fail if used
directly. **Standardize on a confirmed, current model id everywhere.**

---

## 6. Overall assessment

This is a **well-architected, above-average project** for its stage. The
separation of concerns is clean, the API is genuinely hardened and tested, the
AI integration was done thoughtfully (sidecar over rewrite, graceful fallback at
every layer), and the planning docs are unusually detailed and honest about
trade-offs. The core product paths — help center, tickets, Ara chat — are built
and coherent.

The problems are almost entirely **hygiene and consolidation, not design**: a
leaked key to rotate, docs that lag the code, no git, and several redundant
copies of old code inflating and confusing the tree. None of these are hard to
fix, and fixing them would materially de-risk the project.

### Suggested order of operations
1. **Rotate the exposed OpenAI key** and scrub it from `.env` (today).
2. **`git init` + baseline commit + remote** so history and CI exist.
3. **Reconcile the docs** to the real `frontend/` (Next 16 / React 19) stack.
4. **Prune the graveyards** — one archive, delete `backend/`, `_to_delete/`,
   redundant tarballs; untrack build output and dependencies.
5. **Finish AI Phases 3b–6** — persist fraud/recommendation state, build the
   AI-admin pages behind the Express proxy, and unify the knowledge base.

---

_Component states above were confirmed by reading the source (routers, the
assistant service, env configs, package manifests, CI, and the plan docs), not
only the project's own documentation._
