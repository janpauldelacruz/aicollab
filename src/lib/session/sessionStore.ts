'use client';

/**
 * Persists the most recent live-chatroom session so the results page can show
 * what actually happened instead of placeholder data. Stored in localStorage —
 * sessions are local-only, same as the models that produced them.
 */

export interface SessionAgent {
  id: string;
  name: string;
  role: string;
  model: string;
  color: string;
  messageCount: number;
}

export interface SessionMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  agentColor: string;
  content: string;
  /** mm:ss offset from session start. */
  timestamp: string;
  type: string;
  codeLanguage?: string;
}

export interface SessionArtifact {
  id: string;
  name: string;
  type: string;
  content: string;
  createdBy: string;
  createdAt: string;
  language?: string;
}

export interface StoredSession {
  id: string;
  topic: string;
  status: 'running' | 'paused' | 'stopped' | 'completed';
  startedAt: string;
  updatedAt: string;
  elapsedSeconds: number;
  turnCount: number;
  agents: SessionAgent[];
  messages: SessionMessage[];
  artifacts: SessionArtifact[];
}

const STORAGE_KEY = 'aicollab:last-session';
const ARCHIVE_KEY = 'aicollab:sessions';
const MAX_ARCHIVED = 25;

/** Avoids logging the same quota failure on every turn. */
let quotaWarned = false;

/** Fired after a save so an open results page can refresh itself. */
export const SESSION_UPDATED_EVENT = 'aicollab:session-updated';

export function saveSession(session: StoredSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

    // Keep past sessions instead of letting each launch overwrite the last one.
    const archive = listSessions().filter((s) => s.id !== session.id);
    archive.unshift(session);
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive.slice(0, MAX_ARCHIVED)));

    window.dispatchEvent(new CustomEvent(SESSION_UPDATED_EVENT));
    quotaWarned = false;
  } catch (error) {
    // A full quota silently stops a session persisting, which looks like data
    // loss later. Drop the oldest archived sessions and retry once, then say so.
    try {
      const trimmed = listSessions().slice(0, 5);
      window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(trimmed));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      window.dispatchEvent(new CustomEvent(SESSION_UPDATED_EVENT));
    } catch {
      if (!quotaWarned) {
        quotaWarned = true;
        console.error('Session could not be saved — browser storage is full.', error);
      }
    }
  }
}

/**
 * Fills in fields that sessions written by older builds may not have, so one
 * legacy record cannot crash a page that maps over it.
 */
function normalizeSession(raw: Partial<StoredSession> | null | undefined): StoredSession | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  return {
    id: raw.id,
    topic: raw.topic ?? 'Untitled session',
    status: raw.status ?? 'stopped',
    startedAt: raw.startedAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.startedAt ?? new Date().toISOString(),
    elapsedSeconds: raw.elapsedSeconds ?? 0,
    turnCount: raw.turnCount ?? 0,
    agents: Array.isArray(raw.agents) ? raw.agents : [],
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    artifacts: Array.isArray(raw.artifacts) ? raw.artifacts : [],
  };
}

/** Every archived session, newest first. */
export function listSessions(): StoredSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ARCHIVE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredSession[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSession).filter((s): s is StoredSession => s !== null);
  } catch {
    return [];
  }
}

export function loadSessionById(id: string): StoredSession | null {
  return listSessions().find((s) => s.id === id) ?? null;
}

export function loadSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeSession(JSON.parse(raw) as StoredSession);
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(SESSION_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

/** "1h 23m" / "4m 12s" / "38s" */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Share of total messages per agent, rounded to whole percents. */
export function contributionByAgent(session: StoredSession) {
  const total = session.messages.length;
  return session.agents.map((agent) => {
    const count = session.messages.filter((m) => m.agentId === agent.id).length;
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      color: agent.color,
      model: agent.model,
      messages: count,
      artifacts: session.artifacts.filter((a) => a.createdBy === agent.name).length,
      contribution: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
}

/** Messages bucketed per minute of the session, for the timeline chart. */
export function messagesPerMinute(session: StoredSession): { time: string; messages: number }[] {
  const buckets = new Map<number, number>();

  for (const message of session.messages) {
    const [mm] = message.timestamp.split(':');
    const minute = Number.parseInt(mm, 10);
    if (Number.isNaN(minute)) continue;
    buckets.set(minute, (buckets.get(minute) || 0) + 1);
  }

  const lastMinute = Math.max(
    0,
    ...Array.from(buckets.keys()),
    Math.floor(session.elapsedSeconds / 60)
  );

  const series: { time: string; messages: number }[] = [];
  for (let minute = 0; minute <= lastMinute; minute++) {
    series.push({ time: `${minute}:00`, messages: buckets.get(minute) || 0 });
  }
  return series;
}

const ARTIFACT_TYPE_COLORS: Record<string, string> = {
  code: '#22d3ee',
  document: '#60a5fa',
  spec: '#f59e0b',
  decision: '#22c55e',
  diagram: '#a78bfa',
};

/** Artifact counts per type, including zero-count types so the axis is stable. */
export function artifactsByType(session: StoredSession) {
  return Object.keys(ARTIFACT_TYPE_COLORS).map((type) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    count: session.artifacts.filter((a) => a.type === type).length,
    color: ARTIFACT_TYPE_COLORS[type],
  }));
}

/** A session counts as still live for this long after its last write. */
export const RESUMABLE_WINDOW_MS = 30 * 60 * 1000;

/**
 * The most recent session that was still in progress when the user navigated
 * away, so the chatroom can offer to pick it back up.
 */
export function resumableSession(): StoredSession | null {
  const session = loadSession();
  if (!session) return null;
  if (session.status !== 'running' && session.status !== 'paused') return null;
  if (session.messages.length === 0) return null;
  if (Date.now() - new Date(session.updatedAt).getTime() > RESUMABLE_WINDOW_MS) return null;
  return session;
}
