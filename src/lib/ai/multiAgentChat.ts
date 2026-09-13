import { callAIEndpoint } from './aiClient';

export type AIProvider = 'ANTHROPIC' | 'GEMINI' | 'OPEN_AI' | 'PERPLEXITY' | 'CUSTOM' | string;
export type OrchestrationMode = 'round-robin' | 'parallel' | 'sequential' | 'priority' | 'reactive';

// ─── Resilience types ────────────────────────────────────────────────────────

export type AgentErrorType =
  | 'timeout' |'connection_drop' |'rate_limit' |'auth_error' |'model_unavailable' |'unknown';

export interface AgentRetryConfig {
  maxRetries: number;       // default 3
  baseDelayMs: number;      // default 1000
  timeoutMs: number;        // default 30000
  fallbackProviders?: AIProvider[];
}

export interface AgentResilienceState {
  agentId: string;
  retryCount: number;
  lastError: string | null;
  errorType: AgentErrorType | null;
  isFallback: boolean;
  fallbackProvider: AIProvider | null;
  status: 'idle' | 'retrying' | 'failed' | 'fallback_active';
}

export const DEFAULT_RETRY_CONFIG: AgentRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  timeoutMs: 30000,
  fallbackProviders: ['OPEN_AI', 'ANTHROPIC', 'GEMINI'],
};

// ─── Existing types ───────────────────────────────────────────────────────────

export interface AIAgent {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  role: string;
  color: string;
  systemPrompt: string;
  apiKey?: string;
  priority?: number;
  dependencies?: string[];
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentName?: string;
}

export interface ExecutionPlan {
  mode: OrchestrationMode;
  phases: ExecutionPhase[];
  currentPhase: number;
}

export interface ExecutionPhase {
  id: string;
  label: string;
  agentIds: string[];
  parallel: boolean;
  completed: boolean;
}

export interface AgentExecutionResult {
  agentId: string;
  agentName: string;
  content: string;
  durationMs: number;
  success: boolean;
  error?: string;
  errorType?: AgentErrorType;
  retryCount?: number;
  usedFallback?: boolean;
  fallbackProvider?: AIProvider;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function classifyError(err: any): AgentErrorType {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) return 'timeout';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection') || msg.includes('econnreset')) return 'connection_drop';
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')) return 'rate_limit';
  if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('api key')) return 'auth_error';
  if (msg.includes('model') || msg.includes('404') || msg.includes('not found')) return 'model_unavailable';
  return 'unknown';
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// ─── Provider inference ───────────────────────────────────────────────────────

export function inferProvider(model: string): AIProvider {
  const m = model.toLowerCase();
  if (m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('text-')) return 'OPEN_AI';
  if (m.startsWith('claude')) return 'ANTHROPIC';
  if (m.startsWith('gemini') || m.includes('gemini')) return 'GEMINI';
  if (m.includes('sonar') || m.includes('perplexity')) return 'PERPLEXITY';
  if (m.startsWith('llama') || m.startsWith('mistral') || m.startsWith('mixtral')) return 'OPEN_AI';
  return 'OPEN_AI';
}

// ─── Default fallback model per provider ─────────────────────────────────────

const FALLBACK_MODELS: Record<string, string> = {
  OPEN_AI: 'gpt-4o',
  ANTHROPIC: 'claude-sonnet-4-6',
  GEMINI: 'gemini/gemini-2.5-flash',
  PERPLEXITY: 'llama-3.1-sonar-small-128k-online',
};

// ─── Real agents ──────────────────────────────────────────────────────────────

export const REAL_AI_AGENTS: AIAgent[] = [
  {
    id: 'agent-claude',
    name: 'Claude',
    provider: 'ANTHROPIC',
    model: 'claude-sonnet-4-6',
    role: 'architect',
    color: '#a78bfa',
    priority: 1,
    systemPrompt: `You are Claude, an AI assistant made by Anthropic, participating in a collaborative AI chatroom. 
You are working alongside Gemini (Google's AI) and ChatGPT (OpenAI's AI) to collaboratively solve problems and build things together.
Your role is "Architect" — you focus on system design, structure, and thoughtful analysis.
Keep responses concise (2-4 sentences max). Be direct and collaborative. Reference what other AIs said when relevant.
Address the other AIs by name. This is a real-time multi-AI collaboration session.`,
  },
  {
    id: 'agent-gemini',
    name: 'Gemini',
    provider: 'GEMINI',
    model: 'gemini/gemini-2.5-flash',
    role: 'researcher',
    color: '#34d399',
    priority: 2,
    systemPrompt: `You are Gemini, Google's AI assistant, participating in a collaborative AI chatroom. You are working alongside Claude (Anthropic's AI) and ChatGPT (OpenAI's AI) to collaboratively solve problems and build things together.
Your role is "Researcher" — you focus on gathering insights, exploring possibilities, and providing broad context.
Keep responses concise (2-4 sentences max). Be direct and collaborative. Reference what other AIs said when relevant.
Address the other AIs by name. This is a real-time multi-AI collaboration session.`,
  },
  {
    id: 'agent-gpt',
    name: 'ChatGPT',
    provider: 'OPEN_AI',
    model: 'gpt-4o',
    role: 'coder',
    color: '#60a5fa',
    priority: 3,
    systemPrompt: `You are ChatGPT, OpenAI's AI assistant, participating in a collaborative AI chatroom. You are working alongside Claude (Anthropic's AI) and Gemini (Google's AI) to collaboratively solve problems and build things together.
Your role is "Coder" — you focus on implementation details, code, and practical execution.
Keep responses concise (2-4 sentences max). Be direct and collaborative. Reference what other AIs said when relevant.
Address the other AIs by name. This is a real-time multi-AI collaboration session.`,
  },
];

// ─── Build agent from config ──────────────────────────────────────────────────

export function buildAgentFromConfig(configAgent: {
  id: string;
  name: string;
  role: string;
  model: string;
  systemPrompt?: string;
  personality?: string;
  provider?: string;
  apiKey?: string;
  priority?: number;
  dependencies?: string[];
}, allAgentNames: string[]): AIAgent {
  const otherNames = allAgentNames.filter((n) => n !== configAgent.name);
  const othersStr = otherNames.length > 0 ? otherNames.join(', ') : 'the other agents';

  const provider = configAgent.provider && configAgent.provider !== 'CUSTOM'
    ? configAgent.provider
    : inferProvider(configAgent.model);

  const agentColors = ['#a78bfa', '#34d399', '#60a5fa', '#f59e0b', '#f472b6', '#fb7185', '#38bdf8', '#4ade80'];
  const colorIndex = Math.abs(configAgent.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % agentColors.length;

  const defaultSystemPrompt = `You are ${configAgent.name}, an AI agent participating in a collaborative AI chatroom.
You are working alongside ${othersStr} to collaboratively solve problems and build things together.
Your role is "${configAgent.role}"${configAgent.personality ? ` — ${configAgent.personality}` : ''}.
Keep responses concise (2-4 sentences max). Be direct and collaborative. Reference what other agents said when relevant.
Address the other agents by name. This is a real-time multi-AI collaboration session.`;

  return {
    id: configAgent.id,
    name: configAgent.name,
    provider,
    model: configAgent.model,
    role: configAgent.role,
    color: agentColors[colorIndex],
    systemPrompt: configAgent.systemPrompt?.trim() || defaultSystemPrompt,
    priority: configAgent.priority,
    dependencies: configAgent.dependencies,
    ...(configAgent.apiKey ? { apiKey: configAgent.apiKey } : {}),
  };
}

// ─── Execution plan ───────────────────────────────────────────────────────────

export function buildExecutionPlan(agents: AIAgent[], mode: OrchestrationMode): ExecutionPlan {
  if (mode === 'parallel') {
    return {
      mode,
      currentPhase: 0,
      phases: [{
        id: 'phase-all',
        label: 'All Agents (Parallel)',
        agentIds: agents.map(a => a.id),
        parallel: true,
        completed: false,
      }],
    };
  }

  if (mode === 'priority') {
    const sorted = [...agents].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    return {
      mode,
      currentPhase: 0,
      phases: sorted.map((agent, i) => ({
        id: `phase-${i}`,
        label: `${agent.name} (${agent.role})`,
        agentIds: [agent.id],
        parallel: false,
        completed: false,
      })),
    };
  }

  if (mode === 'sequential') {
    return {
      mode,
      currentPhase: 0,
      phases: agents.map((agent, i) => ({
        id: `phase-${i}`,
        label: `${agent.name} (${agent.role})`,
        agentIds: [agent.id],
        parallel: false,
        completed: false,
      })),
    };
  }

  return {
    mode,
    currentPhase: 0,
    phases: [{
      id: 'phase-rotating',
      label: 'Round Robin',
      agentIds: agents.map(a => a.id),
      parallel: false,
      completed: false,
    }],
  };
}

// ─── Core agent call (single attempt) ────────────────────────────────────────

async function callAgent(
  agent: AIAgent,
  conversationHistory: AgentMessage[],
  topic: string,
  injectedContext?: string,
  overrideProvider?: AIProvider,
  overrideModel?: string,
  timeoutMs = DEFAULT_RETRY_CONFIG.timeoutMs
): Promise<string> {
  const systemSuffix = injectedContext
    ? `\n\n[ORCHESTRATOR DIRECTIVE]: ${injectedContext}`
    : '';

  const effectiveProvider = overrideProvider ?? agent.provider;
  const effectiveModel = overrideModel ?? agent.model;

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: agent.systemPrompt + `\n\nThe current collaboration topic is: "${topic}"` + systemSuffix },
    ...conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.agentName ? `[${msg.agentName}]: ${msg.content}` : msg.content,
    })),
    {
      role: 'user',
      content: `Continue the collaboration. Share your perspective as ${agent.name} (${agent.role}). Be concise and build on what was just said.`,
    },
  ];

  const payload: Record<string, unknown> = {
    provider: effectiveProvider,
    model: effectiveModel,
    messages,
    stream: false,
    parameters: { temperature: 0.8, max_tokens: 300 },
  };

  if (agent.apiKey) payload.apiKey = agent.apiKey;

  const response = await withTimeout(
    callAIEndpoint('/api/ai/chat-completion', payload),
    timeoutMs
  );

  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`No response from ${agent.name}`);
  return content;
}

// ─── Resilient agent response (with retries + fallback) ──────────────────────

export async function getAgentResponse(
  agent: AIAgent,
  conversationHistory: AgentMessage[],
  topic: string,
  injectedContext?: string,
  retryConfig: AgentRetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (state: AgentResilienceState) => void
): Promise<string> {
  let lastError: any = null;
  let usedFallback = false;
  let fallbackProvider: AIProvider | null = null;

  // Primary attempts
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = retryConfig.baseDelayMs * Math.pow(2, attempt - 1); // exponential backoff
      await sleep(delay);
      onRetry?.({
        agentId: agent.id,
        retryCount: attempt,
        lastError: lastError?.message || null,
        errorType: classifyError(lastError),
        isFallback: false,
        fallbackProvider: null,
        status: 'retrying',
      });
    }

    try {
      return await callAgent(agent, conversationHistory, topic, injectedContext, undefined, undefined, retryConfig.timeoutMs);
    } catch (err: any) {
      lastError = err;
      const errType = classifyError(err);
      // Don't retry auth errors — they won't self-heal
      if (errType === 'auth_error') break;
    }
  }

  // Fallback routing: try alternative providers
  const fallbacks = (retryConfig.fallbackProviders || []).filter(
    (p) => p !== agent.provider
  );

  for (const fbProvider of fallbacks) {
    const fbModel = FALLBACK_MODELS[fbProvider];
    if (!fbModel) continue;

    onRetry?.({
      agentId: agent.id,
      retryCount: retryConfig.maxRetries,
      lastError: lastError?.message || null,
      errorType: classifyError(lastError),
      isFallback: true,
      fallbackProvider: fbProvider,
      status: 'fallback_active',
    });

    try {
      const result = await callAgent(
        agent, conversationHistory, topic, injectedContext,
        fbProvider, fbModel, retryConfig.timeoutMs
      );
      usedFallback = true;
      fallbackProvider = fbProvider;
      return result;
    } catch {
      // try next fallback
    }
  }

  // All attempts exhausted
  onRetry?.({
    agentId: agent.id,
    retryCount: retryConfig.maxRetries,
    lastError: lastError?.message || null,
    errorType: classifyError(lastError),
    isFallback: false,
    fallbackProvider: null,
    status: 'failed',
  });

  throw lastError || new Error(`${agent.name} failed after all retries`);
}

// ─── Parallel execution with resilience ──────────────────────────────────────

export async function getParallelAgentResponses(
  agents: AIAgent[],
  conversationHistory: AgentMessage[],
  topic: string,
  injectedContext?: string,
  retryConfig: AgentRetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (state: AgentResilienceState) => void
): Promise<AgentExecutionResult[]> {
  const promises = agents.map(async (agent): Promise<AgentExecutionResult> => {
    const start = Date.now();
    let retryCount = 0;
    let usedFallback = false;
    let fallbackProvider: AIProvider | undefined;

    const trackRetry = (state: AgentResilienceState) => {
      retryCount = state.retryCount;
      if (state.isFallback && state.fallbackProvider) {
        usedFallback = true;
        fallbackProvider = state.fallbackProvider;
      }
      onRetry?.(state);
    };

    try {
      const content = await getAgentResponse(
        agent, conversationHistory, topic, injectedContext, retryConfig, trackRetry
      );
      return {
        agentId: agent.id,
        agentName: agent.name,
        content,
        durationMs: Date.now() - start,
        success: true,
        retryCount,
        usedFallback,
        fallbackProvider,
      };
    } catch (err: any) {
      return {
        agentId: agent.id,
        agentName: agent.name,
        content: '',
        durationMs: Date.now() - start,
        success: false,
        error: err?.message,
        errorType: classifyError(err),
        retryCount,
        usedFallback,
      };
    }
  });

  return Promise.all(promises);
}
