@echo off
TITLE THANKHUN Trade Jornal Launcher
echo ===================================================
echo     THANKHUN Trade Jornal - Server Launcher
echo ===================================================
echo.
echo [*] Starting Backend API (FastAPI) on Port 8088...
start "Jornaltrade Backend (Port 8088)" cmd /k "cd /d %~dp0api && ..\backend\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8088"

echo [*] Starting Frontend Web (Vite + React) on Port 5173...
start "Jornaltrade Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [*] Starting Ngrok Tunnel on Port 8088...
start "Jornaltrade Ngrok (Port 8088)" cmd /k "cd /d %~dp0 && ngrok.exe http 8088 --domain=cargo-railway-genre.ngrok-free.dev"

echo.
echo [*] Opening Thankhun Trade Jornal in default browser...
timeout /t 2 > nul
start http://localhost:5173

exit
