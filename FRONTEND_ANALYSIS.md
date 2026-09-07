# Superbae Support System — Project Analysis & Frontend Integration

_Analysis of the `Superbae_Support System` repo and the `frontend` folder you attached, with the frontend-only fixes that were applied. The backend was not touched._

## What the project is

Superbae Support System is a full-stack customer-support platform — a knowledge base, a ticketing system with SLA tracking, an AI assistant ("Ara"), and a role-based admin dashboard. The repository is a monorepo whose **canonical** stack, per its README, is two folders:

- **`server/`** — the backend API. Node.js + Express + TypeScript on MongoDB (Mongoose). It is hardened with Zod request validation, `helmet`, rate limiting, and JWT auth (access + refresh tokens), and is covered by unit tests plus a real-MongoDB smoke test. This is the piece you asked to leave untouched, and it was.
- **`web/`** — the canonical frontend. Next.js 14 + React 18 + Tailwind + shadcn/ui, already fully wired to `server/`.

The repo also contains: `backend/` and `frontend/` folders that are **explicitly deprecated** (kept for reference, each with a `DEPRECATED.md`); an `ai-layer/` (a Python service for the Ara assistant); `docs/`; `infrastructure/` (nginx, docker); and a `docker-compose.yml` that brings up MongoDB, the server, and the web app together.

## The frontend situation — there are three of them

This is the key thing to be clear on, because "frontend" means three different things here:

1. `web/` — the **canonical, current** frontend (Next.js), the one the README treats as live.
2. `Superbae_Support System/frontend/` — an **old, deprecated** frontend inside the repo.
3. `Downloads/frontend/` — **the folder you attached**, and the design you said you want to use.

The folder you attached is a **separate, standalone Vite + React 19 single-page app** titled "Superbae Help Center." It is not the repo's `web/`, and not the repo's deprecated `frontend/` — it's a distinct, more visually styled build (soft blush/pink/lavender theme, `Poppins` + `Great Vibes` fonts, a branded split-screen login, a floating "Ask Ara" chat widget, an animated canvas-cursor option). This is the look you want the project to have.

## Compatibility verdict: yes, it can be the project's frontend — with no backend change

The attached frontend was written against a **Django-REST-style API contract** (snake_case fields, `/api/.../` paths, JWT access/refresh in `localStorage`). Your Express `server/` deliberately implements that **same** contract — the same endpoints, the same snake_case serializers, the same auth scheme. So the attached design can drive the existing backend directly. It does **not** require any backend change.

It was, however, written against a slightly older shape of that contract in a few places, so a small number of **frontend-only** adjustments were needed to make it line up with what `server/` actually returns today. Those were applied.

## Fixes applied (frontend only — `Downloads/frontend/src/`)

| # | File | Problem | Fix |
|---|------|---------|-----|
| 1 | `services/api.ts` | The backend serializes `created_by` / `assigned_to` as **objects** (`{ id, username, email, role }`), but the ticket-list views render them as plain strings. As-is this makes React throw ("Objects are not valid as a React child") on the **admin Tickets list**. | Added a small normalizer at the service boundary so `listTickets()` and `fetchTickets()` flatten those fields to the username string their types already promise. Detail views are untouched — they correctly read `.username`. |
| 2 | `services/api.ts` | `assignTicket()` sent `{ assignee }`, but the backend's assign endpoint validates `{ assigned_to }` — so **assigning a ticket always failed** with a 400. | Now sends `{ assigned_to: … }`. |
| 3 | `services/assistantApi.ts` | `askAssistant()` and `logAssistantTurn()` sent a `query` field, but the assistant endpoints expect `question`. | Both now send `question`. (The widget already degrades gracefully, so this was silent before — now the LLM path and turn-logging actually receive the text.) |

These are boundary-level changes: contained, aligned to the frontend's own declared types, and leaving every page component and the backend as they were.

## What's wired vs. what isn't (in the attached frontend)

Fully API-backed and working against `server/` after these fixes:

- **Login** (JWT) and **"who am I"** routing (staff → admin dashboard, customer → ticket view).
- **Customer tickets** — list, create, open a ticket, post replies.
- **Admin dashboard home** — KPIs, 7-day volume, resolution ring (computed client-side from the ticket list). Two panels — *Agent Workload* and *Top Issue Categories* — are explicitly marked **SAMPLE** placeholder data.
- **Admin Tickets** — search/filter, detail drawer, status/priority updates, **assign** (now fixed), replies and internal notes.
- **Ask Ara** assistant widget — public config, ask, and offline keyword fallback.

Present in the admin nav but **not yet built** (they render a "coming soon" card): Knowledge Base, Analytics, Reports, Automations, Notifications, Roles & Permissions, Audit Logs, Integrations, Settings. Note that the backend **already exposes** endpoints for several of these — knowledge base (`/api/kb`, `/api/public/kb`), users/teams, SLA report, escalations, dashboard stats, and assistant admin — so they can be built out against the existing API when you want, still with no backend change. A few other admin sections (e.g. Escalations, SLA, Users, Agents, Teams) exist as pages but vary between partially-wired and placeholder; I can audit each one next if you'd like.

## One caution: the toolchain is bleeding-edge

The attached frontend pins **React `^19.2.8`, Vite `^8.2.2` (Rolldown-based), and TypeScript `^7.0.2` (the native preview compiler)** — all very new/pre-release. Two practical consequences:

- **`node_modules` is platform-specific.** Vite 8's bundler ships as a native binary per OS. Your folder's `node_modules` was installed on Windows, so it won't run under Linux (that's the only reason a build check failed in the sandbox — not the code). Don't copy `node_modules` between machines; run `npm install` on each.
- It's worth confirming these exact versions are intentional and stable for you, since pre-release toolchains can shift under you.

## How to run it (on your Windows machine)

1. Start **MongoDB** (the server expects `mongodb://127.0.0.1:27017/superbae`). It isn't installed on your machine yet — install MongoDB Community, or run `docker-compose up` from the repo which brings up Mongo for you.
2. Start the API: in `server/`, `npm install`, then `npm run seed` (creates demo accounts + tickets), then `npm run dev` → http://localhost:8001.
3. Start the attached design: in `Downloads/frontend/`, `npm install`, then `npm run dev`. Vite proxies `/api` to `:8001`, so no CORS or config change is needed.

Demo sign-ins after seeding: **admin / admin123**, **agent / agent123**, **customer priya / priya123**.

## Recommended next steps

- Run the two dev servers and click through login → tickets → assign → Ara to confirm the three fixes end-to-end (I couldn't run it here because MongoDB isn't installed in the sandbox).
- Decide the home for this design: keep it as the standalone `Downloads/frontend/` app, or move it into the repo (e.g. replace the deprecated `frontend/`) so it lives alongside `server/` and version-controls together.
- When ready, build out the "coming soon" admin sections against the endpoints the backend already provides — Knowledge Base is the highest-value one and is fully supported server-side.
