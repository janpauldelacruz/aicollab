'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { formatDuration, resumableSession } from '@/lib/session/sessionStore';
import { useLiveData } from '@/lib/session/useLiveData';
import type { StoredSession } from '@/lib/session/sessionStore';

/**
 * A standing way back into a session that is still in progress. Without it,
 * navigating away from the chatroom leaves no visible route back to the run.
 */
export default function ResumeSessionBar({ activeRoute }: { activeRoute?: string }) {
  const read = useCallback(() => resumableSession(), []);
  const [session] = useLiveData<StoredSession | null>(read, null);

  // No point offering a way back to the room you are already in.
  if (!session || activeRoute === '/live-chatroom') return null;

  const title = session.topic.length > 60 ? `${session.topic.slice(0, 60)}…` : session.topic;

  return (
    <Link
      href="/live-chatroom"
      className="flex items-center gap-3 px-4 py-2 border-b border-accent/30 bg-accent/10 hover:bg-accent/15 transition-colors"
    >
      <span className="w-2 h-2 rounded-full bg-positive live-indicator flex-shrink-0" />
      <span className="text-xs font-medium text-foreground truncate">
        Session in progress — {title}
      </span>
      <span className="text-xs text-muted-foreground font-mono hidden sm:inline flex-shrink-0">
        {session.messages.length} msgs · {session.turnCount} turns ·{' '}
        {formatDuration(session.elapsedSeconds)}
      </span>
      <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-accent flex-shrink-0">
        Return to session
        <Icon name="ArrowRightIcon" size={13} />
      </span>
    </Link>
  );
}
