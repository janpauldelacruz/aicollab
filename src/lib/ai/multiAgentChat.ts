import { getChatCompletion } from './chatCompletion';
import { coveredGround } from './collaboration';
import { DELIVERABLE_FILE, renderWorkspaceForPrompt } from './workspace';
import type { Workspace } from './workspace';

export type AIProvider = 'OLLAMA' | 'ANTHROPIC' | 'GEMINI' | 'OPEN_AI' | 'PERPLEXITY';

/**
 * Works out which provider a model tag belongs to. Ollama tags carry a colon
 * ("qwen2.5:7b") and stay local; anything matching a hosted family is routed to
 * that provider instead, which needs its API key set in .env.
 */
export function inferProvider(model: string): AIProvider {
  const m = model.toLowerCase();
  if (m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('text-'))
    return 'OPEN_AI';
  if (m.startsWith('claude')) return 'ANTHROPIC';
  if (m.includes('gemini')) return 'GEMINI';
  if (m.includes('sonar') || m.includes('perplexity')) return 'PERPLEXITY';
  // Everything else is a local Ollama tag.
  return 'OLLAMA';
}

/** Per-agent dials configured in the session wizard. 0-100 each. */
export interface AgentSettings {
  creativity: number;
  verbosity: number;
  assertiveness: number;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  creativity: 70,
  verbosity: 60,
  assertiveness: 65,
};

export interface AIAgent {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  role: string;
  color: string;
  systemPrompt: string;
  settings?: AgentSettings;
}

/**
 * Turns the wizard's 0-100 dials into real sampling parameters, so the sliders
 * change model behaviour instead of only being stored.
 */
export function settingsToParameters(settings?: AgentSettings) {
  const { creativity, verbosity } = { ...DEFAULT_AGENT_SETTINGS, ...(settings || {}) };
  return {
    // 0 -> 0.2 (deterministic), 100 -> 1.1 (loose)
    temperature: Math.round((0.2 + (creativity / 100) * 0.9) * 100) / 100,
    // 0 -> 250 tokens (terse), 100 -> 800 (expansive). Kept low deliberately:
    // local models generate slowly, and a long turn reads as a hung session.
    max_tokens: Math.round(250 + (verbosity / 100) * 550),
  };
}

/** Assertiveness turns into an explicit behavioural instruction. */
export function assertivenessInstruction(settings?: AgentSettings): string {
  const value = settings?.assertiveness ?? DEFAULT_AGENT_SETTINGS.assertiveness;
  if (value >= 75) {
    return 'Be blunt. State your position as a decision, not a suggestion, and say plainly when someone else is wrong.';
  }
  if (value <= 35) {
    return 'Offer your view as a proposal and flag your uncertainty where it exists.';
  }
  return 'State your position directly, and say when you disagree.';
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentName?: string;
}

/** Models the roster prefers, in order, when they are installed locally. */
/**
 * Ordered preference for the single model the whole roster runs on.
 *
 * Deliberately one model for every agent: consumer GPUs hold one mid-size model
 * at a time, so giving agents different models makes Ollama evict and reload a
 * multi-gigabyte model on every turn. That reload, not generation, is what makes
 * a session crawl. Users can still assign per-agent models in the wizard.
 */
const PREFERRED_MODELS = [
  'qwen2.5:7b',
  'hermes3:latest',
  'gemma3:4b',
  'gemma4:latest',
  'qwen2.5:14b',
];

const MODEL_PREFERENCES: Record<string, string[]> = {
  architect: PREFERRED_MODELS,
  researcher: PREFERRED_MODELS,
  coder: PREFERRED_MODELS,
};

const FILE_PROTOCOL = `The three of you share a file workspace. It is the only thing that survives this
session — chat is discarded, files are the product. To create or replace a file, write:

FILE: <filename>
\`\`\`<language>
<the complete new contents of that file>
\`\`\`

A file block replaces the whole file, so always write the full contents, not a diff.
Edit the existing files instead of creating near-duplicates. To record a decision, write a
line starting with "DECISION: " and it is appended to DECISIONS.md.`;

const SHARED_RULES = `Hard rules — a turn that breaks any of these is wasted:
- Write in English only.
- Do not start with your own name, a bracketed label, or "As <name>,".
- Never restate a plan, tool, or component already in the workspace or the covered list.
- Do not thank, praise, or agree. Skip the preamble and add the substance.
- Speak only as yourself. Never write a reply on behalf of another agent.
- Be specific: real values, thresholds, formulas, or code. No generic advice.
- If the human sends a message, treat it as the highest priority instruction and act on it.
- Prose is capped at 80 words. The file blocks are where your work goes.`;

function architectPrompt(name: string): string {
  return `You are ${name}, the Architect, working with Atlas (challenger) and Zara (implementer).

${FILE_PROTOCOL}

Your job each turn: make ONE decision and commit to it — the option you picked, the option you
rejected, and the single reason — then write it as a "DECISION: " line. You own SPEC.md: keep
it current with the goal, the chosen approach, and the concrete requirements Zara must build to.
Never list options without choosing. Never re-open a settled decision.

${SHARED_RULES}`;
}

function challengerPrompt(name: string): string {
  return `You are ${name}, the Challenger, working with Orion (architect) and Zara (implementer).

${FILE_PROTOCOL}

Your job each turn: attack the current state of the workspace. Name the specific assumption
that is wrong, the failure case the code misses, or the number that does not hold up — then
write the fix directly into the file it belongs in, or add it to RISKS.md.
You are forbidden from agreeing. If something is sound, attack its weakest part or name what
nobody has raised yet.

${SHARED_RULES}`;
}

function implementerPrompt(name: string): string {
  return `You are ${name}, the Implementer, working with Orion (architect) and Atlas (challenger).

${FILE_PROTOCOL}

Your job each turn: write real, runnable code into the workspace for the most recent decision.
Every turn must contain at least one FILE: block. Extend the files that already exist rather
than starting over — if a file is there, output its full improved contents.
Never write "I'll start by", "I'll set up", or "Next I'll" — you are writing it now, this turn.

${SHARED_RULES}`;
}

/**
 * Default chatroom roster. Every agent runs on the local Ollama daemon, so no
 * API keys or credits are involved. Models are swapped for whatever is actually
 * installed via `resolveAgentModels`.
 */
export const REAL_AI_AGENTS: AIAgent[] = [
  {
    id: 'agent-architect',
    name: 'Orion',
    provider: 'OLLAMA',
    model: MODEL_PREFERENCES.architect[0],
    role: 'architect',
    color: '#a78bfa',
    systemPrompt: architectPrompt('Orion'),
  },
  {
    id: 'agent-researcher',
    name: 'Atlas',
    provider: 'OLLAMA',
    model: MODEL_PREFERENCES.researcher[0],
    role: 'researcher',
    color: '#34d399',
    systemPrompt: challengerPrompt('Atlas'),
  },
  {
    id: 'agent-coder',
    name: 'Zara',
    provider: 'OLLAMA',
    model: MODEL_PREFERENCES.coder[0],
    role: 'coder',
    color: '#60a5fa',
    systemPrompt: implementerPrompt('Zara'),
  },
];

/**
 * Re-points the roster at models that are actually installed on the Ollama host.
 * Falls back to the first available model so a session never launches pointing
 * at a tag the daemon does not have.
 */
export function resolveAgentModels(available: string[]): AIAgent[] {
  if (available.length === 0) return REAL_AI_AGENTS;

  // One model for everyone, so it stays resident between turns.
  const shared =
    PREFERRED_MODELS.find((candidate) => available.includes(candidate)) ?? available[0];
  return REAL_AI_AGENTS.map((agent) => ({ ...agent, model: shared }));
}

const ROLE_COLORS: Record<string, string> = {
  architect: '#a78bfa',
  pm: '#c084fc',
  researcher: '#34d399',
  critic: '#f87171',
  coder: '#60a5fa',
  designer: '#f472b6',
  brainstormer: '#fbbf24',
};

/** Roles that should behave like the built-in challenger / implementer. */
const ROLE_JOBS: Record<string, string> = {
  architect:
    'Make ONE decision per turn and commit to it — the option picked, the option rejected, the reason — and record it as a "DECISION: " line. You own SPEC.md.',
  pm: 'Each turn, cut scope. Name what is being dropped and why, and record it as a "DECISION: " line. Keep SPEC.md down to what can actually ship.',
  critic:
    'Attack the current workspace every turn: the wrong assumption, the missed failure case, the number that does not hold. Write the fix into the file it belongs in, or into RISKS.md. You are forbidden from agreeing.',
  researcher:
    'Every turn, bring one concrete fact, number, or prior art that nobody has raised, and write it into the file it affects. No summaries of what others said.',
  coder:
    'Write real, runnable code into the workspace every turn — at least one FILE: block. Extend existing files rather than restarting. Never write "I will set up".',
  designer:
    'Every turn, specify one concrete interface or flow — real labels, states, and edge cases — and write it into a file.',
  brainstormer:
    'Every turn, propose one option nobody has raised, with the reason it might beat the current plan. Write it into IDEAS.md.',
};

/**
 * Builds a roster from the session-setup wizard so a launched session uses the
 * agents and models the user actually configured, not the built-in three.
 */
export function buildAgentsFromConfig(
  configs: Array<{
    name: string;
    role: string;
    model: string;
    personality?: string;
    systemPrompt?: string;
    creativity?: number;
    verbosity?: number;
    assertiveness?: number;
  }>
): AIAgent[] {
  return configs.map((config, index) => {
    const peers = configs
      .filter((_, i) => i !== index)
      .map((c) => `${c.name} (${c.role})`)
      .join(', ');

    const job = ROLE_JOBS[config.role] || ROLE_JOBS.coder;
    const persona = [config.personality, config.systemPrompt].filter(Boolean).join(' ');

    return {
      id: `agent-${index}-${config.role}`,
      name: config.name,
      provider: inferProvider(config.model),
      model: config.model,
      role: config.role,
      color: ROLE_COLORS[config.role] || '#60a5fa',
      settings: {
        creativity: config.creativity ?? DEFAULT_AGENT_SETTINGS.creativity,
        verbosity: config.verbosity ?? DEFAULT_AGENT_SETTINGS.verbosity,
        assertiveness: config.assertiveness ?? DEFAULT_AGENT_SETTINGS.assertiveness,
      },
      systemPrompt: `You are ${config.name}, the ${config.role}${peers ? `, working with ${peers}` : ''}.
${
  persona
    ? `
${persona}
`
    : ''
}
${FILE_PROTOCOL}

Your job each turn: ${job}

${SHARED_RULES}`,
    };
  });
}

export interface TurnOptions {
  /** Current shared workspace, shown to the agent before it writes. */
  workspace?: Workspace;
  /** Injected when the agent's previous turn was a restatement. */
  repeatWarning?: boolean;
  /** Most recent instruction typed by the human, if it has not been answered yet. */
  userDirective?: string;
}

export async function getAgentResponse(
  agent: AIAgent,
  conversationHistory: AgentMessage[],
  topic: string,
  options: TurnOptions = {}
): Promise<string> {
  const covered = coveredGround(
    conversationHistory
      .filter((m) => m.agentName)
      .map((m) => ({ agentName: m.agentName as string, content: m.content }))
  );

  const systemParts = [
    agent.systemPrompt,
    `\n${assertivenessInstruction(agent.settings)}`,
    `\nGoal of this session: "${topic}"\nEverything you write must move that goal forward.`,
  ];

  if (options.workspace) {
    systemParts.push(
      `\nCurrent shared workspace:\n\n${renderWorkspaceForPrompt(options.workspace)}`
    );
  }

  if (covered) {
    systemParts.push(`\nAlready said — do NOT restate any of this:\n${covered}`);
  }

  if (options.userDirective) {
    systemParts.push(
      `\nThe human running this session just said: "${options.userDirective}"\nThis overrides the current plan. Address it directly this turn.`
    );
  }

  if (options.repeatWarning) {
    systemParts.push(
      '\nYour previous turn repeated what you had already said. This turn must contain something that appears nowhere above: a different component, a concrete number, or a reversal.'
    );
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemParts.join('\n') },
    ...conversationHistory.slice(-8).map((msg) => ({
      role: msg.role,
      content: msg.agentName ? `${msg.agentName}: ${msg.content}` : msg.content,
    })),
    {
      role: 'user',
      content: `Your turn, ${agent.name}. Write your file changes now — new material only.`,
    },
  ];

  const response = await getChatCompletion(
    agent.provider,
    agent.model,
    messages,
    settingsToParameters(agent.settings)
  );

  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`No response from ${agent.name}`);
  return stripSpeakerPrefix(content, agent.name);
}

/**
 * The end product. Turns the finished workspace into a single deliverable that
 * answers the session goal, written back into the workspace as DELIVERABLE.md.
 */
export async function produceDeliverable(
  agent: AIAgent,
  workspace: Workspace,
  topic: string
): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: `You are writing the final deliverable for a working session. Output the answer itself, not a description of the session. English only. No preamble.

Use exactly this markdown structure:

## Answer
Two to four sentences that directly answer the goal.

## Decisions
Bulleted list. Each line: the decision, then " — " and the one-line reason.

## How to use it
The concrete steps to run or apply what is in the workspace, referencing the files by name.

## Open risks
What could break this, and what was never settled.

Use only what the workspace actually establishes. If something was never resolved, put it under Open risks rather than inventing it.`,
    },
    {
      role: 'user',
      content: `Goal: "${topic}"\n\nThe workspace the session produced:\n\n${renderWorkspaceForPrompt(workspace, 3000)}\n\nWrite ${DELIVERABLE_FILE} now.`,
    },
  ];

  const response = await getChatCompletion(agent.provider, agent.model, messages, {
    temperature: 0.4,
    max_tokens: 1000,
  });

  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Could not produce the session deliverable');
  return content.trim();
}

/**
 * Smaller local models sometimes echo the "[Name]:" transcript format from the
 * conversation history, or keep going as another agent. Trim the leading label
 * and cut anything after they start speaking for someone else.
 */
export function stripSpeakerPrefix(content: string, agentName: string): string {
  let text = content.trim();

  const escapedName = agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Leading "[Orion]:", "Orion:" or "As Orion," label.
  text = text.replace(new RegExp('^\\[?' + escapedName + '\\]?\\s*:\\s*', 'i'), '').trim();
  text = text.replace(new RegExp('^As\\s+' + escapedName + '\\s*,\\s*', 'i'), '').trim();
  text = text.replace(/^\[[^\]\n]{1,30}\]\s*:\s*/, '').trim();

  // Anything from the point the model starts speaking for another agent.
  const handoff = text.search(/\n\s*\[[^\]\n]{1,30}\]\s*:/);
  if (handoff > 0) text = text.slice(0, handoff).trim();

  return text || content.trim();
}

/**
 * Distinct models across a roster. More than one means Ollama has to swap models
 * between turns, which on a consumer GPU costs far more than generation itself.
 */
export function distinctModels(agents: Array<{ model: string }>): string[] {
  return Array.from(new Set(agents.map((a) => a.model)));
}
