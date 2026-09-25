# AICollab

Run a team of AI agents that actually build something together — on models
running locally on your own machine.

Agents share a file workspace rather than just a chat log. Each turn they write
into it, and when the session ends one of them writes `DELIVERABLE.md`
summarising what was decided and produced. You get files, not a transcript.

**Free and open source.** Runs entirely on your own machine with local models — no account,
no API key, no data leaving your computer unless you choose a hosted model.

![Next.js 15](https://img.shields.io/badge/Next.js-15-black) ![React 19](https://img.shields.io/badge/React-19-blue) ![Ollama](https://img.shields.io/badge/Ollama-local-green) ![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-orange)

## Why it exists

Most multi-agent demos produce long, agreeable conversations and nothing you can
use. AICollab is built around three constraints that stop that:

- **Roles conflict by design.** The architect must commit to one option and
  reject another; the critic is forbidden from agreeing; the implementer must
  write real code every turn, never a plan.
- **Work goes in files.** Agents write with a `FILE:` protocol into a shared
  workspace. Chat is discarded, files survive.
- **Repetition is caught.** If an agent restates its own previous turn, it is
  re-run with an explicit warning.

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com) with at least one chat model pulled

No API keys are needed. Hosted models (OpenAI, Anthropic, Gemini, Perplexity)
are optional and off by default.

## One-click start (Windows)

Double-click **`AICollab.cmd`**. It installs whatever is missing (Node.js and
Ollama via `winget`, the `qwen2.5:7b` model, npm packages), creates `.env`,
builds, starts the app on `http://localhost:4028` and opens your browser.

The first run downloads about 5 GB and takes a while. Later runs skip every step
that is already done and open in seconds; if the app is already running,
double-clicking just reopens the tab. Keep the window open while you use it.

For a desktop icon: right-click `AICollab.cmd` → **Send to → Desktop (create
shortcut)**. On macOS/Linux, install Node.js and Ollama, then run
`npm run oneclick`.

## Quick start

```bash
git clone https://github.com/janpauldelacruz/aicollab
cd aicollab
npm install
cp .env.example .env     # defaults work as-is for local Ollama
ollama pull qwen2.5:7b
npm run dev
```

Open http://localhost:4028, go to **Live Chatroom**, and press Start.

## How a session works

1. **Session Setup** — name the goal, pick a roster. Each role comes with a
   personality, system prompt and behaviour dials you can edit.
2. **Live Chatroom** — agents take turns. Choose an orchestration mode (round
   robin, parallel, sequential, priority, reactive), send directives mid-session,
   pin an agent, or skip one.
3. **Results** — transcript, the files produced, analytics, and a one-click
   `.zip` of the whole session.

## Choosing models

The roster picker lists whatever Ollama has installed. One tip that matters:
**put every agent on the same model.** A consumer GPU holds one mid-size model at
a time, so a mixed roster makes Ollama unload and reload gigabytes between turns
— usually slower than the generation itself. The app warns you when a roster
spans more than one model.

### Memory and context

Every request asks Ollama for an 8K-token context (`OLLAMA_NUM_CTX` in `.env`)
and keeps the model loaded for 30 minutes between turns (`OLLAMA_KEEP_ALIVE`).
Prompts that would not fit are trimmed on purpose — oldest turns first, the
agent's instructions never — instead of being cut silently by Ollama. On a GPU
with less than 8 GB of memory set `OLLAMA_NUM_CTX=4096`; a larger context costs
memory on top of the model itself.

## Project layout

```
src/
├── app/
│   ├── api/ai/            model discovery + chat completion (Ollama first)
│   ├── live-chatroom/     the session itself
│   ├── session-setup/     roster and goal wizard
│   └── session-results/   transcript, artifacts, analytics, export
├── lib/ai/                agents, prompts, workspace, orchestration
└── lib/session/           local persistence, export, live updates
```

## Running it for other people

AICollab can run two ways.

**Single-user (default).** No Supabase configured: every page is open, sessions
live in the browser, and agents use your local Ollama. Nothing to set up.

**Multi-user.** With Supabase configured the app requires an account, and each
user brings their own API key for hosted models:

1. Create a Supabase project and run the migrations in `supabase/migrations/`.
2. Put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env`.
3. Generate an encryption key and set `ENCRYPTION_KEY`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   **Back this up.** Losing it makes every stored key unreadable.
4. Users add their own keys under **API Keys**.

### How credentials are handled

- Keys are encrypted with AES-256-GCM on the server before they are stored.
  The browser never encrypts, decrypts or holds a key after submission.
- Stored keys **cannot be read back** — the UI shows only a hint like
  `sk-pr…4f2a`. Rotate to replace one, as GitHub and Stripe do.
- Each request uses the caller's own key, so one user's usage is never billed
  to another. The caller is identified from their session cookie, never from
  the request body, and row-level security scopes every query.
- `/api/ai/*` is rate limited to 60 requests per minute per client.

### A word about local models when hosting

Ollama runs on the machine hosting the app, and a consumer GPU serves roughly
one session at a time. If several people use a hosted instance at once, point
them at hosted models with their own keys — a shared local GPU will not keep up.

## 📱 Access from your other devices

`npm run serve:lan` binds the production server to `0.0.0.0:4028`, so any device
on your network can reach it. Ollama stays bound to `127.0.0.1` — only the
Next.js server talks to it, so your models are never exposed to the network.

| From         | URL                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------ |
| This machine | `http://localhost:4028`                                                                          |
| Same network | `http://<your-lan-ip>:4028`                                                                      |
| Anywhere     | `http://<your-tailscale-host>:4028` (install [Tailscale](https://tailscale.com) on both devices) |

Find your addresses with `ipconfig` (Windows) or `ip addr` (Linux/macOS), and
`tailscale status` for the Tailscale one.

### Running it persistently

- `npm run serve:lan` — production server on all interfaces
- `start-aicollab.cmd` — the same thing, for a Windows logon task

### Before exposing it beyond your own devices

The API route that talks to the models is **unauthenticated by default**, which
is fine on a private machine and not fine on the open internet. Set
`AICOLLAB_ACCESS_TOKEN` in `.env` to require a token on `/api/ai/*`, and put the
app behind a private network (Tailscale) or an authenticating proxy rather than
forwarding a port.

### Notes

- Sessions live in each browser's local storage, so history on one device is
  separate from another. Configure Supabase (see `supabase/`) for shared history.
- The host machine must be awake for remote access to work.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
Found a security problem? Please follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

AICollab is free software, licensed under the **GNU Affero General Public License v3.0 or later**
([LICENSE](LICENSE)). You may use, study, modify and share it. If you run a modified version as a
network service, you must offer its source code to that service's users.

Model weights you pull through Ollama are **not** part of this project and carry their own licences
(for example Qwen, Llama, Gemma, Mistral) — check them before commercial use.

