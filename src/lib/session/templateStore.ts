'use client';

import { ROLE_KEYS, ROLE_DEFAULTS } from '@/lib/ai/roleDefaults';
import { FALLBACK_MODELS } from '@/lib/ai/models';
import { announceChange } from './useLiveData';

export interface StoredTemplate {
  id: string;
  name: string;
  role: string;
  model: string;
  personality: string;
  traits: string[];
  systemPrompt: string;
  creativity: number;
  verbosity: number;
  assertiveness: number;
  usageCount: number;
  lastUsed: string;
  isBuiltIn: boolean;
}

const TEMPLATES_KEY = 'aicollab:templates';

const BUILTIN_NAMES: Record<string, string> = {
  pm: 'Mira',
  architect: 'Orion',
  coder: 'Zara',
  designer: 'Lena',
  critic: 'Rex',
  brainstormer: 'Nova',
  researcher: 'Atlas',
};

/** One built-in template per role, generated from the role defaults. */
export function builtInTemplates(): StoredTemplate[] {
  return ROLE_KEYS.map((role) => {
    const preset = ROLE_DEFAULTS[role];
    return {
      id: `tpl-builtin-${role}`,
      name: BUILTIN_NAMES[role] || preset.label,
      role,
      model: FALLBACK_MODELS[0].id,
      personality: preset.personality,
      traits: preset.description.split(/,\s*/).slice(0, 4),
      systemPrompt: preset.systemPrompt,
      creativity: preset.creativity,
      verbosity: preset.verbosity,
      assertiveness: preset.assertiveness,
      usageCount: 0,
      lastUsed: '—',
      isBuiltIn: true,
    };
  });
}

export function loadTemplates(): StoredTemplate[] {
  if (typeof window === 'undefined') return builtInTemplates();
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return builtInTemplates();
    const parsed = JSON.parse(raw) as StoredTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) return builtInTemplates();
    return parsed;
  } catch {
    return builtInTemplates();
  }
}

export function saveTemplates(templates: StoredTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    announceChange('aicollab:templates-updated');
  } catch {
    // ignore
  }
}

/** Records that a template was added to a session, for the usage counters. */
export function markTemplateUsed(id: string): void {
  const templates = loadTemplates().map((t) =>
    t.id === id
      ? { ...t, usageCount: t.usageCount + 1, lastUsed: new Date().toISOString().slice(0, 10) }
      : t
  );
  saveTemplates(templates);
}

const QUEUE_KEY = 'aicollab:template-queue';

/**
 * Templates the user sent to the session wizard with "Use". The wizard drains
 * this on mount and adds them to the roster.
 */
export function queueTemplateForSession(template: StoredTemplate): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const queue = raw ? (JSON.parse(raw) as StoredTemplate[]) : [];
    queue.push(template);
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    markTemplateUsed(template.id);
  } catch {
    // ignore
  }
}

export function drainTemplateQueue(): StoredTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    window.localStorage.removeItem(QUEUE_KEY);
    const parsed = JSON.parse(raw) as StoredTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
