/**
 * A shared file workspace the agents read and write every turn.
 *
 * This is what turns a session into an end product: instead of 50 messages of
 * chat, the agents accumulate a small set of files (code, specs, decisions) that
 * survive the session and can be exported.
 *
 * Write protocol (chosen because small local models follow it reliably):
 *
 *   FILE: strategy.py
 *   ```python
 *   ...contents...
 *   ```
 *
 * A file block replaces that file wholesale. `DECISION: ...` lines are appended
 * to DECISIONS.md.
 */

export interface WorkspaceFile {
  name: string;
  content: string;
  language: string;
  updatedBy: string;
  updatedAt: string;
  revision: number;
}

export type Workspace = Record<string, WorkspaceFile>;

export const DECISIONS_FILE = 'DECISIONS.md';
export const DELIVERABLE_FILE = 'DELIVERABLE.md';

/** `FILE: <name>` immediately followed by a fenced block. */
const FILE_BLOCK = /FILE:\s*([^\s`]+)\s*\n+```([a-zA-Z0-9+#.-]*)\n([\s\S]*?)```/g;
/** A fenced block with no FILE: header — still worth keeping. */
const BARE_BLOCK = /```([a-zA-Z0-9+#.-]*)\n([\s\S]*?)```/g;
const DECISION_LINE = /^\s*DECISION:\s*(.+)$/gim;

const EXT_BY_LANGUAGE: Record<string, string> = {
  python: 'py',
  py: 'py',
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  json: 'json',
  sql: 'sql',
  bash: 'sh',
  sh: 'sh',
  yaml: 'yml',
  markdown: 'md',
  md: 'md',
};

function sanitizeName(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._/-]/g, '').replace(/^\/+/, '') || 'untitled.txt';
}

function fallbackName(language: string, code: string): string {
  const named =
    code.match(/(?:def|function|class)\s+([A-Za-z_][A-Za-z0-9_]*)/) ||
    code.match(/(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/);
  const stem = named ? named[1] : 'snippet';
  return `${stem}.${EXT_BY_LANGUAGE[language.toLowerCase()] || 'txt'}`;
}

export interface ApplyResult {
  workspace: Workspace;
  /** Names of files created or replaced by this message. */
  touched: string[];
}

/**
 * Applies one agent message to the workspace. Returns a new workspace object so
 * React state updates stay immutable.
 */
export function applyMessageToWorkspace(
  workspace: Workspace,
  content: string,
  agentName: string,
  timestamp: string
): ApplyResult {
  const next: Workspace = { ...workspace };
  const touched: string[] = [];
  const consumedRanges: Array<[number, number]> = [];

  const write = (name: string, body: string, language: string) => {
    const existing = next[name];
    next[name] = {
      name,
      content: body,
      language,
      updatedBy: agentName,
      updatedAt: timestamp,
      revision: existing ? existing.revision + 1 : 1,
    };
    if (!touched.includes(name)) touched.push(name);
  };

  // 1. Explicit FILE: blocks.
  let match: RegExpExecArray | null;
  FILE_BLOCK.lastIndex = 0;
  while ((match = FILE_BLOCK.exec(content)) !== null) {
    const body = match[3].trim();
    if (body.length < 10) continue;
    consumedRanges.push([match.index, match.index + match[0].length]);
    write(sanitizeName(match[1]), body, match[2] || 'text');
  }

  // 2. Fenced blocks with no FILE: header, so nothing an agent writes is lost.
  BARE_BLOCK.lastIndex = 0;
  while ((match = BARE_BLOCK.exec(content)) !== null) {
    const inside = consumedRanges.some(
      ([start, end]) => match!.index >= start && match!.index < end
    );
    if (inside) continue;

    const body = match[2].trim();
    if (body.length < 40) continue;

    const language = match[1] || 'text';
    write(fallbackName(language, body), body, language);
  }

  // 3. DECISION: lines accumulate into one file.
  const decisions: string[] = [];
  DECISION_LINE.lastIndex = 0;
  while ((match = DECISION_LINE.exec(content)) !== null) {
    const decision = match[1].trim();
    if (decision.length >= 10) decisions.push(decision);
  }

  if (decisions.length > 0) {
    const previous = next[DECISIONS_FILE]?.content ?? '# Decisions\n';
    const appended = decisions.map((d) => `- [${timestamp}] **${agentName}** — ${d}`).join('\n');
    write(DECISIONS_FILE, `${previous.trimEnd()}\n${appended}`, 'markdown');
  }

  return { workspace: next, touched };
}

/** Chronological list of files, most recently touched last. */
export function workspaceFiles(workspace: Workspace): WorkspaceFile[] {
  return Object.values(workspace).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The workspace as the agents see it in their prompt. Long files are trimmed to
 * their head and tail so a 14B model does not lose the instructions.
 */
export function renderWorkspaceForPrompt(workspace: Workspace, maxCharsPerFile = 1200): string {
  const files = workspaceFiles(workspace);
  if (files.length === 0) {
    return 'The shared workspace is empty. Create the first file this turn.';
  }

  return files
    .map((file) => {
      let body = file.content;
      if (body.length > maxCharsPerFile) {
        const head = body.slice(0, Math.floor(maxCharsPerFile * 0.6));
        const tail = body.slice(-Math.floor(maxCharsPerFile * 0.3));
        body = `${head}\n… (${file.content.length - head.length - tail.length} chars trimmed) …\n${tail}`;
      }
      return `FILE: ${file.name} (rev ${file.revision}, last edited by ${file.updatedBy})\n\`\`\`${file.language}\n${body}\n\`\`\``;
    })
    .join('\n\n');
}

/** Plain-text bundle of the whole workspace, for export. */
export function workspaceToMarkdown(workspace: Workspace): string {
  const files = workspaceFiles(workspace);
  if (files.length === 0) return '_No files were produced._';

  return files
    .map(
      (file) =>
        `### ${file.name}\n\n_rev ${file.revision}, last edited by ${file.updatedBy} at ${file.updatedAt}_\n\n\`\`\`${file.language}\n${file.content}\n\`\`\``
    )
    .join('\n\n');
}

/** Rebuilds a workspace from the artifacts saved with a session. */
export function workspaceFromArtifacts(
  artifacts: Array<{
    name: string;
    content: string;
    language?: string;
    createdBy: string;
    createdAt: string;
  }>
): Workspace {
  const workspace: Workspace = {};
  for (const artifact of artifacts) {
    workspace[artifact.name] = {
      name: artifact.name,
      content: artifact.content,
      language: artifact.language || 'text',
      updatedBy: artifact.createdBy,
      updatedAt: artifact.createdAt,
      revision: 1,
    };
  }
  return workspace;
}
