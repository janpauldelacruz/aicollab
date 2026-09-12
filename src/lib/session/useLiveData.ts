'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Events every store dispatches after a write, so any open page re-reads
 * immediately instead of waiting for a reload.
 */
export const LIVE_DATA_EVENTS = ['aicollab:session-updated', 'aicollab:templates-updated'] as const;

/**
 * Subscribes a page to local data changes: same-tab writes (custom events),
 * other-tab writes (the storage event), and returning to the tab (focus).
 *
 * `initial` must be what the server would render — the stores live in
 * localStorage, so reading during render would produce different markup on the
 * server and the client and break hydration. The real value lands on mount.
 *
 * `read` must be stable — wrap it in useCallback in the caller.
 */
export function useLiveData<T>(read: () => T, initial: T): [T, () => void] {
  const [value, setValue] = useState<T>(initial);

  const refresh = useCallback(() => {
    setValue(read());
  }, [read]);

  useEffect(() => {
    refresh();

    const handler = () => refresh();
    for (const event of LIVE_DATA_EVENTS) {
      window.addEventListener(event, handler);
    }
    window.addEventListener('storage', handler);
    window.addEventListener('focus', handler);
    document.addEventListener('visibilitychange', handler);

    return () => {
      for (const event of LIVE_DATA_EVENTS) {
        window.removeEventListener(event, handler);
      }
      window.removeEventListener('storage', handler);
      window.removeEventListener('focus', handler);
      document.removeEventListener('visibilitychange', handler);
    };
  }, [refresh]);

  return [value, refresh];
}

/** Fire-and-forget notification that a store changed. */
export function announceChange(event: (typeof LIVE_DATA_EVENTS)[number]): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(event));
  } catch {
    // ignore
  }
}
