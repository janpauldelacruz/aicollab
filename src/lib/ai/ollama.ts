/**
 * Server-side Ollama integration.
 *
 * Chat goes through Ollama's native `/api/chat` (it accepts num_ctx and
 * keep_alive; the OpenAI-compatible endpoint does not), and results are returned
 * in the OpenAI shape the rest of the app expects from the hosted providers
 * (`choices[0].message.content`, streaming deltas).
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
  parameters?: Record<string, unknown>;
}

/**
 * Context window requested for every call. Ollama's own default (2–4K tokens
 * depending on version) is smaller than a session prompt, and it silently drops
 * whatever does not fit. Fixed rather than sized per request: changing num_ctx
 * forces Ollama to reload the model. Override with OLLAMA_NUM_CTX.
 */
const DEFAULT_NUM_CTX = 8192;

/** Keeps the model loaded while the user reads between turns (Ollama default: 5m). */
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';

/** Conservative for code and markdown, which tokenize denser than prose. */
const CHARS_PER_TOKEN = 3;

export function getOllamaNumCtx(): number {
  const value = Number(process.env.OLLAMA_NUM_CTX);
  return Number.isFinite(value) && value >= 2048 ? Math.floor(value) : DEFAULT_NUM_CTX;
}

/** Maps the OpenAI-style parameters the app sends onto Ollama's options. */
function toOllamaOptions(parameters: Record<string, unknown>, numCtx: number) {
  const options: Record<string, unknown> = { num_ctx: numCtx };
  if (typeof parameters.temperature === 'number') options.temperature = parameters.temperature;
  if (typeof parameters.top_p === 'number') options.top_p = parameters.top_p;
  if (typeof parameters.seed === 'number') options.seed = parameters.seed;
  const maxTokens = parameters.max_tokens ?? parameters.max_completion_tokens;
  if (typeof maxTokens === 'number') options.num_predict = maxTokens;
  if (typeof parameters.stop === 'string') options.stop = [parameters.stop];
  if (Array.isArray(parameters.stop)) options.stop = parameters.stop;
  return options;
}

function contentLength(content: unknown): number {
  return typeof content === 'string' ? content.length : JSON.stringify(content ?? '').length;
}

/**
 * Shrinks a conversation to fit the context window, so the model sees a
 * deliberate cut instead of Ollama's silent one. Drops the oldest turns first,
 * keeping system messages and the final instruction; if that is not enough,
 * trims the middle of the longest remaining message (usually the workspace).
 */
export function fitToContext<T extends { role: string; content: unknown }>(
  messages: T[],
  numCtx: number,
  reserveTokens: number
): T[] {
  const budget = Math.max(1024, numCtx - reserveTokens) * CHARS_PER_TOKEN;
  const fitted = messages.map((m) => ({ ...m }));
  let total = fitted.reduce((sum, m) => sum + contentLength(m.content), 0);

  while (total > budget) {
    const oldest = fitted.findIndex((m, i) => m.role !== 'system' && i < fitted.length - 1);
    if (oldest === -1) break;
    total -= contentLength(fitted[oldest].content);
    fitted.splice(oldest, 1);
  }

  if (total > budget) {
    const longest = fitted
      .filter((m) => typeof m.content === 'string')
      .reduce<T | null>(
        (a, b) => (!a || contentLength(b.content) > contentLength(a.content) ? b : a),
        null
      );
    if (longest) {
      const text = longest.content as string;
      const keep = Math.max(0, text.length - (total - budget) - 64);
      const head = Math.floor(keep * 0.6);
      longest.content = `${text.slice(0, head)}\n… (trimmed to fit the model's context window) …\n${text.slice(text.length - (keep - head))}`;
    }
  }

  return fitted;
}

/** Reasoning models can emit their scratchpad inline; agents should only see the answer. */
function stripThinking(text: string): string {
  return text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/i, '');
}

export interface OllamaChunk {
  content: string;
  done: boolean;
  doneReason?: string;
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * Streams a chat completion from Ollama's native /api/chat endpoint, which —
 * unlike the OpenAI-compatible one — accepts num_ctx and keep_alive.
 * Always streams upstream: headers arrive immediately, so a slow generation on
 * a CPU-only machine is not cut off by Node's 5-minute fetch header timeout.
 */
export async function* ollamaChatStream(args: OllamaChatArgs): AsyncGenerator<OllamaChunk> {
  const { model, parameters = {} } = args;
  const numCtx = getOllamaNumCtx();
  const options = toOllamaOptions(parameters, numCtx);
  const reserve = (typeof options.num_predict === 'number' ? options.num_predict : 1024) + 256;
  const messages = fitToContext(args.messages, numCtx, reserve);

  const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true, options, keep_alive: KEEP_ALIVE }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    let message = detail;
    try {
      message = JSON.parse(detail).error || detail;
    } catch {
      // Not JSON; use the raw body.
    }
    const error: any = new Error(message || `Ollama request failed with status ${response.status}`);
    error.statusCode = response.status;
    error.llmProvider = OLLAMA_PROVIDER;
    throw error;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const parse = (line: string): OllamaChunk | null => {
    if (!line.trim()) return null;
    const event = JSON.parse(line);
    if (event.error) {
      const error: any = new Error(event.error);
      error.statusCode = 500;
      error.llmProvider = OLLAMA_PROVIDER;
      throw error;
    }
    return {
      content: event.message?.content ?? '',
      done: !!event.done,
      doneReason: event.done_reason,
      promptTokens: event.prompt_eval_count,
      completionTokens: event.eval_count,
    };
  };

  for await (const part of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(part, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const chunk = parse(line);
      if (chunk) yield chunk;
    }
  }
  const last = parse(buffer + decoder.decode());
  if (last) yield last;
}

/** Non-streaming completion, returned in the OpenAI shape the rest of the app reads. */
export async function ollamaChatCompletion(args: OllamaChatArgs) {
  let content = '';
  let final: OllamaChunk | undefined;

  for await (const chunk of ollamaChatStream(args)) {
    content += chunk.content;
    if (chunk.done) final = chunk;
  }

  const promptTokens = final?.promptTokens ?? 0;
  const completionTokens = final?.completionTokens ?? 0;
  return {
    object: 'chat.completion',
    model: args.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: stripThinking(content) },
        finish_reason: final?.doneReason === 'length' ? 'length' : 'stop',
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/** Wraps a "connection refused"-style failure in an actionable message. */
export function describeOllamaFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/ECONNREFUSED|fetch failed|Failed to fetch|ENOTFOUND/i.test(message)) {
    return `Cannot reach Ollama at ${getOllamaBaseUrl()}. Start it with "ollama serve" (or launch the Ollama app), then retry.`;
  }
  return message;
}
