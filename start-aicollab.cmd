@echo off
REM Serves AICollab on all interfaces so Tailscale devices can reach it.
REM Runs from wherever this repo is cloned, and builds once if needed.
cd /d "%~dp0"
if not exist ".next\BUILD_ID" call npm run build
call npm run serve:lan
