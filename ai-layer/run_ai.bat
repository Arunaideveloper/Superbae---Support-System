@echo off
setlocal
cd /d "%~dp0backend"
if not exist .venv (
  echo [ai] Creating virtual environment...
  python -m venv .venv
)
call .venv\Scripts\activate
echo [ai] Installing requirements (first run downloads PyTorch etc. - can take several minutes)...
python -m pip install --upgrade pip >nul
pip install -r ..\requirements.txt
if not exist knowledge.index (
  echo [ai] Building knowledge index from knowledge_sources...
  python ingest.py
  python chunker.py
  python build_index.py
)
echo [ai] Starting Ara RAG service on http://localhost:8000  (Ctrl+C to stop)
uvicorn main:app --host 0.0.0.0 --port 8000
