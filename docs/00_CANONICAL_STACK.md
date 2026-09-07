# READ FIRST — Canonical stack

The project is a full **frontend + API + AI** stack.

- **Frontend:** `frontend/` — Next.js (App Router) + React + TypeScript, styled
  with Tailwind CSS and shadcn/ui. Reaches the API through Next's `/api` rewrite
  (target set by `API_PROXY`, default `http://localhost:8001`). Login routes
  staff to the admin dashboard and customers to their tickets. Dev server on
  http://localhost:3000.
- **API:** `server/` (Express + TypeScript + MongoDB, with Zod validation,
  helmet, rate limiting, and unit + smoke tests). http://localhost:8001.
- **AI layer:** `ai-layer/` (FastAPI RAG sidecar for the "Ara" assistant).

The current `frontend/` is the Next.js + Tailwind + shadcn/ui app. Earlier
frontends (a Next.js app and a Vite/React rebuild) are archived under
`../_archive_tgz/` and `../_to_delete/`. The `backend/` folder is **deprecated**
(see its `DEPRECATED.md`); treat `server/` as authoritative. Some older `docs/`
content still references removed frontends and `backend/` paths — treat this
note as authoritative until those docs are rewritten. See
`../AI_LAYER_INTEGRATION_PLAN.md` for the Python AI layer.
