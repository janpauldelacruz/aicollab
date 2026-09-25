# Contributing to AICollab

Thanks for helping. A few ground rules keep the project useful:

1. **Open an issue first** for anything larger than a small fix, so we can agree on the approach.
2. **Keep the core idea intact:** agents with conflicting roles, work written to files, repetition caught.
   Changes that turn sessions back into agreeable chat will not be merged.
3. **Local-first:** features must work with local Ollama models and no API key. Hosted models stay optional.
4. **Checks before a PR:**
   ```bash
   npm install
   npm run lint
   npm run type-check
   npm run build
   ```
5. **Never commit secrets.** `.env` is gitignored; use `.env.example` for new settings.

By contributing you agree that your contributions are licensed under the project's
[AGPL-3.0-or-later](LICENSE) licence.
