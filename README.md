# Next.js

A modern Next.js 15 application built with TypeScript and Tailwind CSS.

## 🚀 Features

- **Next.js 15** - Latest version with improved performance and features
- **React 19** - Latest React version with enhanced capabilities
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development

## 🛠️ Installation

1. Install dependencies:
  ```bash
  npm install
  # or
  yarn install
  ```

2. Start the development server:
  ```bash
  npm run dev
  # or
  yarn dev
  ```
3. Open [http://localhost:4028](http://localhost:4028) with your browser to see the result.

## 🧠 Local AI models (Ollama)

Every agent in AICollab runs on your **local Ollama daemon** — no API keys, no
credits, no data leaving the machine.

### Setup

1. Install [Ollama](https://ollama.com/download) and make sure it is running:
   ```bash
   ollama serve
   ```
2. Pull at least one chat model:
   ```bash
   ollama pull qwen2.5:7b
   ```
3. Start the app (`npm run dev`) and open the Live Chatroom — the landing screen
   shows `Ollama connected · N models installed` when the daemon is reachable.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Where the Ollama daemon lives. Point this at a remote host to use another machine's GPU. |

### How it is wired

- `src/lib/ai/ollama.ts` — server-side client for Ollama's OpenAI-compatible
  `/v1/chat/completions` endpoint, plus model discovery via `/api/tags`.
- `GET /api/ai/models` — lists the models actually installed on the host. Every
  model picker in the UI is populated from this, so pulling a new model makes it
  selectable after a refresh.
- `POST /api/ai/chat-completion` — send `provider: "OLLAMA"` with any installed
  model tag. Both streaming and non-streaming are supported; hosted providers
  (`OPEN_AI`, `ANTHROPIC`, `GEMINI`, `PERPLEXITY`) still work when their API keys
  are set.
- `src/lib/ai/multiAgentChat.ts` — the three chatroom agents (Orion the
  architect, Atlas the researcher, Zara the coder). Each has a preferred model
  list and falls back to whatever is installed.

Example request:

```bash
curl -X POST http://localhost:4028/api/ai/chat-completion -H "Content-Type: application/json" -d '{"provider":"OLLAMA","model":"qwen2.5:7b","messages":[{"role":"user","content":"Hello"}]}'
```

### Troubleshooting

- **"Ollama unreachable"** — the daemon is not running. Start it with `ollama serve`.
- **"model ... is not installed"** — run `ollama pull <tag>` for the model the
  agent is assigned.
- Large models load into memory on first use, so the first turn of a session can
  take 30-60s before tokens start flowing.

## 📁 Project Structure

```
nextjs/
├── public/             # Static assets
├── src/
│   ├── app/            # App router components
│   │   ├── layout.tsx  # Root layout component
│   │   └── page.tsx    # Main page component
│   ├── components/     # Reusable UI components
│   ├── styles/         # Global styles and Tailwind configuration
├── next.config.mjs     # Next.js configuration
├── package.json        # Project dependencies and scripts
├── postcss.config.js   # PostCSS configuration
└── tailwind.config.js  # Tailwind CSS configuration

```

## 🧩 Page Editing

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

## 🎨 Styling

This project uses Tailwind CSS for styling with the following features:
- Utility-first approach for rapid development
- Custom theme configuration
- Responsive design utilities
- PostCSS and Autoprefixer integration

## 📦 Available Scripts

- `npm run dev` - Start development server on port 4028
- `npm run build` - Build the application for production
- `npm run start` - Start the development server
- `npm run serve` - Start the production server
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier

## 📱 Deployment

Build the application for production:

  ```bash
  npm run build
  ```

## 📚 Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial

You can check out the [Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 🙏 Acknowledgments

- Built with [Rocket.new](https://rocket.new)
- Powered by Next.js and React
- Styled with Tailwind CSS

Built with ❤️ on Rocket.new
## 📱 Access from anywhere (Tailscale)

The app serves on all interfaces, so any device on your Tailscale network can
reach it. Ollama itself stays bound to `127.0.0.1` — only the Next.js server
talks to it, so your models are never exposed.

| From | URL |
| --- | --- |
| This machine | http://localhost:4028 |
| Same WiFi | http://192.168.50.55:4028 |
| Anywhere (Tailscale) | http://100.90.141.101:4028 |

### One-time setup on a new device

1. Install Tailscale and sign in with the same account.
2. Open the Tailscale URL above.

### Running it

- `npm run serve:lan` — production server bound to `0.0.0.0:4028`
- A scheduled task named **AICollab Server** starts it at logon, so the app is
  up whenever the PC is on.

### Notes

- Sessions live in each browser's local storage, so history on your phone is
  separate from this PC. Enable the Supabase sync that ships in `supabase/` if
  you want one shared history.
- The PC must be awake for this to work. Check Windows sleep settings if the
  URL stops responding while you are out.
