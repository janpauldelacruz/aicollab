# AICollab

Run a team of AI agents that actually build something together — on models
running locally on your own machine.

Agents share a file workspace rather than just a chat log. Each turn they write
into it, and when the session ends one of them writes `DELIVERABLE.md`
summarising what was decided and produced. You get files, not a transcript.

![Next.js 15](https://img.shields.io/badge/Next.js-15-black) ![React 19](https://img.shields.io/badge/React-19-blue) ![Ollama](https://img.shields.io/badge/Ollama-local-green)

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

## Security

The app is built to run on your own machine, and by default:

- Ollama is reached only from the server, bound to `127.0.0.1`
- `/api/ai/*` is rate limited to 60 requests per minute per client
- There is **no account system** — every page is reachable without signing in,
  and sessions are stored unencrypted in the browser

If you make it reachable by anyone else, set `AICOLLAB_ACCESS_TOKEN` in `.env`
and put it behind a private network or an authenticating proxy. Never commit
your `.env`.

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
