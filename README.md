# Superbae Support System

Customer-support platform with a web frontend, a REST API, an AI assistant
("Ara"), a knowledge base, and a ticketing system with SLA tracking and
role-based access.

## Canonical stack

- **Frontend — `frontend/`**: Next.js (App Router) + React + TypeScript, styled
  with Tailwind CSS and shadcn/ui. Reaches the API through Next's `/api` rewrite
  (no CORS in dev). Login routes staff to the admin dashboard and customers to
  their tickets.
- **API — `server/`**: Node.js, Express, TypeScript, MongoDB (Mongoose).
  Hardened with Zod request validation, helmet, and rate limiting; covered by
  unit tests plus a real-MongoDB smoke test in CI.
- **AI layer — `ai-layer/`**: FastAPI (Python) RAG sidecar for Ara — FAISS
  retrieval + multi-provider routing. Express calls it over internal HTTP.
- **Database**: MongoDB.

> The older `backend/` folder is **deprecated** and kept for reference only (see
> its `DEPRECATED.md`). Earlier frontends (a Next.js app and a Vite rebuild) are
> archived under `_archive_tgz/` and `_to_delete/`. The current `frontend/` is
> the Next.js + Tailwind + shadcn/ui app.

## Run locally

Start MongoDB first, then the API, then the frontend.

```bash
# 1) API
cd server
npm install
cp .env.example .env      # dev defaults work out of the box
npm run seed              # demo accounts + tickets (admin/agent/priya)
npm run dev               # http://localhost:8001

# 2) Frontend (in a second terminal)
cd frontend
npm install
npm run dev               # http://localhost:3000  (rewrites /api -> :8001)
```

- Frontend: http://localhost:3000
- API: http://localhost:8001  (health: `GET /api/health`)

The frontend proxies `/api` to the API via Next's rewrite; override the target
with the `API_PROXY` env var (defaults to `http://localhost:8001`).

Optionally run the AI layer for Ara's RAG answers (see
`AI_LAYER_INTEGRATION_PLAN.md`); without it, Ara falls back to curated Q&A.

### Demo sign-in (after `npm run seed`)

- Admin — `admin` / `admin123`
- Agent — `agent` / `agent123`
- Customer — `priya` / `priya123`

## Run with Docker

```bash
docker-compose up --build
```

Brings up `frontend` (Next.js on 3000), `server` (API on 8001), `ai` (FastAPI
RAG sidecar), and `mongo`. Inside Docker the frontend rewrites `/api` to the
`server` service via `API_PROXY`.

## Tests

```bash
cd server
npm run typecheck
npm test        # logic + schema unit tests
npm run smoke   # end-to-end against a real MongoDB

cd ../frontend
npm run build   # type-checks and builds the Next.js app
```

## Documentation

See `docs/` (start with `docs/00_CANONICAL_STACK.md`) and, for the Python AI
layer, `AI_LAYER_INTEGRATION_PLAN.md`.
