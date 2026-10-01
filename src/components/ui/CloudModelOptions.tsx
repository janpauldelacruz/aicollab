'use client';

import React from 'react';
import Link from 'next/link';
import type { CloudProvider } from '@/lib/ai/models';

/**
 * <optgroup>s for the free hosted providers the caller can use right now.
 * Render inside a model <select>, next to the local Ollama options.
 */
export function CloudModelOptions({ cloud }: { cloud: CloudProvider[] }) {
  return (
    <>
      {cloud
        .filter((p) => p.available && p.models.length > 0)
        .map((p) => (
          <optgroup key={`cloud-${p.providerId}`} label={`Free — ${p.label} (${p.freeTier})`}>
            {p.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {p.label}
              </option>
            ))}
          </optgroup>
        ))}
    </>
  );
}

/** One line under a model picker naming the free providers still waiting for a key. */
export function LockedProvidersHint({ cloud }: { cloud: CloudProvider[] }) {
  const locked = cloud.filter((p) => !p.available);
  if (locked.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
      More free models: add a free key for {locked.map((p) => p.label).join(', ')} on the{' '}
      <Link href="/api-keys" className="text-primary hover:underline">
        API Keys
      </Link>{' '}
      page.
    </p>
  );
}
