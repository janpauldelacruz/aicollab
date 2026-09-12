'use client';
import React, { useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import type { LiveAgent } from './LiveChatroomClient';

interface ExecutionEvent {
  id: string;
  type: 'agent_turn' | 'directive' | 'phase_change' | 'session_event' | 'parallel_batch';
  agentId?: string;
  agentName?: string;
  agentColor?: string;
  label: string;
  detail?: string;
  timestamp: string;
  durationMs?: number;
  success?: boolean;
  parallelAgents?: string[];
}

interface Props {
  events: ExecutionEvent[];
  agents: LiveAgent[];
  isOpen: boolean;
  onClose: () => void;
}

const EVENT_ICONS: Record<ExecutionEvent['type'], string> = {
  agent_turn: 'ChatBubbleLeftIcon',
  directive: 'PaperAirplaneIcon',
  phase_change: 'ArrowRightCircleIcon',
  session_event: 'BoltIcon',
  parallel_batch: 'BoltIcon',
};

const EVENT_COLORS: Record<ExecutionEvent['type'], string> = {
  agent_turn: 'text-muted-foreground',
  directive: 'text-accent',
  phase_change: 'text-warning',
  session_event: 'text-positive',
  parallel_batch: 'text-violet-400',
};

export type { ExecutionEvent };

export default function ExecutionTimeline({ events, agents, isOpen, onClose }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events.length, isOpen]);

  if (!isOpen) return null;

  // Group events by agent for contribution stats
  const agentTurnCounts = agents.reduce<Record<string, number>>((acc, a) => {
    acc[a.id] = events.filter(e => e.agentId === a.id && e.type === 'agent_turn').length;
    return acc;
  }, {});
  const totalTurns = Object.values(agentTurnCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <Icon name="ClockIcon" size={16} className="text-accent" />
        <h3 className="text-sm font-semibold text-foreground">Execution Timeline</h3>
        <span className="text-xs text-muted-foreground ml-1">{events.length} events</span>
        <button onClick={onClose} className="ml-auto btn-ghost p-1.5">
          <Icon name="XMarkIcon" size={16} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Timeline events */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Icon name="ClockIcon" size={32} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No events yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Start a session to see execution events</p>
            </div>
          ) : (
            events.map((event, i) => {
              const isLast = i === events.length - 1;
              return (
                <div key={event.id} className="flex items-start gap-3 group">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center flex-shrink-0 mt-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      event.type === 'session_event' ? 'bg-positive/20 border border-positive/40' :
                      event.type === 'directive' ? 'bg-accent/20 border border-accent/40' :
                      event.type === 'parallel_batch' ? 'bg-violet-500/20 border border-violet-500/40' :
                      event.type === 'phase_change'? 'bg-warning/20 border border-warning/40' : 'bg-muted/50 border border-border'
                    }`}>
                      <Icon
                        name={EVENT_ICONS[event.type] as any}
                        size={11}
                        className={EVENT_COLORS[event.type]}
                      />
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-border/50 mt-1 min-h-[12px]" />}
                  </div>

                  {/* Event content */}
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {event.agentColor && (
                        <span
                          className="text-xs font-semibold"
                          style={{ color: event.agentColor }}
                        >
                          {event.agentName}
                        </span>
                      )}
                      <span className="text-xs text-foreground">{event.label}</span>
                      {event.durationMs !== undefined && (
                        <span className="text-xs text-muted-foreground/60 font-mono ml-auto">
                          {event.durationMs < 1000 ? `${event.durationMs}ms` : `${(event.durationMs / 1000).toFixed(1)}s`}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground/50 font-mono">{event.timestamp}</span>
                    </div>
                    {event.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{event.detail}</p>
                    )}
                    {event.parallelAgents && event.parallelAgents.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {event.parallelAgents.map(name => (
                          <span key={name} className="text-xs px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                    {event.success === false && (
                      <span className="text-xs text-negative mt-0.5 flex items-center gap-1">
                        <Icon name="ExclamationCircleIcon" size={11} />
                        Failed
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Agent contribution sidebar */}
        {totalTurns > 0 && (
          <div className="w-48 flex-shrink-0 border-l border-border p-4 overflow-y-auto">
            <p className="text-xs font-medium text-foreground mb-3">Contribution</p>
            <div className="space-y-3">
              {agents.map(agent => {
                const count = agentTurnCounts[agent.id] || 0;
                const pct = totalTurns > 0 ? Math.round((count / totalTurns) * 100) : 0;
                return (
                  <div key={agent.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: agent.color }}>{agent.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: agent.color }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{count} turns</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
