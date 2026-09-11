import { callAIEndpoint } from './aiClient';

export type AIProvider = 'ANTHROPIC' | 'GEMINI' | 'OPEN_AI' | 'PERPLEXITY' | 'CUSTOM' | string;

export interface AIAgent {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  role: string;
  color: string;
  systemPrompt: string;
  apiKey?: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentName?: string;
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
    systemPrompt: `You are Gemini, Google's AI assistant, participating in a collaborative AI chatroom.
You are working alongside Claude (Anthropic's AI) and ChatGPT (OpenAI's AI) to collaboratively solve problems and build things together.
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
    systemPrompt: `You are ChatGPT, OpenAI's AI assistant, participating in a collaborative AI chatroom.
You are working alongside Claude (Anthropic's AI) and Gemini (Google's AI) to collaboratively solve problems and build things together.
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
    ...(configAgent.apiKey ? { apiKey: configAgent.apiKey } : {}),
  };
}

export async function getAgentResponse(
  agent: AIAgent,
  conversationHistory: AgentMessage[],
  topic: string
): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: agent.systemPrompt + `\n\nThe current collaboration topic is: "${topic}"` },
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

  // Pass per-agent API key if provided (for custom providers)
  if (agent.apiKey) {
    payload.apiKey = agent.apiKey;
  }

  const response = await callAIEndpoint('/api/ai/chat-completion', payload);

  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`No response from ${agent.name}`);
  return content;
}
