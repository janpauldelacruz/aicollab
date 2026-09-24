'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSessions, getSessionMessages, getSessionArtifacts } from '@/lib/supabase/sessionService';
import type { DBSession } from '@/lib/supabase/sessionService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplayAgent {
  id: string;
  name: string;
  color: string;
  role: string;
  messageCount: number;
}

interface TimelineEvent {
  id: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  agentRole: string;
  content: string;
  type: string;
  elapsedSeconds: number;
  timestamp: string;
}

const SPEED_OPTIONS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '5×', value: 5 },
  { label: '10×', value: 10 },
];

const AGENT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

// ─── Mock data for demo when no session selected ──────────────────────────────

const DEMO_EVENTS: TimelineEvent[] = [
  { id: 'e1', agentId: 'a1', agentName: 'Architect', agentColor: '#6366f1', agentRole: 'architect', content: 'Analyzing the project requirements. We need a scalable microservices architecture with event-driven communication between services.', type: 'message', elapsedSeconds: 0, timestamp: '0:00' },
  { id: 'e2', agentId: 'a2', agentName: 'Coder', agentColor: '#f59e0b', agentRole: 'coder', content: 'Agreed. I suggest using Node.js with TypeScript for the backend services. Here is the initial service structure:\n```\n/services\n  /auth-service\n  /api-gateway\n  /user-service\n```', type: 'code', elapsedSeconds: 12, timestamp: '0:12' },
  { id: 'e3', agentId: 'a3', agentName: 'PM', agentColor: '#10b981', agentRole: 'pm', content: 'We should prioritize the auth service first. The client needs SSO integration by end of sprint.', type: 'message', elapsedSeconds: 28, timestamp: '0:28' },
  { id: 'e4', agentId: 'a1', agentName: 'Architect', agentColor: '#6366f1', agentRole: 'architect', content: 'Decision: Use JWT with refresh token rotation for auth. Redis for session storage.', type: 'decision', elapsedSeconds: 45, timestamp: '0:45' },
  { id: 'e5', agentId: 'a4', agentName: 'Critic', agentColor: '#ef4444', agentRole: 'critic', content: 'Redis adds operational complexity. Have we considered stateless JWT only? Refresh tokens stored in httpOnly cookies.', type: 'message', elapsedSeconds: 62, timestamp: '1:02' },
  { id: 'e6', agentId: 'a2', agentName: 'Coder', agentColor: '#f59e0b', agentRole: 'coder', content: 'Valid point. Stateless approach reduces infra overhead. Implementing httpOnly cookie pattern now.', type: 'message', elapsedSeconds: 78, timestamp: '1:18' },
  { id: 'e7', agentId: 'a3', agentName: 'PM', agentColor: '#10b981', agentRole: 'pm', content: 'Approved. Proceeding with stateless JWT + httpOnly cookies. Updating sprint backlog.', type: 'decision', elapsedSeconds: 95, timestamp: '1:35' },
  { id: 'e8', agentId: 'a5', agentName: 'Designer', agentColor: '#8b5cf6', agentRole: 'designer', content: 'Auth flow UX: Login → MFA prompt → Dashboard. Forgot password via email magic link. Keeping it frictionless.', type: 'message', elapsedSeconds: 112, timestamp: '1:52' },
  { id: 'e9', agentId: 'a1', agentName: 'Architect', agentColor: '#6366f1', agentRole: 'architect', content: 'API Gateway pattern confirmed. All external traffic routes through gateway. Internal services communicate via message bus.', type: 'decision', elapsedSeconds: 130, timestamp: '2:10' },
  { id: 'e10', agentId: 'a2', agentName: 'Coder', agentColor: '#f59e0b', agentRole: 'coder', content: 'Scaffolding complete. Auth service, API gateway, and user service are ready for feature implementation.', type: 'message', elapsedSeconds: 155, timestamp: '2:35' },
];

const DEMO_AGENTS: ReplayAgent[] = [
  { id: 'a1', name: 'Architect', color: '#6366f1', role: 'architect', messageCount: 3 },
  { id: 'a2', name: 'Coder', color: '#f59e0b', role: 'coder', messageCount: 3 },
  { id: 'a3', name: 'PM', color: '#10b981', role: 'pm', messageCount: 2 },
  { id: 'a4', name: 'Critic', color: '#ef4444', role: 'critic', messageCount: 1 },
  { id: 'a5', name: 'Designer', color: '#8b5cf6', role: 'designer', messageCount: 1 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AgentFilterPill({ agent, active, onClick }: { agent: ReplayAgent; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 border ${
        active ? 'border-transparent' : 'border-border bg-muted/40 text-muted-foreground hover:border-border'
      }`}
      style={active ? { backgroundColor: `${agent.color}22`, color: agent.color, borderColor: `${agent.color}44` } : {}}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: agent.color }}
      />
      {agent.name}
      <span className="opacity-60 font-mono">{agent.messageCount}</span>
    </button>
  );
}

function MessageBubble({ event, isVisible, isCurrent }: { event: TimelineEvent; isVisible: boolean; isCurrent: boolean }) {
  if (!isVisible) return null;
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-all duration-300 ${
        isCurrent ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-muted/20'
      }`}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${event.agentColor}22`, color: event.agentColor, border: `1px solid ${event.agentColor}44` }}
      >
        {event.agentName.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: event.agentColor }}>{event.agentName}</span>
          <span className="text-xs text-muted-foreground/50 capitalize">{event.agentRole}</span>
          {event.type === 'decision' && (
            <span className="text-xs text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded font-medium">Decision</span>
          )}
          {event.type === 'code' && (
            <span className="text-xs text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded font-medium">Code</span>
          )}
          <span className="text-xs font-mono text-muted-foreground/40 ml-auto">{event.timestamp}</span>
        </div>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{event.content}</p>
      </div>
    </div>
  );
}

function AgentTimelineRow({ agent, events, totalDuration, currentTime, onScrub }: {
  agent: ReplayAgent;
  events: TimelineEvent[];
  totalDuration: number;
  currentTime: number;
  onScrub: (t: number) => void;
}) {
  const agentEvents = events.filter((e) => e.agentId === agent.id);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-20 flex-shrink-0 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: agent.color }} />
        <span className="text-xs text-muted-foreground truncate">{agent.name}</span>
      </div>
      <div className="flex-1 relative h-5 bg-muted/30 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        onScrub(Math.round(pct * totalDuration));
      }}>
        {/* Progress fill */}
        <div
          className="absolute left-0 top-0 h-full rounded-full opacity-20 transition-all duration-100"
          style={{ width: `${(currentTime / totalDuration) * 100}%`, backgroundColor: agent.color }}
        />
        {/* Event markers */}
        {agentEvents.map((ev) => {
          const pct = (ev.elapsedSeconds / totalDuration) * 100;
          const isPast = ev.elapsedSeconds <= currentTime;
          return (
            <button
              key={`marker-${ev.id}`}
              title={`${ev.agentName}: ${ev.content.substring(0, 60)}…`}
              onClick={(e) => { e.stopPropagation(); onScrub(ev.elapsedSeconds); }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-card transition-all duration-150 hover:scale-150 z-10"
              style={{
                left: `${pct}%`,
                backgroundColor: isPast ? agent.color : `${agent.color}44`,
                borderColor: isPast ? agent.color : 'transparent',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Session selector ─────────────────────────────────────────────────────────

function SessionSelector({ sessions, selectedId, onSelect }: {
  sessions: DBSession[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const completed = sessions.filter((s) => s.session_status === 'completed' || s.session_status === 'stopped');
  return (
    <div className="card-base p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Icon name="FolderOpenIcon" size={15} className="text-primary" />
        Select Session
      </h3>
      {completed.length === 0 ? (
        <p className="text-xs text-muted-foreground">No completed sessions yet. Run a session first.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {completed.map((s) => (
            <button
              key={`sess-${s.id}`}
              onClick={() => onSelect(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-150 border ${
                selectedId === s.id
                  ? 'bg-primary/10 border-primary/30 text-primary' :'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              <p className="font-medium truncate">{s.name}</p>
              <p className="text-muted-foreground/60 mt-0.5">{s.message_count} msgs · {s.agent_count} agents</p>
            </button>
          ))}
        </div>
      )}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground/60 italic">Demo mode active — using sample session</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SessionReplayClient() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialId = searchParams?.get('id') ?? null;

  const [sessions, setSessions] = useState<DBSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialId);
  const [events, setEvents] = useState<TimelineEvent[]>(DEMO_EVENTS);
  const [agents, setAgents] = useState<ReplayAgent[]>(DEMO_AGENTS);
  const [sessionName, setSessionName] = useState('SaaS MVP Architecture (Demo)');
  const [loadingSession, setLoadingSession] = useState(false);

  // Playback state
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const totalDuration = events.length > 0 ? events[events.length - 1].elapsedSeconds : 0;

  // Load user sessions list
  useEffect(() => {
    if (user) {
      getUserSessions(user.id).then(setSessions);
    }
  }, [user]);

  // Load selected session messages
  useEffect(() => {
    if (!selectedSessionId) return;
    setLoadingSession(true);
    Promise.all([
      getSessionMessages(selectedSessionId),
      getSessionArtifacts(selectedSessionId),
    ]).then(([msgs]) => {
      if (msgs.length === 0) {
        setLoadingSession(false);
        return;
      }
      const evts: TimelineEvent[] = msgs.map((m) => ({
        id: m.id,
        agentId: m.agent_id,
        agentName: m.agent_name,
        agentColor: m.agent_color || '#6366f1',
        agentRole: m.agent_role,
        content: m.content,
        type: m.message_type,
        elapsedSeconds: m.elapsed_seconds,
        timestamp: formatTime(m.elapsed_seconds),
      }));
      setEvents(evts);

      // Build agent list
      const agentMap = new Map<string, ReplayAgent>();
      msgs.forEach((m, idx) => {
        if (!agentMap.has(m.agent_id)) {
          agentMap.set(m.agent_id, {
            id: m.agent_id,
            name: m.agent_name,
            color: m.agent_color || AGENT_COLORS[agentMap.size % AGENT_COLORS.length],
            role: m.agent_role,
            messageCount: 0,
          });
        }
        agentMap.get(m.agent_id)!.messageCount++;
      });
      setAgents(Array.from(agentMap.values()));

      const sess = sessions.find((s) => s.id === selectedSessionId);
      if (sess) setSessionName(sess.name);

      setCurrentIndex(-1);
      setCurrentTime(0);
      setIsPlaying(false);
      setLoadingSession(false);
    });
  }, [selectedSessionId]);

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // Playback engine
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPlaying) return;

    const TICK_MS = 200;
    const secondsPerTick = (TICK_MS / 1000) * speed;

    intervalRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + secondsPerTick;
        if (next >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return next;
      });
    }, TICK_MS);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed, totalDuration]);

  // Sync currentIndex with currentTime
  useEffect(() => {
    const idx = events.filter((e) => e.elapsedSeconds <= currentTime).length - 1;
    setCurrentIndex(idx);
  }, [currentTime, events]);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current && currentIndex >= 0) {
      const el = feedRef.current.querySelector(`[data-idx="${currentIndex}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentIndex]);

  const handleScrub = useCallback((t: number) => {
    setCurrentTime(Math.max(0, Math.min(t, totalDuration)));
    setIsPlaying(false);
  }, [totalDuration]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleScrub(Number(e.target.value));
  };

  const stepBackward = () => {
    const prevEvent = [...events].reverse().find((ev) => ev.elapsedSeconds < currentTime - 0.5);
    if (prevEvent) handleScrub(prevEvent.elapsedSeconds);
    else handleScrub(0);
  };

  const stepForward = () => {
    const nextEvent = events.find((ev) => ev.elapsedSeconds > currentTime + 0.5);
    if (nextEvent) handleScrub(nextEvent.elapsedSeconds);
    else handleScrub(totalDuration);
  };

  const restart = () => { handleScrub(0); setIsPlaying(true); };

  const filteredEvents = agentFilter ? events.filter((e) => e.agentId === agentFilter) : events;
  const visibleEvents = filteredEvents.filter((e) => e.elapsedSeconds <= currentTime);
  const progressPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const decisionCount = visibleEvents.filter((e) => e.type === 'decision').length;
  const codeCount = visibleEvents.filter((e) => e.type === 'code').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link href="/past-collaborations" className="btn-ghost p-2 mt-0.5">
            <Icon name="ArrowLeftIcon" size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Icon name="PlayCircleIcon" size={22} className="text-primary" />
              Session Replay
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Step through agent decisions and debug multi-agent workflows without re-running.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/session-results" className="btn-secondary text-xs gap-1.5">
            <Icon name="ChartBarIcon" size={13} />
            Full Results
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-5">
        {/* Left panel */}
        <div className="space-y-4">
          <SessionSelector
            sessions={sessions}
            selectedId={selectedSessionId}
            onSelect={setSelectedSessionId}
          />

          {/* Agent filter */}
          <div className="card-base p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icon name="UsersIcon" size={15} className="text-primary" />
              Agent Filter
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setAgentFilter(null)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  agentFilter === null
                    ? 'bg-primary/10 text-primary border-primary/30' :'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                All Agents
              </button>
              {agents.map((a) => (
                <AgentFilterPill
                  key={`filter-${a.id}`}
                  agent={a}
                  active={agentFilter === a.id}
                  onClick={() => setAgentFilter(agentFilter === a.id ? null : a.id)}
                />
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="card-base p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icon name="InformationCircleIcon" size={15} className="text-primary" />
              Replay Stats
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Visible', value: visibleEvents.length, icon: 'ChatBubbleLeftRightIcon' },
                { label: 'Total', value: events.length, icon: 'QueueListIcon' },
                { label: 'Decisions', value: decisionCount, icon: 'CheckCircleIcon' },
                { label: 'Code', value: codeCount, icon: 'CodeBracketIcon' },
              ].map((stat) => (
                <div key={`stat-${stat.label}`} className="bg-muted/30 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-foreground font-mono">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Session name */}
          <div className="card-base px-4 py-3 flex items-center gap-3">
            <Icon name="FilmIcon" size={16} className="text-primary flex-shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{sessionName}</span>
            {loadingSession && <Icon name="ArrowPathIcon" size={14} className="text-muted-foreground animate-spin ml-auto" />}
          </div>

          {/* Agent Timeline Scrubber */}
          <div className="card-base p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Agent Timeline</h3>
            <div className="space-y-0.5">
              {agents.map((agent) => (
                <AgentTimelineRow
                  key={`timeline-${agent.id}`}
                  agent={agent}
                  events={events}
                  totalDuration={totalDuration}
                  currentTime={currentTime}
                  onScrub={handleScrub}
                />
              ))}
            </div>

            {/* Global scrubber */}
            <div className="pt-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span>{formatTime(Math.floor(currentTime))}</span>
                <span>{formatTime(totalDuration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={totalDuration}
                step={1}
                value={Math.floor(currentTime)}
                onChange={handleSliderChange}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--primary) ${progressPct}%, var(--muted) ${progressPct}%)`,
                }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1">
                <button onClick={restart} className="btn-ghost p-2" title="Restart">
                  <Icon name="ArrowUturnLeftIcon" size={15} />
                </button>
                <button onClick={stepBackward} className="btn-ghost p-2" title="Step back">
                  <Icon name="BackwardIcon" size={15} />
                </button>
                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  className="btn-primary px-4 py-2 gap-1.5 text-sm"
                >
                  <Icon name={isPlaying ? 'PauseIcon' : 'PlayIcon'} size={15} />
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button onClick={stepForward} className="btn-ghost p-2" title="Step forward">
                  <Icon name="ForwardIcon" size={15} />
                </button>
              </div>

              {/* Speed controls */}
              <div className="flex items-center gap-1">
                {SPEED_OPTIONS.map((opt) => (
                  <button
                    key={`speed-${opt.value}`}
                    onClick={() => setSpeed(opt.value)}
                    className={`px-2 py-1 rounded text-xs font-mono font-medium transition-all border ${
                      speed === opt.value
                        ? 'bg-primary/10 text-primary border-primary/30' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Message feed */}
          <div className="card-base overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Agent Messages</h3>
              <span className="text-xs text-muted-foreground font-mono">{visibleEvents.length} / {filteredEvents.length}</span>
            </div>
            <div ref={feedRef} className="divide-y divide-border max-h-[420px] overflow-y-auto">
              {filteredEvents.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <Icon name="PlayCircleIcon" size={32} className="text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Press Play to start replay</p>
                </div>
              ) : (
                filteredEvents.map((event, idx) => (
                  <div key={`feed-${event.id}`} data-idx={idx}>
                    <MessageBubble
                      event={event}
                      isVisible={event.elapsedSeconds <= currentTime}
                      isCurrent={idx === currentIndex}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
