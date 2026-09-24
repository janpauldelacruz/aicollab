/**
 * One-click launcher: gets AICollab from a fresh clone to an open browser tab.
 *
 * Every step is skipped when it is already done, so double-clicking again is
 * fast. Run by AICollab.cmd on Windows, or directly with `npm run oneclick`.
 *
 *   1. Make sure Ollama is answering (starts `ollama serve` if it is installed but idle).
 *   2. Pull a chat model if none are installed.
 *   3. Create .env from .env.example.
 *   4. npm install when node_modules is missing or older than package.json.
 *   5. Build when there is no build, or the source changed since the last one.
 *   6. Start the server on localhost and open the browser.
 */

import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4028;
const APP_URL = `http://localhost:${PORT}`;
const OLLAMA_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
/** The model the README quick start uses; override with AICOLLAB_MODEL. */
const DEFAULT_MODEL = process.env.AICOLLAB_MODEL || 'qwen2.5:7b';
const IS_WINDOWS = process.platform === 'win32';
const NEXT_BIN = join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');

const step = (msg) => console.log(`\n==> ${msg}`);
const info = (msg) => console.log(`    ${msg}`);
const warn = (msg) => console.log(`    ! ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) {
  console.error(`\n[AICollab] ${msg}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: 'inherit',
      // npm is a .cmd on Windows, which Node only launches through a shell.
      shell: IS_WINDOWS && !command.endsWith('.exe') && command !== process.execPath,
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`))
    );
  });
}

async function fetchJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ── 1. Ollama ───────────────────────────────────────────────────────────────

async function ollamaModels() {
  const data = await fetchJson(`${OLLAMA_URL}/api/tags`);
  return (data.models || []).map((m) => m.name);
}

function findOllamaBinary() {
  if (IS_WINDOWS && process.env.LOCALAPPDATA) {
    const installed = join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe');
    if (existsSync(installed)) return installed;
  }
  return 'ollama';
}

async function ensureOllama() {
  step(`Checking Ollama at ${OLLAMA_URL}`);
  try {
    return await ollamaModels();
  } catch {
    info('Not running, starting "ollama serve"...');
  }

  try {
    const child = spawn(findOllamaBinary(), ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Reported below as "not reachable".
  }

  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    try {
      return await ollamaModels();
    } catch {
      // Still starting.
    }
  }

  fail(
    'Ollama is not reachable. Install it from https://ollama.com/download (or re-run ' +
      'AICollab.cmd, which installs it), start the Ollama app, then try again.'
  );
}

// ── 2. Model ────────────────────────────────────────────────────────────────

async function ensureModel(installed) {
  step('Checking installed models');
  if (installed.length > 0) {
    info(`Found: ${installed.join(', ')}`);
    return;
  }

  info(`None installed. Downloading ${DEFAULT_MODEL} (about 4.7 GB, one time only)...`);
  // The HTTP API works even when the ollama CLI is not on PATH.
  const response = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: DEFAULT_MODEL, stream: true }),
  });
  if (!response.ok || !response.body) {
    fail(`Could not download ${DEFAULT_MODEL} (HTTP ${response.status}).`);
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let lastLine = '';
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.error) fail(`Model download failed: ${event.error}`);
      const pct =
        event.total && event.completed
          ? ` ${Math.floor((event.completed / event.total) * 100)}%`
          : '';
      const text = `${event.status}${pct}`;
      if (text !== lastLine) {
        process.stdout.write(`\r    ${text.padEnd(60)}`);
        lastLine = text;
      }
    }
  }
  process.stdout.write('\n');

  const after = await ollamaModels();
  if (!after.length) fail(`Download finished but Ollama still lists no models.`);
  info(`Installed ${DEFAULT_MODEL}`);
}

// ── 3–5. Project files ──────────────────────────────────────────────────────

function mtime(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

/** Newest modification time under a path, skipping nothing inside it. */
function newest(path) {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.mtimeMs;
  let latest = stat.mtimeMs;
  for (const entry of readdirSync(path)) {
    latest = Math.max(latest, newest(join(path, entry)));
  }
  return latest;
}

function ensureEnv() {
  step('Checking .env');
  const env = join(ROOT, '.env');
  if (existsSync(env)) {
    info('Present');
    return;
  }
  copyFileSync(join(ROOT, '.env.example'), env);
  info('Created from .env.example (local Ollama defaults, no keys needed)');
}

async function ensureDependencies() {
  step('Checking dependencies');
  const marker = join(ROOT, 'node_modules', '.package-lock.json');
  if (existsSync(NEXT_BIN) && mtime(marker) >= mtime(join(ROOT, 'package.json'))) {
    info('Up to date');
    return;
  }
  info('Running npm install (first run takes a minute or two)...');
  await run('npm', ['install', '--no-audit', '--no-fund']);
}

/** Everything whose change makes the production build out of date. */
const BUILD_INPUTS = [
  'src',
  'public',
  'package.json',
  '.env',
  'next.config.mjs',
  'tailwind.config.js',
  'postcss.config.js',
  'tsconfig.json',
  'image-hosts.config.mjs',
];

/**
 * Written only after `next build` succeeds. Next writes BUILD_ID partway
 * through, so a build interrupted by closing the window would look complete.
 */
const BUILD_STAMP = join(ROOT, '.next', '.one-click-built');

async function ensureBuild() {
  step('Checking build');
  const built = existsSync(join(ROOT, '.next', 'BUILD_ID')) ? mtime(BUILD_STAMP) : 0;
  const changed = Math.max(...BUILD_INPUTS.map((p) => newest(join(ROOT, p))));
  if (built && built >= changed) {
    info('Up to date');
    return;
  }
  info(
    built ? 'Source changed since last build, rebuilding...' : 'Building (one time, ~1 minute)...'
  );
  await run(process.execPath, [NEXT_BIN, 'build']);
  writeFileSync(BUILD_STAMP, new Date().toISOString());
}

// ── 6. Serve ────────────────────────────────────────────────────────────────

async function appIsUp() {
  try {
    const response = await fetch(`${APP_URL}/api/ai/models`, { signal: AbortSignal.timeout(2000) });
    const data = await response.json();
    return data?.provider === 'OLLAMA';
  } catch {
    return false;
  }
}

function openBrowser(url) {
  // rundll32 avoids cmd.exe quoting rules for `start`.
  const [command, args] = IS_WINDOWS
    ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin'
      ? ['open', [url]]
      : ['xdg-open', [url]];
  const child = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true });
  child.on('error', () => info(`Open ${url} in your browser.`));
  child.unref();
}

async function serve() {
  step('Starting AICollab');
  // Localhost only. Use `npm run serve:lan` to deliberately expose it.
  const server = spawn(
    process.execPath,
    [NEXT_BIN, 'start', '-p', String(PORT), '-H', '127.0.0.1'],
    {
      cwd: ROOT,
      stdio: 'inherit',
    }
  );
  server.on('exit', (code) => process.exit(code ?? 0));
  const stop = () => server.kill();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    if (await appIsUp()) {
      console.log(`\n    AICollab is running at ${APP_URL}`);
      console.log('    Keep this window open while you use it. Close it (or Ctrl+C) to stop.\n');
      openBrowser(`${APP_URL}/live-chatroom`);
      return;
    }
  }
  warn(`Server did not answer within 60s. Check the output above, or open ${APP_URL}.`);
}

// ────────────────────────────────────────────────────────────────────────────

const [major] = process.versions.node.split('.').map(Number);
if (major < 20) fail(`Node.js 20 or newer is required (found ${process.versions.node}).`);

try {
  // A second double-click while it is running just reopens the tab; rebuilding
  // under a live server would break it.
  if (await appIsUp()) {
    step(`AICollab is already running at ${APP_URL}`);
    openBrowser(`${APP_URL}/live-chatroom`);
    process.exit(0);
  }

  const models = await ensureOllama();
  await ensureModel(models);
  ensureEnv();
  await ensureDependencies();
  await ensureBuild();
  await serve();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
