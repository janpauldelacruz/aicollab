'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { ModeBadge, SessionStatusBadge } from '@/components/ui/StatusBadge';
import { MOCK_SESSIONS } from '@/app/sessions-dashboard/components/SessionsDashboardClient';
import type { Session } from '@/app/sessions-dashboard/components/SessionsDashboardClient';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Running', value: 'running' },
  { label: 'Paused', value: 'paused' },
  { label: 'Draft', value: 'draft' },
];

const AGENT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

function AgentDots({ count }: { count: number }) {
  return (
    <div className="flex items-center -space-x-1.5">
      {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
        <div
          key={`dot-${i}`}
          className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: `${AGENT_COLORS[i % AGENT_COLORS.length]}22`, color: AGENT_COLORS[i % AGENT_COLORS.length], borderColor: 'var(--card)' }}
        >
          {String.fromCharCode(65 + i)}
        </div>
      ))}
      {count > 5 && (
        <div className="w-6 h-6 rounded-full border-2 border-card bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
          +{count - 5}
        </div>
      )}
    </div>
  );
}

function CompletionBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? '#10b981' : pct > 50 ? '#6366f1' : '#f59e0b',
          }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  const isCompleted = session.status === 'completed';
  const isRunning = session.status === 'running';

  return (
    <div className="card-base p-5 hover:border-primary/30 transition-all duration-200 group">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-foreground truncate">{session.name}</h3>
            <SessionStatusBadge status={session.status} />
            <ModeBadge mode={session.mode} />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{session.topic}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
        <span className="flex items-center gap-1">
          <Icon name="CalendarIcon" size={12} />
          {session.startedAt === '—' ? 'Not started' : session.startedAt}
        </span>
        <span className="flex items-center gap-1">
          <Icon name="ClockIcon" size={12} />
          {session.duration}
        </span>
        <span className="flex items-center gap-1">
          <Icon name="ChatBubbleLeftRightIcon" size={12} />
          {session.messageCount} msgs
        </span>
        <span className="flex items-center gap-1">
          <Icon name="DocumentDuplicateIcon" size={12} />
          {session.artifactCount} artifacts
        </span>
      </div>

      {/* Agent roster */}
      <div className="flex items-center gap-2 mb-3">
        <AgentDots count={session.agentCount} />
        <span className="text-xs text-muted-foreground">{session.agentCount} agent{session.agentCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Completion bar */}
      <CompletionBar pct={session.completionPct} />

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
        {isCompleted ? (
          <>
            <Link
              href="/session-results"
              className="btn-primary text-xs gap-1.5 flex-1 justify-center"
            >
              <Icon name="ChartBarIcon" size={13} />
              View Results
            </Link>
            <button
              onClick={() => toast.success(`Re-running "${session.name}"…`)}
              className="btn-secondary text-xs gap-1.5 flex-1 justify-center"
            >
              <Icon name="ArrowPathIcon" size={13} />
              Re-run
            </button>
          </>
        ) : isRunning ? (
          <>
            <Link
              href="/live-chatroom"
              className="btn-primary text-xs gap-1.5 flex-1 justify-center"
            >
              <Icon name="PlayIcon" size={13} />
              Join Live
            </Link>
            <button
              onClick={() => toast.info(`Session "${session.name}" paused`)}
              className="btn-secondary text-xs gap-1.5 flex-1 justify-center"
            >
              <Icon name="PauseIcon" size={13} />
              Pause
            </button>
          </>
        ) : session.status === 'paused' ? (
          <>
            <Link
              href="/live-chatroom"
              className="btn-primary text-xs gap-1.5 flex-1 justify-center"
            >
              <Icon name="PlayIcon" size={13} />
              Resume
            </Link>
            <button
              onClick={() => toast.info(`Viewing partial results for "${session.name}"`)}
              className="btn-secondary text-xs gap-1.5 flex-1 justify-center"
            >
              <Icon name="EyeIcon" size={13} />
              Preview
            </button>
          </>
        ) : (
          <Link
            href="/session-setup"
            className="btn-primary text-xs gap-1.5 flex-1 justify-center"
          >
            <Icon name="RocketLaunchIcon" size={13} />
            Launch Session
          </Link>
        )}
      </div>
    </div>
  );
}

export default function PastCollaborationsClient() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'messages' | 'agents'>('date');

  const filtered = MOCK_SESSIONS
    .filter((s) => {
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.topic.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'messages') return b.messageCount - a.messageCount;
      if (sortBy === 'agents') return b.agentCount - a.agentCount;
      return b.startedAt.localeCompare(a.startedAt);
    });

  const completedCount = MOCK_SESSIONS.filter((s) => s.status === 'completed').length;
  const runningCount = MOCK_SESSIONS.filter((s) => s.status === 'running').length;
  const totalAgents = MOCK_SESSIONS.reduce((acc, s) => acc + s.agentCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Past Collaborations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All AI collaboration sessions — browse, re-run, or review results.
          </p>
        </div>
        <Link href="/session-setup" className="btn-primary flex-shrink-0 gap-1.5">
          <Icon name="PlusIcon" size={15} />
          New Session
        </Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sessions', value: MOCK_SESSIONS.length, icon: 'FolderOpenIcon', color: '#6366f1' },
          { label: 'Completed', value: completedCount, icon: 'CheckCircleIcon', color: '#10b981' },
          { label: 'Active Now', value: runningCount, icon: 'BoltIcon', color: '#f59e0b' },
          { label: 'Total Agents', value: totalAgents, icon: 'CpuChipIcon', color: '#8b5cf6' },
        ].map((stat) => (
          <div key={stat.label} className="card-base p-4 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${stat.color}18` }}
            >
              <Icon name={stat.icon as any} size={18} style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
            {STATUS_FILTERS.map((f) => (
              <button
                key={`sf-${f.value}`}
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
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'messages' | 'agents')}
            className="input-base text-xs py-1.5 w-auto pr-8"
          >
            <option value="date">Sort: Date</option>
            <option value="messages">Sort: Messages</option>
            <option value="agents">Sort: Agents</option>
          </select>
        </div>

        <p className="text-xs text-muted-foreground self-center flex-shrink-0 sm:ml-auto">
          {filtered.length} of {MOCK_SESSIONS.length} sessions
        </p>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card-base py-16 flex flex-col items-center gap-3">
          <Icon name="FolderOpenIcon" size={36} className="text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No sessions match your filters</p>
          <button onClick={() => { setSearch(''); setStatusFilter('all'); }} className="btn-secondary text-xs">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
