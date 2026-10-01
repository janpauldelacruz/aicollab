/**
 * Free hosted AI providers.
 *
 * Every provider here speaks the OpenAI chat-completions protocol and offers a
 * free tier with a free key. That one protocol means one client handles all of
 * them — see openaiCompat.ts. (Pollinations' old keyless API is deprecated and
 * no longer answers reliably, so every provider now needs a key.)
 *
 * Model ids in the app are namespaced "@<provider>/<model>", e.g.
 * "@groq/llama-3.3-70b-versatile" or "@openrouter/qwen/qwen3.8-27b:free". The
 * leading "@" keeps them distinct from Ollama tags ("qwen2.5:7b") and from the
 * older hosted ids ("gemini/gemini-2.5-flash"), so routing is unambiguous.
 *
 * Safe to import on the client: no keys or secrets live here.
 */

export interface FreeModel {
  id: string;
  label: string;
}

export interface FreeProvider {
  /** Matches the provider id used for stored user keys. */
  id: string;
  /** Lowercase slug used in "@slug/model" ids. */
  slug: string;
  label: string;
  chatUrl: string;
  /** OpenAI-style GET /models listing, when the provider has one. */
  modelsUrl?: string;
  keyRequired: boolean;
  /** Server-wide fallback key, for single-user installs. */
  envKey?: string;
  signupUrl: string;
  /** What the free tier actually gives you, in a few words. */
  freeTier: string;
  /** Keep only these ids from a live model listing (e.g. OpenRouter's ":free"). */
  freeOnly?: (modelId: string) => boolean;
  /** Shown when the live listing is unavailable. */
  fallbackModels: FreeModel[];
}

export const FREE_PROVIDERS: FreeProvider[] = [
  {
    id: 'GROQ',
    slug: 'groq',
    label: 'Groq',
    chatUrl: 'https://api.groq.com/openai/v1/chat/completions',
    modelsUrl: 'https://api.groq.com/openai/v1/models',
    keyRequired: true,
    envKey: 'GROQ_API_KEY',
    signupUrl: 'https://console.groq.com/keys',
    freeTier: 'Free tier, very fast',
    fallbackModels: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
    ],
  },
  {
    id: 'OPENROUTER',
    slug: 'openrouter',
    label: 'OpenRouter',
    chatUrl: 'https://openrouter.ai/api/v1/chat/completions',
    modelsUrl: 'https://openrouter.ai/api/v1/models',
    keyRequired: true,
    envKey: 'OPENROUTER_API_KEY',
    signupUrl: 'https://openrouter.ai/keys',
    freeTier: 'Every ":free" model at no cost',
    freeOnly: (id) => id.endsWith(':free'),
    fallbackModels: [
      { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (free)' },
      { id: 'qwen/qwen3.8-27b:free', label: 'Qwen 3.8 27B (free)' },
    ],
  },
  {
    id: 'GEMINI',
    slug: 'gemini',
    label: 'Google Gemini',
    chatUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    keyRequired: true,
    envKey: 'GEMINI_API_KEY',
    signupUrl: 'https://aistudio.google.com/apikey',
    freeTier: 'Free tier in AI Studio',
    freeOnly: (id) => id.includes('gemini') && !/embedding|image|tts|audio|live/i.test(id),
    fallbackModels: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    ],
  },
  {
    id: 'CEREBRAS',
    slug: 'cerebras',
    label: 'Cerebras',
    chatUrl: 'https://api.cerebras.ai/v1/chat/completions',
    modelsUrl: 'https://api.cerebras.ai/v1/models',
    keyRequired: true,
    envKey: 'CEREBRAS_API_KEY',
    signupUrl: 'https://cloud.cerebras.ai',
    freeTier: 'Free tier, very fast',
    fallbackModels: [
      { id: 'llama3.1-8b', label: 'Llama 3.1 8B' },
      { id: 'gpt-oss-120b', label: 'GPT-OSS 120B' },
    ],
  },
  {
    id: 'MISTRAL',
    slug: 'mistral',
    label: 'Mistral AI',
    chatUrl: 'https://api.mistral.ai/v1/chat/completions',
    modelsUrl: 'https://api.mistral.ai/v1/models',
    keyRequired: true,
    envKey: 'MISTRAL_API_KEY',
    signupUrl: 'https://console.mistral.ai/api-keys',
    freeTier: 'Free "Experiment" plan',
    freeOnly: (id) => !/embed|moderation|ocr/i.test(id),
    fallbackModels: [
      { id: 'mistral-small-latest', label: 'Mistral Small' },
      { id: 'open-mistral-nemo', label: 'Mistral Nemo' },
    ],
  },
  {
    id: 'GITHUB_MODELS',
    slug: 'github',
    label: 'GitHub Models',
    chatUrl: 'https://models.github.ai/inference/chat/completions',
    modelsUrl: 'https://models.github.ai/catalog/models',
    keyRequired: true,
    envKey: 'GITHUB_MODELS_TOKEN',
    signupUrl: 'https://github.com/settings/personal-access-tokens',
    freeTier: 'Free with a GitHub token (models:read)',
    fallbackModels: [
      { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
    ],
  },
  {
    id: 'HUGGINGFACE',
    slug: 'huggingface',
    label: 'Hugging Face',
    chatUrl: 'https://router.huggingface.co/v1/chat/completions',
    modelsUrl: 'https://router.huggingface.co/v1/models',
    keyRequired: true,
    envKey: 'HF_TOKEN',
    signupUrl: 'https://huggingface.co/settings/tokens',
    freeTier: 'Monthly free credits',
    fallbackModels: [{ id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B' }],
  },
  {
    id: 'NVIDIA',
    slug: 'nvidia',
    label: 'NVIDIA NIM',
    chatUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
    modelsUrl: 'https://integrate.api.nvidia.com/v1/models',
    keyRequired: true,
    envKey: 'NVIDIA_API_KEY',
    signupUrl: 'https://build.nvidia.com',
    freeTier: 'Free developer credits',
    fallbackModels: [{ id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' }],
  },
  {
    id: 'SAMBANOVA',
    slug: 'sambanova',
    label: 'SambaNova',
    chatUrl: 'https://api.sambanova.ai/v1/chat/completions',
    modelsUrl: 'https://api.sambanova.ai/v1/models',
    keyRequired: true,
    envKey: 'SAMBANOVA_API_KEY',
    signupUrl: 'https://cloud.sambanova.ai/apis',
    freeTier: 'Free tier',
    fallbackModels: [{ id: 'Meta-Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' }],
  },
  {
    id: 'POLLINATIONS',
    slug: 'pollinations',
    label: 'Pollinations',
    chatUrl: 'https://gen.pollinations.ai/v1/chat/completions',
    modelsUrl: 'https://gen.pollinations.ai/v1/models',
    keyRequired: true,
    envKey: 'POLLINATIONS_API_KEY',
    signupUrl: 'https://enter.pollinations.ai/keys',
    freeTier: 'Free daily allowance',
    freeOnly: (id) => !/image|flux|kontext|tts|audio|video|whisper|embed|midijourney/i.test(id),
    fallbackModels: [{ id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' }],
  },
  {
    id: 'COHERE',
    slug: 'cohere',
    label: 'Cohere',
    chatUrl: 'https://api.cohere.ai/compatibility/v1/chat/completions',
    keyRequired: true,
    envKey: 'COHERE_API_KEY',
    signupUrl: 'https://dashboard.cohere.com/api-keys',
    freeTier: 'Free trial key',
    fallbackModels: [
      { id: 'command-a-03-2025', label: 'Command A' },
      { id: 'command-r7b-12-2024', label: 'Command R7B' },
    ],
  },
];

const BY_SLUG = new Map(FREE_PROVIDERS.map((p) => [p.slug, p]));

/** "@groq/llama-3.3-70b-versatile" → { provider, model }, or null for non-free ids. */
export function parseFreeModelId(
  modelId: string
): { provider: FreeProvider; model: string } | null {
  const match = /^@([a-z0-9_-]+)\/(.+)$/.exec(modelId);
  if (!match) return null;
  const provider = BY_SLUG.get(match[1]);
  return provider ? { provider, model: match[2] } : null;
}

export function freeModelId(provider: FreeProvider, model: string): string {
  return `@${provider.slug}/${model}`;
}

export function getFreeProvider(id: string): FreeProvider | undefined {
  return FREE_PROVIDERS.find((p) => p.id === id);
}
