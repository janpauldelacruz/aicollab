/**
 * Server-side Ollama integration.
 *
 * Ollama exposes an OpenAI-compatible surface at `/v1/chat/completions`, so the
 * shapes returned here match what the rest of the app already expects from the
 * hosted providers (`choices[0].message.content`, streaming deltas, etc.).
 */

export const OLLAMA_PROVIDER = 'OLLAMA';

/** Default local Ollama daemon. Override with OLLAMA_BASE_URL. */
const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

export function getOllamaBaseUrl(): string {
  const raw = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, '');
}

export interface OllamaModelInfo {
  /** Full Ollama tag, e.g. "qwen2.5:14b" — this is what you pass as `model`. */
  id: string;
  /** Friendly display name, e.g. "Qwen2.5 14B". */
  label: string;
  family: string;
  parameterSize: string;
  quantization: string;
  sizeGB: number;
  /** True when the model can accept images. */
  vision: boolean;
}

interface RawOllamaTag {
  name: string;
  size?: number;
  details?: {
    family?: string;
    families?: string[] | null;
    parameter_size?: string;
    quantization_level?: string;
  };
}

/** Model families in the local library that accept image input. */
const VISION_FAMILIES = ['mllama', 'qwen3vl', 'clip', 'llava', 'minicpm'];

/** Segments that read better fully capitalized. */
const ACRONYMS = new Set(['vl', 'v', 'ai', 'llm', 'moe', 'it', 'r1']);

function prettifySegment(part: string): string {
  if (ACRONYMS.has(part.toLowerCase())) return part.toUpperCase();
  if (/^\d/.test(part)) return part;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function prettifyTag(tag: string): string {
  const [name, version] = tag.split(':');
  // Keep dots (they are part of version numbers like "qwen2.5"), split on - and _.
  const base = name.split(/[-_]/).map(prettifySegment).join(' ').trim();
  if (!version || version === 'latest') return base;
  return `${base} ${version.toUpperCase()}`;
}

function isVision(raw: RawOllamaTag): boolean {
  const haystack = [raw.details?.family, ...(raw.details?.families || []), raw.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return VISION_FAMILIES.some((f) => haystack.includes(f));
}

export function normalizeOllamaModel(raw: RawOllamaTag): OllamaModelInfo {
  return {
    id: raw.name,
    label: prettifyTag(raw.name),
    family: raw.details?.family || 'unknown',
    parameterSize: raw.details?.parameter_size || '',
    quantization: raw.details?.quantization_level || '',
    sizeGB: raw.size ? Math.round((raw.size / 1024 ** 3) * 100) / 100 : 0,
    vision: isVision(raw),
  };
}

/** Lists models pulled on the local Ollama host. Throws if the daemon is down. */
export async function listOllamaModels(): Promise<OllamaModelInfo[]> {
  const response = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
    // Model list changes when the user pulls/removes a model, never cache it.
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status} for /api/tags`);
  }

  const data = (await response.json()) as { models?: RawOllamaTag[] };
  return (data.models || []).map(normalizeOllamaModel).sort((a, b) => a.id.localeCompare(b.id));
}

export interface OllamaChatArgs {
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  stream?: boolean;
  parameters?: Record<string, unknown>;
}

/**
 * Calls Ollama's OpenAI-compatible chat endpoint.
 * Returns the parsed JSON body when `stream` is false, or the raw `Response`
 * (an SSE stream) when it is true.
 */
export async function ollamaChatCompletion(args: OllamaChatArgs): Promise<any> {
  const { model, messages, stream = false, parameters = {} } = args;

  const response = await fetch(`${getOllamaBaseUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream, ...parameters }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error: any = new Error(detail || `Ollama request failed with status ${response.status}`);
    error.statusCode = response.status;
    error.llmProvider = OLLAMA_PROVIDER;
    throw error;
  }

  return stream ? response : response.json();
}

/** Wraps a "connection refused"-style failure in an actionable message. */
export function describeOllamaFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/ECONNREFUSED|fetch failed|Failed to fetch|ENOTFOUND/i.test(message)) {
    return `Cannot reach Ollama at ${getOllamaBaseUrl()}. Start it with "ollama serve" (or launch the Ollama app), then retry.`;
  }
  return message;
}
