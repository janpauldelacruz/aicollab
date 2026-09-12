/**
 * Helpers that keep a multi-agent session from degenerating into the failure
 * mode small local models fall into: three agents politely agreeing, restating
 * each other's plans, and producing nothing.
 */

/** Jaccard similarity over lowercased word sets. 0 = nothing shared, 1 = same. */
export function similarity(a: string, b: string): number {
  const tokenize = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  setA.forEach((word) => {
    if (setB.has(word)) shared++;
  });

  return shared / (setA.size + setB.size - shared);
}

/** Above this, a message is treated as a restatement rather than progress. */
export const REPEAT_THRESHOLD = 0.5;

export interface ExtractedArtifact {
  name: string;
  type: 'code' | 'decision' | 'document';
  content: string;
  language?: string;
}

const FENCE = /```([a-zA-Z0-9+#.-]*)\n([\s\S]*?)```/g;
const DECISION_LINE = /^\s*DECISION:\s*(.+)$/gim;

function guessName(language: string, code: string, index: number): string {
  const named =
    code.match(/(?:def|function|class)\s+([A-Za-z_][A-Za-z0-9_]*)/) ||
    code.match(/(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/);

  const stem = named ? named[1] : `snippet-${index + 1}`;
  const ext: Record<string, string> = {
    python: 'py',
    py: 'py',
    javascript: 'js',
    js: 'js',
    typescript: 'ts',
    ts: 'ts',
    tsx: 'tsx',
    json: 'json',
    sql: 'sql',
    bash: 'sh',
    sh: 'sh',
    yaml: 'yml',
  };

  return `${stem}.${ext[language.toLowerCase()] || 'txt'}`;
}

/**
 * Pulls real deliverables out of an agent message: fenced code blocks become
 * code artifacts, `DECISION: ...` lines become decision artifacts. This is what
 * makes the Artifacts panel show something instead of staying empty.
 */
export function extractArtifacts(content: string): ExtractedArtifact[] {
  const artifacts: ExtractedArtifact[] = [];

  let match: RegExpExecArray | null;
  let index = 0;
  FENCE.lastIndex = 0;
  while ((match = FENCE.exec(content)) !== null) {
    const language = match[1] || 'text';
    const code = match[2].trim();
    if (code.length < 20) continue;
    artifacts.push({
      name: guessName(language, code, index),
      type: 'code',
      content: code,
      language,
    });
    index++;
  }

  DECISION_LINE.lastIndex = 0;
  while ((match = DECISION_LINE.exec(content)) !== null) {
    const decision = match[1].trim();
    if (decision.length < 10) continue;
    artifacts.push({
      name: decision.length > 60 ? `${decision.slice(0, 57)}…` : decision,
      type: 'decision',
      content: decision,
    });
  }

  return artifacts;
}

/**
 * Running list of ground already covered, injected into each prompt so agents
 * stop re-proposing the same pipeline every turn.
 */
export function coveredGround(messages: { agentName: string; content: string }[]): string {
  const points = messages
    .slice(-14)
    .map((m) => {
      const firstSentence = m.content.split(/(?<=[.!?])\s/)[0] || m.content;
      return `- ${m.agentName}: ${firstSentence.slice(0, 140)}`;
    })
    .filter(Boolean);

  return points.join('\n');
}
