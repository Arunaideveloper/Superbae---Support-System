# AI Assistant Architecture

The assistant is implemented in the active Next.js and Node.js applications.

- UI: `frontend/src/components/assistant/`
- Client API: `frontend/src/lib/assistantApi.ts`
- Express routes/controllers: `backend/src/modules/assistant/`
- Persistence: MongoDB through the `Assistant` model
- Optional provider: Gemini, configured only on the server with `GEMINI_API_KEY`
- Fallback: curated Q&A matching when Gemini is disabled

Requests flow from the browser to `/api/assistant/*`, through the Next.js proxy
in development, and then to the Express backend. The backend authenticates the
request, applies assistant configuration and Q&A matching, and stores relevant
conversation data in MongoDB.
