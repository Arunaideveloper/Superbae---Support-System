# Superbae AI

This repository is the shared AI layer for Superbae. It contains the existing Customer Support Bot, AI-001 Service Administration, AI-002 Fraud Detection Intelligence, and AI-003 Usage & Cost Analytics. AI-004 and AI-005 are not implemented here.

## Architecture

`backend/services/ai_admin_service.py` separates the three administration resources and defines the database-neutral persistence boundary:

- Providers: registered adapters, credential configuration status, capabilities, enabled state, and safe health state.
- Models: provider-owned model IDs, capabilities, default state, enabled state, and availability.
- Services: named capabilities such as `customer_support`, assigned provider/model, enabled state, and configurable fallbacks.
- Persistence: `AIConfigurationRepository` loads/saves providers, models, services, runtime settings, and configuration version metadata. `AuditSink` remains a separate boundary.

`AIService` is the shared execution layer. A feature requests the named service, the registry resolves provider/model candidates, and provider-specific SDK or HTTP logic remains in `ai_service.py` provider adapters. Adding a provider requires a registry definition and adapter, rather than changes to chatbot or future feature code.

The execution lifecycle emits `AIRequestMetadata` containing request ID, service, provider, model, latency, success, and a safe error category. AI-003 additionally records safe usage events at this centralized routing point.

## Configuration

Create `backend/.env` locally. Secrets are read server-side only and are never returned, logged, or included in audit events.

```text
AI_ADMIN_API_KEY=                 # optional local boundary; set in deployed integration
AI_CUSTOMER_SUPPORT_ENABLED=true
AI_CUSTOMER_SUPPORT_PROVIDER=openai
AI_CUSTOMER_SUPPORT_FALLBACKS=gemini
AI_OPENAI_ENABLED=true
AI_GEMINI_ENABLED=true
AI_OPENROUTER_ENABLED=false
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.1-flash-lite
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
```

Provider status distinguishes `configured`, `disabled`, and `not_configured`. Health is `unknown` until a real provider health probe is integrated; it is `unhealthy` when the provider cannot be used because it is disabled or unconfigured. The API does not claim external provider health without making a network check.

Environment configuration provides deployment defaults and secrets. Runtime administrative updates use the repository boundary and the included in-memory adapter, so they reset on process restart in the current process. The main Superbae backend owns durable persistence and should provide an `AIConfigurationRepository` implementation. This repository intentionally does not create a competing database.

The repository supports granular provider, model, service, and runtime-settings operations plus snapshot load/save with an expected revision for optimistic concurrency. Configuration records contain only safe metadata; secret-bearing configuration keys are rejected. A production adapter can map these operations to the main backend API or database without exposing its database technology to this AI layer.

## Administration API

Admin routes are open for local development when `AI_ADMIN_API_KEY` is unset. When it is set, every administration request requires `X-AI-Admin-Key`; the temporary frontend is not a security boundary. Production authentication and authorization should be delegated from the main Superbae backend through this boundary.

- `GET /ai/providers` and `GET /ai/providers/{provider_id}` list or inspect safe provider metadata.
- `GET /ai/providers/{provider_id}/health` returns the safe, non-probing health state.
- `GET /ai/models` lists models; use `?provider_id=gemini` to filter.
- `PUT /ai/models/{provider_id}/{model_id}` validates and updates a model's runtime `enabled` state.
- `PUT /ai/providers/{provider_id}` validates and updates a provider's runtime `enabled` state.
- `GET /ai/services` and `GET /ai/services/{service_id}` list or inspect named AI services.
- `PUT /ai/services/{service_id}` validates and updates `provider_id`, `model_id`, `enabled`, and `fallback_provider_ids`.

Invalid providers, models, assignments, disabled models, disabled fallbacks, and invalid enabled configurations are rejected. Changes are sent to the injected `AuditSink` with previous/current non-secret state, timestamp, and optional actor. The default sink is in memory; production audit delivery belongs with the main backend’s audit system.

## Chatbot integration

`POST /chat` still preserves conversation history, the FAISS retriever, embeddings, knowledge ingestion, and RAG context. It now resolves the `customer_support` service through the shared registry and tries its configured primary provider followed by configured fallback providers. Disabled or unconfigured providers are never selected. The chatbot does not initialize provider clients directly.

## AI-003: Usage & Cost Analytics

AI-003 records safe, content-free AI usage events and provides administration-only consumption analytics. Events contain a request ID, UTC timestamp, provider/model, feature and operation, success/failure status, latency, available token usage, and a safe error category. Prompts, responses, API keys, authorization headers, and provider credentials are never accepted or stored.

`AIService` records one best-effort event centrally after each routed customer-support request, including fallback outcomes. OpenAI and OpenRouter token fields are read from response usage metadata; Gemini fields are read from its usage metadata when supplied. When a provider does not report token usage, it is marked `unavailable`; AI-003 never invents exact token counts. A usage-recording failure is logged but never changes chat or fallback behavior.

Cost is an estimate only. It is calculated only when deployment injects a `PricingCatalog` entry for the exact provider/model and both input and output token counts are available. Prices are separate USD-per-million input/output token rates and are deliberately not hard-coded because provider pricing changes. Unknown prices result in `null` cost.

`InMemoryAIUsageRepository` is a local development/test adapter, so records reset on restart. The main backend should inject its own `AIUsageRepository` and, where appropriate, `PricingCatalog` implementation.

The existing admin boundary protects these endpoints:

- `POST /ai/usage/record` records a safe event for an AI-layer feature outside the central router.
- `GET /ai/usage/summary` returns total/successful/failed requests, known tokens, and known estimated costs.
- `GET /ai/usage/by-provider`, `/ai/usage/by-model`, and `/ai/usage/by-feature` return grouped summaries.

Summary routes support `provider_id`, `model_id`, `feature`, `status`, `start_at`, and `end_at` filters where applicable. Feature names are open-ended; a missing feature is safely recorded as `unknown`.

## Local testing

Start the backend from `backend`:

```text
uvicorn main:app --reload
```

Run the dependency-free backend suite:

```text
python -m unittest discover -s tests -v
```

The temporary AI-team client is the existing Vite app in `frontend`:

```text
npm install
npm run dev
```

Open `http://127.0.0.1:5173/` and select `AI Admin`. It displays safe service state and allows validated model/enable updates. The official Superbae frontend and main backend will integrate the documented API later.

## Ownership and future integration

The AI layer owns provider adapters, safe configuration contracts, routing, validation, request metadata, and extension points. The main Superbae backend owns user authentication, authorization policy, durable configuration persistence, and centralized audit storage. The official frontend owns the production administration experience. Future fraud, analytics, recommendation, moderation, and other features should call this shared service layer rather than create separate applications or provider clients.
