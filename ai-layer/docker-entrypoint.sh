#!/bin/sh
set -e
cd /app/backend
if [ ! -f knowledge.index ]; then
  echo "[ai] No index found — building from knowledge_sources..."
  python ingest.py
  python chunker.py
  python build_index.py
fi
exec uvicorn main:app --host 0.0.0.0 --port 8000
