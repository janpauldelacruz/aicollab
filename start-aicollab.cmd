@echo off
REM Serves AICollab on all interfaces so Tailscale devices can reach it.
cd /d "C:\Trading\tools\MarketSscanner\aicollab"
call npm run serve:lan
