import { FREE_PROVIDERS, freeModelId, type FreeModel, type FreeProvider } from './freeProviders';
import { getAuthedUser } from '@/lib/supabase/server';
import { getProviderKey } from '@/lib/supabase/keyVault';

/**
 * Server-side client for every free provider in freeProviders.ts. They all
 * speak OpenAI chat-completions, so one request shape covers them all.
 */

const REQUEST_TIMEOUT_MS = 180_000;
const MODEL_LIST_TTL_MS = 10 * 60_000;
const MAX_MODELS_PER_PROVIDER = 40;

/** Only parameters every provider accepts. Unknown keys get some of them to 400. */
const ALLOWED_PARAMS = ['temperature', 'max_tokens', 'top_p', 'stop'];

function pickParams(parameters: Record<string, unknown> = {}) {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_PARAMS) {
    if (parameters[key] !== undefined) out[key] = parameters[key];
  }
  return out;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
  }
}

/**
 * The key to use for a provider: the signed-in user's own key first, then a
 * server-wide env key (single-user installs), else none.
 */
export async function resolveProviderKey(provider: FreeProvider): Promise<string | null> {
  const user = await getAuthedUser();
  if (user) {
    const own = await getProviderKey(user.id, provider.id);
    if (own) return own;
  }
  const env = provider.envKey ? process.env[provider.envKey]?.trim() : '';
  return env || null;
}

function headersFor(apiKey: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function describeFailure(response: Response, provider: FreeProvider): Promise<string> {
  let detail = '';
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      detail = json?.error?.message || json?.message || json?.error || text;
    } catch {
      detail = text;
    }
  } catch {
    // body unreadable — status alone will have to do
  }
  if (response.status === 401 || response.status === 403) {
    return `${provider.label} rejected the key (HTTP ${response.status}). Check it on the API Keys page.`;
  }
  if (response.status === 429) {
    return `${provider.label} free-tier rate limit hit. Wait a minute or switch provider.`;
  }
  return `${provider.label} HTTP ${response.status}: ${String(detail).slice(0, 300)}`;
}

interface ChatArgs {
  provider: FreeProvider;
  model: string;
  messages: unknown[];
  parameters?: Record<string, unknown>;
  apiKey: string | null;
}

export async function compatChatCompletion(args: ChatArgs) {
  const { provider, model, messages, parameters, apiKey } = args;
  const response = await fetch(provider.chatUrl, {
    method: 'POST',
    headers: headersFor(apiKey),
    body: JSON.stringify({ model, messages, stream: false, ...pickParams(parameters) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new ProviderError(await describeFailure(response, provider), response.status);
  }
  const data = await response.json();
  // Some reasoning models return only `reasoning` with empty content when the
  // token budget runs out; surface that rather than an empty turn.
  const message = data?.choices?.[0]?.message;
  if (message && !message.content && message.reasoning) {
    message.content = String(message.reasoning);
  }
  return data;
}

/** Yields content deltas from an OpenAI-style SSE stream. */
export async function* compatChatStream(args: ChatArgs): AsyncGenerator<string> {
  const { provider, model, messages, parameters, apiKey } = args;
  const response = await fetch(provider.chatUrl, {
    method: 'POST',
    headers: headersFor(apiKey),
    body: JSON.stringify({ model, messages, stream: true, ...pickParams(parameters) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok || !response.body) {
    throw new ProviderError(await describeFailure(response, provider), response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const content = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (content) yield String(content);
      } catch {
        // keep-alive comments and partial frames
      }
    }
  }
}

// ── Model discovery ─────────────────────────────────────────────────────────

export interface CloudProviderModels {
  providerId: string;
  label: string;
  available: boolean;
  keyRequired: boolean;
  freeTier: string;
  signupUrl: string;
  /** True when the list came from the provider; false means the built-in fallback. */
  live: boolean;
  models: FreeModel[];
}

const modelCache = new Map<string, { at: number; models: FreeModel[] }>();

function extractModelIds(body: any): string[] {
  const rows: any[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  return rows
    .map((row) => (typeof row === 'string' ? row : row?.id || row?.name))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => id.replace(/^models\//, ''));
}

async function listLiveModels(provider: FreeProvider, apiKey: string | null): Promise<FreeModel[]> {
  if (!provider.modelsUrl) throw new Error('no listing endpoint');
  const cached = modelCache.get(provider.id);
  if (cached && Date.now() - cached.at < MODEL_LIST_TTL_MS) return cached.models;

  const response = await fetch(provider.modelsUrl, {
    headers: headersFor(apiKey),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const ids = extractModelIds(await response.json())
    .filter((id) => (provider.freeOnly ? provider.freeOnly(id) : true))
    .slice(0, MAX_MODELS_PER_PROVIDER);
  if (ids.length === 0) throw new Error('empty listing');

  const models = ids.map((id) => ({ id: freeModelId(provider, id), label: id }));
  modelCache.set(provider.id, { at: Date.now(), models });
  return models;
}

/** Every free provider, whether the caller can use it, and its models. */
export async function listFreeProviderModels(): Promise<CloudProviderModels[]> {
  return Promise.all(
    FREE_PROVIDERS.map(async (provider) => {
      const apiKey = await resolveProviderKey(provider);
      const available = !provider.keyRequired || !!apiKey;
      const fallback = provider.fallbackModels.map((m) => ({
        id: freeModelId(provider, m.id),
        label: m.label,
      }));

      let models = fallback;
      let live = false;
      if (available) {
        try {
          models = await listLiveModels(provider, apiKey);
          live = true;
        } catch {
          models = fallback;
        }
      }

      return {
        providerId: provider.id,
        label: provider.label,
        available,
        keyRequired: provider.keyRequired,
        freeTier: provider.freeTier,
        signupUrl: provider.signupUrl,
        live,
        models,
      };
    })
  );
}
