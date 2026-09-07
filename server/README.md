# Superbae Server (Node.js + Express + TypeScript + MongoDB)

The support-system backend, rewritten from Django to a Node/Express/TypeScript
stack on MongoDB (Mongoose). Same API surface, same business rules (JWT auth,
ticket SLA + audit trail, KB versioning + feedback, Ara assistant with an
optional Gemini LLM).

## Requirements

- Node.js 18+ (developed on Node 22)
- MongoDB running locally (or a MongoDB Atlas connection string)

## Setup

```bash
cd server
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

## Security

- **JWT with revocation** — access + refresh tokens carry a `tokenVersion`;
  changing a password or blocking a user bumps it, instantly invalidating every
  existing token for that account.
- **Request validation** — every write endpoint validates its body with Zod, so
  malformed or unexpected input is rejected with a clear 400 before it reaches
  business logic.
- **Rate limiting** — tight limit on auth endpoints, gentle global limit on the API.
- **Helmet** security headers, CORS allowlist.
- **Fail-fast in production** — the server refuses to start if `NODE_ENV=production`
  and the JWT secrets are still the defaults.

## Verification

```bash
npm run typecheck     # strict TypeScript, no emit
npm test              # DB-free unit tests: logic (24) + schema validation (26)
npm run smoke         # full end-to-end HTTP test — needs MongoDB
```

`npm run smoke` uses `MONGODB_URI` if set (recommended), otherwise it tries to
download an in-memory MongoDB binary. It boots the real Express app and exercises
auth, users, tickets (SLA/audit/permissions/escalations/sla-report), teams, the KB
(admin + public + versioning + feedback), the assistant, Zod validation, and token
revocation on block.

CI (`.github/workflows/superbae-ci.yml`) runs the typecheck, unit tests, and the
**smoke test against a real MongoDB service container** on every push — so the
database path is proven automatically.

## API surface

```
POST   /api/register            POST /api/login            POST /api/refresh
GET    /api/me
GET    /api/users?role=         POST /api/users            GET/PATCH /api/users/:id

GET    /api/tickets             POST /api/tickets          GET /api/tickets/stats
GET    /api/tickets/escalations  GET /api/tickets/sla-report
GET/PATCH /api/tickets/:id
GET/POST  /api/tickets/:id/messages
POST   /api/tickets/:id/assign  /api/tickets/:id/status    /api/tickets/:id/priority
GET    /api/teams/stats

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
