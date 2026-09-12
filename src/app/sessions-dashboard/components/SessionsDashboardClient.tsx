'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import Icon from '@/components/ui/AppIcon';

import SessionsKPIGrid from './SessionsKPIGrid';
import SessionsTable from './SessionsTable';
import { formatDuration, listSessions } from '@/lib/session/sessionStore';
import { useLiveData } from '@/lib/session/useLiveData';
import type { StoredSession } from '@/lib/session/sessionStore';

export type SessionMode = 'brainstorm' | 'code' | 'build' | 'chat';
export type SessionStatus = 'running' | 'completed' | 'paused' | 'draft';

export interface Session {
  id: string;
  name: string;
  mode: SessionMode;
  status: SessionStatus;
  agentCount: number;
  messageCount: number;
  artifactCount: number;
  duration: string;
  startedAt: string;
  topic: string;
  completionPct: number;
}

/** Maps a stored chatroom session onto the dashboard's row shape. */
function toDashboardSession(stored: StoredSession): Session {
  // A session that stopped being written to is over, whatever its last saved
  // status said — otherwise a tab closed mid-run shows as "running" forever.
  const STALE_AFTER_MS = 5 * 60 * 1000;
  const isStale = Date.now() - new Date(stored.updatedAt).getTime() > STALE_AFTER_MS;

  const status: SessionStatus = isStale
    ? 'completed'
    : stored.status === 'running'
      ? 'running'
      : stored.status === 'paused'
        ? 'paused'
        : 'completed';

  const hasDeliverable = stored.artifacts.some((a) => a.name === 'DELIVERABLE.md');

  return {
    id: stored.id,
    name: stored.topic.slice(0, 60) + (stored.topic.length > 60 ? '…' : ''),
    mode: 'build',
    status,
    agentCount: stored.agents.length,
    messageCount: stored.messages.length,
    artifactCount: stored.artifacts.length,
    duration: formatDuration(stored.elapsedSeconds),
    startedAt: new Date(stored.startedAt).toLocaleString(),
    topic: stored.topic,
    // A session is "done" once it has produced its deliverable.
    completionPct: hasDeliverable ? 100 : Math.min(99, Math.round((stored.turnCount / 18) * 100)),
  };
}

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Paused', value: 'paused' },
  { label: 'Draft', value: 'draft' },
];

const MODE_FILTERS: { label: string; value: string }[] = [
  { label: 'All Modes', value: 'all' },
  { label: 'Build', value: 'build' },
  { label: 'Brainstorm', value: 'brainstorm' },
  { label: 'Code', value: 'code' },
  { label: 'Chat', value: 'chat' },
];

export default function SessionsDashboardClient() {
  const readSessions = useCallback(() => listSessions().map(toDashboardSession), []);
  const [sessions] = useLiveData<Session[]>(readSessions, []);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Read ?q= after mount: touching the URL during render would make the server
  // and client markup differ and break hydration.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('q');
    if (query) setSearch(query);
  }, []);

  const filtered = sessions.filter((s: Session) => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchMode = modeFilter === 'all' || s.mode === modeFilter;
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.topic.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchMode && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor all AI collaboration sessions — running, completed, and queued.
          </p>
        </div>
        <Link href="/session-setup" className="btn-primary flex-shrink-0">
          <Icon name="PlusIcon" size={16} />
          New Session
        </Link>
      </div>

      {/* KPI Grid */}
      <SessionsKPIGrid sessions={sessions} />

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Icon
            name="MagnifyingGlassIcon"
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search sessions or topics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={`status-filter-${f.value}`}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  statusFilter === f.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="input-base text-xs py-1.5 w-auto pr-8"
          >
            {MODE_FILTERS.map((f) => (
              <option key={`mode-filter-${f.value}`} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sessions table */}
      {sessions.length === 0 ? (
        <div className="card-base flex flex-col items-center justify-center text-center py-16 gap-4">
          <Icon name="ChatBubbleLeftRightIcon" size={26} className="text-muted-foreground/40" />
          <div>
            <h2 className="text-base font-semibold text-foreground">No sessions yet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Run a session in the Live Chatroom and it will appear here automatically.
            </p>
          </div>
          <Link href="/live-chatroom" className="btn-primary text-xs gap-1.5">
            <Icon name="PlayIcon" size={14} />
            Open Live Chatroom
          </Link>
        </div>
      ) : (
        <SessionsTable sessions={filtered} />
      )}
    </div>
  );
}
