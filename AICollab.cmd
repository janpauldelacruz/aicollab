@echo off
REM Double-click to run AICollab. Installs what is missing, then opens the app.
setlocal
title AICollab
cd /d "%~dp0"

REM ---- Node.js ----
where node >nul 2>nul && goto have_node
if exist "%ProgramFiles%\nodejs\node.exe" goto add_node
echo Node.js is not installed. Installing Node.js LTS...
where winget >nul 2>nul || goto no_winget
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
:add_node
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul && goto have_node
echo.
echo Could not install Node.js. Install it from https://nodejs.org and run this again.
goto failed
:have_node

REM ---- Ollama ----
where ollama >nul 2>nul && goto have_ollama
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" goto add_ollama
echo Ollama is not installed. Installing Ollama...
where winget >nul 2>nul || goto no_winget
winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements
:add_ollama
set "PATH=%LOCALAPPDATA%\Programs\Ollama;%PATH%"
:have_ollama

REM ---- Everything else: model, .env, npm install, build, start, open browser ----
node scripts\one-click.mjs
if errorlevel 1 goto failed
exit /b 0

:no_winget
echo.
echo winget is not available, so missing tools cannot be installed automatically.
echo Install Node.js from https://nodejs.org and Ollama from https://ollama.com/download,
echo then run this again.
:failed
echo.
pause
exit /b 1
