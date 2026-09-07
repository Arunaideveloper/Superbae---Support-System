# Superbae Backend (Node.js + Express + TypeScript + MongoDB)

The support-system backend, rewritten from Django to a Node/Express/TypeScript
stack on MongoDB (Mongoose). Same API surface, same business rules (JWT auth,
ticket SLA + audit trail, KB versioning + feedback, Ara assistant with an
optional Gemini LLM).

## Requirements

- Node.js 18+ (developed on Node 22)
- MongoDB running locally (or a MongoDB Atlas connection string)

## Setup

```bash
cd backend
npm install
cp .env.example .env        # then edit secrets / Mongo URI as needed
npm run seed                # loads demo users, KB and Ara Q&A (safe to re-run)
npm run dev                 # http://localhost:8001
```

`npm run dev` uses `tsx watch` (auto-reload). For production: `npm run build && npm start`.

### Environment (.env)

| Key | Purpose |
|---|---|
| `PORT` | HTTP port (default 8001) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | token signing secrets — **change these** |
| `CORS_ORIGIN` | allowed frontend origin(s), comma-separated, or `*` |
| `GEMINI_API_KEY` | optional; enables Ara's LLM answers. Empty = offline keyword matcher |
| `ASSISTANT_LLM_MODEL` | Gemini model id (default `gemini-1.5-flash`) |

The Gemini key lives only here on the server — it is never sent to the browser.

## Demo accounts (from the seed)

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Agent | `agent` | `agent123` |
| Customer | `priya` | `priya123` |

Change or remove these before any real deployment.

## Verification

```bash
npm run typecheck     # strict TypeScript, no emit
npm run test:logic    # DB-free checks: SLA math, serializers, slugs (24 assertions)
npm run smoke         # full end-to-end HTTP test — needs MongoDB
```

`npm run smoke` uses `MONGODB_URI` if set (recommended), otherwise it tries to
download an in-memory MongoDB binary. It boots the real Express app and exercises
auth, users, tickets (SLA/audit/permissions), the KB (admin + public + versioning
+ feedback) and the assistant.

## API surface

```
POST   /api/register            POST /api/login            POST /api/refresh
GET    /api/me
GET    /api/users?role=         POST /api/users            GET/PATCH /api/users/:id

GET    /api/tickets             POST /api/tickets          GET /api/tickets/stats
GET/PATCH /api/tickets/:id
GET/POST  /api/tickets/:id/messages
POST   /api/tickets/:id/assign  /api/tickets/:id/status    /api/tickets/:id/priority

GET    /api/kb/stats
GET/POST  /api/kb/categories    PATCH/DELETE /api/kb/categories/:id
GET/POST  /api/kb/articles      GET/PATCH/DELETE /api/kb/articles/:id
GET    /api/kb/articles/:id/versions   POST /api/kb/articles/:id/restore
GET    /api/kb/articles/:id/feedback

GET    /api/public/kb/categories   /api/public/kb/articles   /api/public/kb/articles/:idOrSlug
POST   /api/public/kb/articles/:id/feedback

GET    /api/assistant/config    POST /api/assistant/log     POST /api/assistant/ask
GET/PATCH /api/assistant/admin/config
GET/POST  /api/assistant/admin/qa     PATCH/DELETE /api/assistant/admin/qa/:id
GET    /api/assistant/admin/conversations   /api/assistant/admin/conversations/:id
```

## Structure

```
src/
  config/      env + Mongo connection
  constants.ts SLA policy, enums
  models/      Mongoose schemas
  middleware/  auth (JWT), error handling
  utils/       jwt, password, slug, serializers, asyncHandler
  modules/
    auth/ users/ tickets/ kb/ assistant/   (controller + router; tickets & kb have service.ts)
  seed/        data + seed + logic.test + smoke
  app.ts       Express app assembly
  index.ts     bootstrap (connect + listen)
```
