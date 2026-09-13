'use client';

import JSZip from 'jszip';
import { formatDuration } from './sessionStore';
import type { StoredSession } from './sessionStore';

/**
 * One archive per session instead of a scatter of separate downloads.
 *
 * Layout inside the zip — the session name is the top folder, so unzipping
 * several sessions side by side keeps them apart:
 *
 *   <session>/DELIVERABLE.md     the end product, when one was produced
 *   <session>/README.md          what the session was and what it produced
 *   <session>/transcript.md      the full conversation
 *   <session>/session.json       raw data for re-import or analysis
 *   <session>/files/…            every workspace file the agents wrote
 */

/** Safe for a filename on every platform, and never empty. */
export function slugifySession(session: StoredSession): string {
  const base = session.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const stamp = new Date(session.startedAt).toISOString().slice(0, 10);
  return `${base || 'session'}-${stamp}`;
}

function buildReadme(session: StoredSession): string {
  const roster = session.agents
    .map((a) => `- **${a.name}** (${a.role}) — \`${a.model}\` · ${a.messageCount} messages`)
    .join('\n');

  const files = session.artifacts.map((a) => `- \`${a.name}\` — by ${a.createdBy}`).join('\n');

  return [
    `# ${session.topic}`,
    '',
    `- Started: ${new Date(session.startedAt).toLocaleString()}`,
    `- Duration: ${formatDuration(session.elapsedSeconds)}`,
    `- Turns: ${session.turnCount}`,
    `- Messages: ${session.messages.length}`,
    `- Files produced: ${session.artifacts.length}`,
    '',
    '## Agents',
    '',
    roster || '_No agents recorded._',
    '',
    '## Files',
    '',
    files || '_No files were produced._',
    '',
    '## Contents',
    '',
    "- `DELIVERABLE.md` — the session's end product (when one was produced)",
    '- `transcript.md` — the full conversation',
    '- `session.json` — raw session data',
    '- `files/` — every file the agents wrote',
    '',
  ].join('\n');
}

function buildTranscript(session: StoredSession): string {
  return [
    `# Transcript — ${session.topic}`,
    '',
    `_${session.messages.length} messages over ${formatDuration(session.elapsedSeconds)}_`,
    '',
    ...session.messages.map((m) => `### [${m.timestamp}] ${m.agentName}\n\n${m.content}\n`),
  ].join('\n');
}

/** Triggers a browser download for a blob. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Packages a whole session into a single .zip and downloads it.
 * Returns the filename so callers can report what was saved.
 */
export async function exportSessionZip(session: StoredSession): Promise<string> {
  const zip = new JSZip();
  const slug = slugifySession(session);
  const root = zip.folder(slug);
  if (!root) throw new Error('Could not create the archive');

  root.file('README.md', buildReadme(session));
  root.file('transcript.md', buildTranscript(session));
  root.file('session.json', JSON.stringify(session, null, 2));

  const deliverable = session.artifacts.find((a) => a.name === 'DELIVERABLE.md');
  if (deliverable) root.file('DELIVERABLE.md', deliverable.content);

  const files = root.folder('files');
  for (const artifact of session.artifacts) {
    // Agents can write nested paths like "frontend/src/App.js"; JSZip keeps them.
    files?.file(artifact.name, artifact.content);
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const filename = `${slug}.zip`;
  saveBlob(blob, filename);
  return filename;
}

/** Just the workspace files, for when the transcript is not wanted. */
export async function exportArtifactsZip(session: StoredSession): Promise<string> {
  const zip = new JSZip();
  const slug = slugifySession(session);
  const root = zip.folder(`${slug}-files`);
  if (!root) throw new Error('Could not create the archive');

  for (const artifact of session.artifacts) {
    root.file(artifact.name, artifact.content);
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const filename = `${slug}-files.zip`;
  saveBlob(blob, filename);
  return filename;
}
