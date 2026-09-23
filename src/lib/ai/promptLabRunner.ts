import { callAIEndpoint } from './aiClient';
import { inferProvider } from './multiAgentChat';

// ─── Token pricing per 1K tokens (input / output) in USD ─────────────────────
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':                          { input: 0.005,  output: 0.015  },
  'gpt-4o-mini':                     { input: 0.00015,output: 0.0006 },
  'gpt-4-turbo':                     { input: 0.01,   output: 0.03   },
  'gpt-3.5-turbo':                   { input: 0.0005, output: 0.0015 },
  'o1':                              { input: 0.015,  output: 0.06   },
  'o1-mini':                         { input: 0.003,  output: 0.012  },
  'claude-sonnet-4-6':               { input: 0.003,  output: 0.015  },
  'claude-3-5-sonnet-20241022':      { input: 0.003,  output: 0.015  },
  'claude-3-5-haiku-20241022':       { input: 0.0008, output: 0.004  },
  'claude-3-opus-20240229':          { input: 0.015,  output: 0.075  },
  'gemini/gemini-2.5-flash':         { input: 0.000075, output: 0.0003 },
  'gemini/gemini-2.5-pro':           { input: 0.00125, output: 0.01  },
  'gemini/gemini-1.5-pro':           { input: 0.00125, output: 0.005 },
  'gemini/gemini-1.5-flash':         { input: 0.000075, output: 0.0003 },
  'llama-3.1-sonar-small-128k-online': { input: 0.0002, output: 0.0002 },
  'llama-3.1-sonar-large-128k-online': { input: 0.001,  output: 0.001  },
};

function getPricing(model: string) {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  // Fallback by prefix
  if (model.startsWith('gpt-4o')) return MODEL_PRICING['gpt-4o'];
  if (model.startsWith('gpt-3.5')) return MODEL_PRICING['gpt-3.5-turbo'];
  if (model.startsWith('claude-3-5-sonnet')) return MODEL_PRICING['claude-sonnet-4-6'];
  if (model.startsWith('claude-3-opus')) return MODEL_PRICING['claude-3-opus-20240229'];
  if (model.startsWith('gemini')) return MODEL_PRICING['gemini/gemini-2.5-flash'];
  return { input: 0.001, output: 0.002 }; // generic fallback
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = getPricing(model);
  return (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromptTestAgent {
  id: string;
  name: string;
  model: string;
  provider: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface PromptTestResult {
  agentId: string;
  agentName: string;
  model: string;
  provider: string;
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface PromptRunSummary {
  results: PromptTestResult[];
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCost: number;
  durationMs: number;
}

// ─── Single agent call ────────────────────────────────────────────────────────

async function runSingleAgent(
  agent: PromptTestAgent,
  userInput: string
): Promise<PromptTestResult> {
  const start = Date.now();
  const provider = agent.provider && agent.provider !== 'CUSTOM'
    ? agent.provider
    : inferProvider(agent.model);

  try {
    const messages = [
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: userInput },
    ];

    const response = await callAIEndpoint('/api/ai/chat-completion', {
      provider,
      model: agent.model,
      messages,
      stream: false,
      parameters: {
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
      },
    });

    const content = response?.choices?.[0]?.message?.content ?? '';
    const usage = response?.usage ?? {};
    const promptTokens = usage.prompt_tokens ?? Math.ceil(agent.systemPrompt.length / 4 + userInput.length / 4);
    const completionTokens = usage.completion_tokens ?? Math.ceil(content.length / 4);
    const totalTokens = usage.total_tokens ?? promptTokens + completionTokens;
    const estimatedCost = estimateCost(agent.model, promptTokens, completionTokens);

    return {
      agentId: agent.id,
      agentName: agent.name,
      model: agent.model,
      provider,
      content,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
      durationMs: Date.now() - start,
      success: true,
    };
  } catch (err: any) {
    return {
      agentId: agent.id,
      agentName: agent.name,
      model: agent.model,
      provider,
      content: '',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      durationMs: Date.now() - start,
      success: false,
      error: err?.message ?? 'Unknown error',
    };
  }
}

// ─── Parallel test runner ─────────────────────────────────────────────────────

export async function runParallelPromptTests(
  agents: PromptTestAgent[],
  userInput: string,
  onProgress?: (result: PromptTestResult) => void
): Promise<PromptRunSummary> {
  const runStart = Date.now();

  const promises = agents.map(async (agent) => {
    const result = await runSingleAgent(agent, userInput);
    onProgress?.(result);
    return result;
  });

  const results = await Promise.all(promises);

  const totalPromptTokens = results.reduce((s, r) => s + r.promptTokens, 0);
  const totalCompletionTokens = results.reduce((s, r) => s + r.completionTokens, 0);
  const totalTokens = results.reduce((s, r) => s + r.totalTokens, 0);
  const totalCost = results.reduce((s, r) => s + r.estimatedCost, 0);

  return {
    results,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    totalCost,
    durationMs: Date.now() - runStart,
  };
}

// ─── Available models list ────────────────────────────────────────────────────

export interface ModelOption {
  value: string;
  label: string;
  provider: string;
  tier: 'fast' | 'balanced' | 'powerful';
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { value: 'gpt-4o',                          label: 'GPT-4o',                provider: 'OPEN_AI',    tier: 'powerful'  },
  { value: 'gpt-4o-mini',                     label: 'GPT-4o Mini',           provider: 'OPEN_AI',    tier: 'fast'      },
  { value: 'gpt-4-turbo',                     label: 'GPT-4 Turbo',           provider: 'OPEN_AI',    tier: 'powerful'  },
  { value: 'gpt-3.5-turbo',                   label: 'GPT-3.5 Turbo',         provider: 'OPEN_AI',    tier: 'fast'      },
  { value: 'claude-sonnet-4-6',               label: 'Claude Sonnet 4.6',     provider: 'ANTHROPIC',  tier: 'powerful'  },
  { value: 'claude-3-5-sonnet-20241022',      label: 'Claude 3.5 Sonnet',     provider: 'ANTHROPIC',  tier: 'balanced'  },
  { value: 'claude-3-5-haiku-20241022',       label: 'Claude 3.5 Haiku',      provider: 'ANTHROPIC',  tier: 'fast'      },
  { value: 'claude-3-opus-20240229',          label: 'Claude 3 Opus',         provider: 'ANTHROPIC',  tier: 'powerful'  },
  { value: 'gemini/gemini-2.5-flash',         label: 'Gemini 2.5 Flash',      provider: 'GEMINI',     tier: 'fast'      },
  { value: 'gemini/gemini-2.5-pro',           label: 'Gemini 2.5 Pro',        provider: 'GEMINI',     tier: 'powerful'  },
  { value: 'gemini/gemini-1.5-pro',           label: 'Gemini 1.5 Pro',        provider: 'GEMINI',     tier: 'balanced'  },
  { value: 'gemini/gemini-1.5-flash',         label: 'Gemini 1.5 Flash',      provider: 'GEMINI',     tier: 'fast'      },
  { value: 'llama-3.1-sonar-small-128k-online', label: 'Sonar Small (Online)', provider: 'PERPLEXITY', tier: 'fast'    },
  { value: 'llama-3.1-sonar-large-128k-online', label: 'Sonar Large (Online)', provider: 'PERPLEXITY', tier: 'balanced' },
];
