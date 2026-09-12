'use client';

/**
 * Hand-off between the session-setup wizard and the live chatroom.
 *
 * Launching used to navigate to /live-chatroom and drop the config on the
 * floor, so the topic you configured was replaced by the chatroom's default.
 * The wizard now parks the config here and the chatroom consumes it on mount.
 */

export interface PendingAgent {
  name: string;
  role: string;
  model: string;
  personality: string;
  systemPrompt: string;
  creativity: number;
  verbosity: number;
  assertiveness: number;
}

export interface PendingSession {
  name: string;
  mode: string;
  topic: string;
  goal: string;
  maxTurns: number;
  agents: PendingAgent[];
  createdAt: string;
}

const PENDING_KEY = 'aicollab:pending-session';

export function savePendingSession(pending: PendingSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // ignore
  }
}

/**
 * Reads and clears the pending config. Clearing on read means a page refresh
 * does not silently relaunch someone's old setup.
 */
export function consumePendingSession(): PendingSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(PENDING_KEY);
    const parsed = JSON.parse(raw) as PendingSession;
    if (!parsed?.topic) return null;
    return parsed;
  } catch {
    return null;
  }
}

const DRAFT_KEY = 'aicollab:setup-draft';

/**
 * Autosaved wizard state. Without this the whole configuration — topic, roster,
 * and every per-agent setting — is lost the moment the page reloads.
 */
export function saveSetupDraft(config: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function loadSetupDraft<T>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearSetupDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
