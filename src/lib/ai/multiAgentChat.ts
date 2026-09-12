import { callAIEndpoint } from './aiClient';

export type AIProvider = 'ANTHROPIC' | 'GEMINI' | 'OPEN_AI' | 'PERPLEXITY' | 'CUSTOM' | string;
export type OrchestrationMode = 'round-robin' | 'parallel' | 'sequential' | 'priority' | 'reactive';

export interface AIAgent {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  role: string;
  color: string;
  systemPrompt: string;
  apiKey?: string;
  priority?: number; // 1 = highest priority
  dependencies?: string[]; // agent IDs this agent waits for
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
}

/** Infer provider from model string when not explicitly set */
export function inferProvider(model: string): AIProvider {
  const m = model.toLowerCase();
  if (m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('text-')) return 'OPEN_AI';
  if (m.startsWith('claude')) return 'ANTHROPIC';
  if (m.startsWith('gemini') || m.includes('gemini')) return 'GEMINI';
  if (m.includes('sonar') || m.includes('perplexity')) return 'PERPLEXITY';
  if (m.startsWith('llama') || m.startsWith('mistral') || m.startsWith('mixtral')) return 'OPEN_AI';
  return 'OPEN_AI';
}

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

/** Build a dynamic AIAgent from session config agent data */
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

/** Build an execution plan based on orchestration mode and agents */
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

  // round-robin and reactive: single rotating phase
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

export async function getAgentResponse(
  agent: AIAgent,
  conversationHistory: AgentMessage[],
  topic: string,
  injectedContext?: string
): Promise<string> {
  const systemSuffix = injectedContext
    ? `\n\n[ORCHESTRATOR DIRECTIVE]: ${injectedContext}`
    : '';

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
    provider: agent.provider,
    model: agent.model,
    messages,
    stream: false,
    parameters: { temperature: 0.8, max_tokens: 300 },
  };

  if (agent.apiKey) {
    payload.apiKey = agent.apiKey;
  }

  const response = await callAIEndpoint('/api/ai/chat-completion', payload);

  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`No response from ${agent.name}`);
  return content;
}

/** Execute multiple agents in parallel and return all results */
export async function getParallelAgentResponses(
  agents: AIAgent[],
  conversationHistory: AgentMessage[],
  topic: string,
  injectedContext?: string
): Promise<AgentExecutionResult[]> {
  const promises = agents.map(async (agent): Promise<AgentExecutionResult> => {
    const start = Date.now();
    try {
      const content = await getAgentResponse(agent, conversationHistory, topic, injectedContext);
      return { agentId: agent.id, agentName: agent.name, content, durationMs: Date.now() - start, success: true };
    } catch (err: any) {
      return { agentId: agent.id, agentName: agent.name, content: '', durationMs: Date.now() - start, success: false, error: err?.message };
    }
  });

  return Promise.all(promises);
}
