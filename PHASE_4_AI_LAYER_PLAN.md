# Phase 4 Plan — Surfacing the AI Layer in the Admin Dashboard

_How to make the Python `ai-layer` features (fraud, recommendations, usage, providers) appear as real screens in your attached Vite frontend — without changing either backend. Nothing has been built yet; this is the plan only._

---

## Plain-English summary

Right now your admin has **one** AI screen — "AI Assistant" (Ara, the customer chat helper). The **other** AI system — the five Python files (`ai_admin_service`, `ai_service`, `ai_usage_service`, `fraud_detection_service`, `recommendation_service`) — has **no screens at all**. This plan adds those screens.

The good news I confirmed while writing this: the Python service **already permits your frontend to call it directly** (its CORS list includes `http://localhost:5173`), and its admin endpoints **require no password when run locally**. So we do **not** need to touch the Express backend or the Python code. Phase 4 becomes a **frontend-only** job: a little config to point the frontend at the Python service, plus four new admin pages.

The one non-negotiable prerequisite: the **Python `ai-layer` service must be running** (`uvicorn`, after `pip install`). The new pages show live data from it; with it off, they'll show "nothing to display."

---

## What connects to what

```
   Your Vite frontend (localhost:5173)
        |                         \
        |  /api/*  → Express       \  /ai/*  → Python AI layer
        v  (port 8001)              v  (port 8000)
   auth, tickets, KB,          providers, models, usage,
   Ara assistant               fraud, recommendations
   [UNCHANGED]                  [UNCHANGED — run as-is]
```

Two separate backends, both left exactly as they are. The frontend simply calls whichever one a given screen needs.

### The connection detail (why no backend change is needed)

- The Python service (`ai-layer/backend/main.py`) sets CORS to allow `http://localhost:5173` — your frontend's exact origin — with all methods and headers. So the browser is allowed to call it directly.
- Its `/ai/*` admin routes are guarded only if `AI_ADMIN_API_KEY` is set. **Leave that unset locally** and the routes are open — perfect for viewing on your own machine.
- To avoid hardcoding `http://localhost:8000` in the code, we add one line to `vite.config.ts` proxying `/ai` → `http://localhost:8000` (this is **frontend** config, not a backend change). Then the frontend just calls `/ai/...` the same way it calls `/api/...` today.

> Production note: for a real deployment you would **not** expose the Python service to the browser or run it keyless. There, the original plan's approach applies — Express proxies `/api/ai/*` with the admin key attached server-side. That is a backend change and is explicitly **out of scope** here; it's a later step when you go to production.

---

## The API the pages will use (already built in Python)

All confirmed present in `ai-layer/backend/main.py`:

- **Providers / Models / Services** (`ai_admin_service`): `GET/PUT /ai/providers`, `/ai/providers/{id}`, `/ai/providers/{id}/health`, `GET/PUT /ai/models`, `/ai/models/{provider}/{model}`, `GET/PUT /ai/services`, `/ai/services/{name}`.
- **Usage & cost** (`ai_usage_service`): `GET /ai/usage/summary`, `/ai/usage/by-provider`, `/ai/usage/by-model`, `/ai/usage/by-feature`.
- **Fraud** (`fraud_detection_service`): `POST /ai/fraud/analyze`, `GET /ai/fraud/assessments`, `GET/PUT /ai/fraud/assessments/{id}`.
- **Recommendations** (`recommendation_service`): `GET /ai/recommendations/summary`, `/ai/recommendations/config`, and full CRUD for `rules`, `templates`, and `features`.

The exact field names for each are visible in the service's own docs page at `http://127.0.0.1:8000/docs` once it's running — the pages will be built to match those.

---

## The new screens (what gets built in the frontend)

A new sidebar group — **"AI LAYER"** — with four items, kept separate from the existing "AI Assistant" (Ara) so the two systems don't get confused:

1. **AI Providers** — cards for each provider (OpenAI, Gemini, OpenRouter) and their models: configured / enabled state, health, and the ability to enable/disable and pick models. → `/ai/providers`, `/ai/models`, `/ai/services`.
2. **Usage & Cost** — KPI tiles (total requests, tokens, estimated cost) plus breakdown tables by provider, model, and feature. → `/ai/usage/*`.
3. **Fraud** — a list of fraud assessments with risk level and status, a detail view, and a small "analyze activity" form to try it. → `/ai/fraud/*`.
4. **Recommendations** — the summary, plus tabs to view/manage rules, templates, and features. → `/ai/recommendations/*`.

Each page follows the same visual style as your existing admin sections (the pink/lavender cards), so they'll look native to the dashboard. Each is a self-contained section component wired into `AdminDashboard.tsx` exactly the way I wired the AI Assistant panel.

---

## Files that would change (all frontend, in `Downloads/frontend`)

- `vite.config.ts` — add the `/ai` → `:8000` proxy (one entry).
- `src/services/aiLayerApi.ts` — **new**: a small typed client for the `/ai/*` endpoints (mirrors your existing `assistantApi.ts`).
- `src/pages/admin/AiProviders.tsx`, `AiUsage.tsx`, `AiFraud.tsx`, `AiRecommendations.tsx` — **new** page components.
- `src/pages/admin/AdminDashboard.tsx` — add the "AI LAYER" nav group and render the four new sections.

Nothing in `server/` (Express) or `ai-layer/backend/` (Python) is edited.

---

## Prerequisite to see live data

The Python service must be running:

```powershell
cd "C:\Users\HP\Desktop\Superbae_Support System\ai-layer\backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r ..\requirements.txt      # heavy: pulls FAISS + sentence-transformers
uvicorn main:app --port 8000
```

- Leave `AI_ADMIN_API_KEY` **unset** so the pages can read without a key.
- You do **not** need a Gemini key or the FAISS index just for these admin pages (only Ara's chat needs those).
- Verify it's up by opening `http://127.0.0.1:8000/docs`.

If the `pip install` is too heavy or fails on your machine, that's the real blocker to flag — the pages can be built regardless, but they'll stay empty until the service runs.

---

## Rough effort

| Step | Scope | Est. |
|---|---|---|
| Vite proxy + `aiLayerApi.ts` client | wiring | ~0.5 day |
| AI Providers page | read + enable/disable/model select | ~0.5 day |
| Usage & Cost page | KPIs + breakdown tables | ~0.5 day |
| Fraud page | list + detail + analyze form | ~0.5–1 day |
| Recommendations page | summary + rules/templates/features tabs | ~1 day |
| Polish + wire into sidebar + test against live service | | ~0.5 day |

A single proof screen (AI Providers) working end-to-end is reachable in well under a day; all four in ~3–4 days.

---

## Recommended first move

Build **one** page — **AI Providers** — end to end: the Vite proxy, the `aiLayerApi.ts` client, and the providers screen wired into the sidebar. That proves the whole connection (frontend → Python, no backend change) with the least code. Once you can see providers live, the other three pages are the same pattern repeated.

---

## What stays untouched (your rule, honored)

- **Express backend (`server/`)** — no code changes. Ara and all `/api/*` behavior identical.
- **Python `ai-layer` code** — run as-is; not edited.
- **Ara "AI Assistant" panel** — unchanged; the new "AI LAYER" group sits beside it.
