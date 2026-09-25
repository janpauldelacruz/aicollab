# Security policy

AICollab can store users' API keys (encrypted with AES-256-GCM) when run in multi-user mode, and its
`/api/ai/*` routes can drive local or hosted models. Please report security issues privately.

## Reporting a vulnerability

- Use GitHub's **"Report a vulnerability"** button (Security tab → Advisories) on this repository.
- Include steps to reproduce, affected version/commit, and impact.
- Please do not open a public issue or disclose the problem before it is fixed.

## Deployment reminders

- Single-user local use: keep the app bound to your machine or private network (see README).
- Before exposing it beyond your own devices, set `AICOLLAB_ACCESS_TOKEN`, put it behind Tailscale or an
  authenticating proxy, and configure `ENCRYPTION_KEY` (back it up) if Supabase is enabled.
