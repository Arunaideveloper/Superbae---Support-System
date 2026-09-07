# DEPRECATED

This folder is the **legacy backend** and is no longer the canonical stack.

The canonical API lives in **`../server`** (Express + Zod validation + helmet +
rate limiting + tests). All build tooling — `docker-compose.yml`, CI, and the
root `README.md` — points at `server`/`web`.

This folder is kept only for reference (e.g. porting the Next 15 / React 19
upgrade). It can be safely removed once nothing depends on it.
