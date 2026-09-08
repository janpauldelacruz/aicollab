import { getChatCompletion } from './chatCompletion';

export type AIProvider = 'ANTHROPIC' | 'GEMINI' | 'OPEN_AI';

export interface AIAgent {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  role: string;
  color: string;
  systemPrompt: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentName?: string;
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

  const response = await getChatCompletion(
    agent.provider,
    agent.model,
    messages,
    { temperature: 0.8, max_tokens: 300 }
  );

  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`No response from ${agent.name}`);
  return content;
}
