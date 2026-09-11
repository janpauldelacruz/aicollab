'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { ModeBadge, SessionStatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSessions } from '@/lib/supabase/sessionService';
import type { DBSession } from '@/lib/supabase/sessionService';
import type { Session } from '@/app/sessions-dashboard/components/SessionsDashboardClient';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Running', value: 'running' },
  { label: 'Paused', value: 'paused' },
  { label: 'Draft', value: 'draft' },
];

const AGENT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

function dbSessionToSession(s: DBSession): Session {
  const durationSec = s.elapsed_seconds || 0;
  const h = Math.floor(durationSec / 3600);
  const m = Math.floor((durationSec % 3600) / 60);
  const duration = durationSec === 0 ? '—' : h > 0 ? `${h}h ${m}m` : `${m}m`;

  return {
    id: s.id,
    name: s.name,
    mode: s.mode as any,
    status: (s.session_status === 'stopped' ? 'completed' : s.session_status) as any,
    agentCount: s.agent_count,
    messageCount: s.message_count,
    artifactCount: s.artifact_count,
    duration,
    startedAt: s.started_at ? new Date(s.started_at).toLocaleString() : '—',
    topic: s.topic,
    completionPct: s.completion_pct,
  };
}

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

function SessionCard({ session, onShare }: { session: Session; onShare: (id: string) => void }) {
  const isCompleted = session.status === 'completed';
  const isRunning = session.status === 'running';

  return (
    <div className="card-base p-5 hover:border-primary/30 transition-all duration-200 group">
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

      <div className="flex items-center gap-2 mb-3">
        <AgentDots count={session.agentCount} />
        <span className="text-xs text-muted-foreground">{session.agentCount} agent{session.agentCount !== 1 ? 's' : ''}</span>
      </div>

      <CompletionBar pct={session.completionPct} />

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
        {isCompleted ? (
          <>
            <Link href={`/session-results?id=${session.id}`} className="btn-primary text-xs gap-1.5 flex-1 justify-center">
              <Icon name="ChartBarIcon" size={13} />
              View Results
            </Link>
            <button
              onClick={() => onShare(session.id)}
              className="btn-secondary text-xs gap-1.5 px-3"
              title="Share session"
            >
              <Icon name="ShareIcon" size={13} />
            </button>
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
            <Link href="/live-chatroom" className="btn-primary text-xs gap-1.5 flex-1 justify-center">
              <Icon name="PlayIcon" size={13} />
              Join Live
            </Link>
            <button onClick={() => toast.info('Pause coming soon')} className="btn-secondary text-xs gap-1.5 flex-1 justify-center">
              <Icon name="PauseIcon" size={13} />
              Pause
            </button>
          </>
        ) : session.status === 'paused' ? (
          <>
            <Link href="/live-chatroom" className="btn-primary text-xs gap-1.5 flex-1 justify-center">
              <Icon name="PlayIcon" size={13} />
              Resume
            </Link>
            <Link href={`/session-results?id=${session.id}`} className="btn-secondary text-xs gap-1.5 flex-1 justify-center">
              <Icon name="EyeIcon" size={13} />
              Preview
            </Link>
          </>
        ) : (
          <Link href="/session-setup" className="btn-primary text-xs gap-1.5 flex-1 justify-center">
            <Icon name="RocketLaunchIcon" size={13} />
            Launch
          </Link>
        )}
      </div>
    </div>
  );
}

export default function PastCollaborationsClient() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    getUserSessions(user.id).then((data) => {
      setSessions(data.map(dbSessionToSession));
      setLoading(false);
    });
  }, [user]);

  const filtered = sessions.filter((s) => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.topic.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleShare = (sessionId: string) => {
    window.location.href = `/share-session?id=${sessionId}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Past Collaborations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All your AI collaboration sessions — view results, re-run, or share.
          </p>
        </div>
        <Link href="/session-setup" className="btn-primary flex-shrink-0 text-sm gap-1.5">
          <Icon name="PlusIcon" size={15} />
          New Session
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sessions or topics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-sm w-full"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === f.value
                  ? 'bg-primary/10 text-primary border border-primary/30' :'bg-muted/40 text-muted-foreground border border-transparent hover:border-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-base p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-3" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-2/3 mb-4" />
              <div className="h-1.5 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
            <Icon name="ClockIcon" size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {sessions.length === 0 ? 'No sessions yet' : 'No sessions match your filters'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {sessions.length === 0
              ? 'Start your first AI collaboration session to see it here.' :'Try adjusting your search or filter criteria.'}
          </p>
          {sessions.length === 0 && (
            <Link href="/session-setup" className="btn-primary text-sm gap-1.5">
              <Icon name="PlusIcon" size={15} />
              New Session
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((session) => (
            <SessionCard key={session.id} session={session} onShare={handleShare} />
          ))}
        </div>
      )}
    </div>
  );
}
