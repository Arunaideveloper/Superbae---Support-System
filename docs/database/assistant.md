# AI Assistant Data Model

The assistant uses MongoDB through Mongoose. There is no SQL database or ORM
in the active application.

## Collections

- `assistants`: assistant configuration, curated Q&A, and conversation records
- `users`: account and role references used by assistant conversations
- `articles`: optional knowledge-base sources used for answers

The schemas are defined in `backend/src/models/Assistant.ts` and related models.
The assistant API is implemented in `backend/src/modules/assistant/`.
