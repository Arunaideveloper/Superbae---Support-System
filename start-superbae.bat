@echo off
title Superbae Launcher
echo Starting Superbae in RAG mode - three windows will open...
echo.

REM --- free ports if old servers are still running ---
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8001 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

REM --- 1) RAG service (Python) ---
start "Superbae RAG (Python :8000)" cmd /k "cd /d "%~dp0ai-layer\backend" && .venv\Scripts\python -m uvicorn main:app --port 8000"

REM give the RAG service a few seconds to load
timeout /t 5 >nul

REM --- 2) API (Node) ---
start "Superbae API (Node :8001)" cmd /k "cd /d "%~dp0server" && npm run dev"

REM --- 3) Frontend ---
start "Superbae Frontend (:3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo All three started. Wait ~20 seconds, then open:  http://localhost:3000/help
echo (Close this window - the three server windows stay open.)
pause
