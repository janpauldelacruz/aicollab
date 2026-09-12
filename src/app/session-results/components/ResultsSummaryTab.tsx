'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { contributionByAgent, formatDuration } from '@/lib/session/sessionStore';
import type { StoredSession } from '@/lib/session/sessionStore';

interface Props {
  session: StoredSession;
}

export default function ResultsSummaryTab({ session }: Props) {
  const stats = contributionByAgent(session).sort((a, b) => b.contribution - a.contribution);

  const summaryCards = [
    {
      id: 'sum-messages',
      label: 'Total Messages',
      value: String(session.messages.length),
      icon: 'ChatBubbleLeftRightIcon',
      color: 'text-primary',
    },
    {
      id: 'sum-artifacts',
      label: 'Artifacts Produced',
      value: String(session.artifacts.length),
      icon: 'DocumentDuplicateIcon',
      color: 'text-accent',
    },
    {
      id: 'sum-turns',
      label: 'Turns Taken',
      value: String(session.turnCount),
      icon: 'ArrowPathIcon',
      color: 'text-positive',
    },
    {
      id: 'sum-duration',
      label: 'Session Duration',
      value: formatDuration(session.elapsedSeconds),
      icon: 'ClockIcon',
      color: 'text-warning',
    },
  ];

  const deliverable = session.artifacts.find((a) => a.name === 'DELIVERABLE.md');

  return (
    <div className="space-y-6">
      {/* The end product */}
      {deliverable && (
        <div className="card-base border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="DocumentCheckIcon" size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Deliverable</h3>
            <span className="text-xs font-mono text-muted-foreground">DELIVERABLE.md</span>
          </div>
          <pre className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">
            {deliverable.content}
          </pre>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryCards.map((s) => (
          <div key={s.id} className="card-base">
            <div className="flex items-center gap-2 mb-2">
              <Icon name={s.icon as never} size={16} className={s.color} />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {s.label}
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roster — which local model played which role */}
        <div className="card-base space-y-4">
          <div className="flex items-center gap-2">
            <Icon name="CpuChipIcon" size={16} className="text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Agent Roster</h3>
          </div>
          <div className="space-y-3">
            {session.agents.map((agent) => (
              <div key={agent.id} className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: `${agent.color}22`, color: agent.color }}
                >
                  {agent.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{agent.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{agent.role}</span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground/70 mt-0.5">{agent.model}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent contributions */}
        <div className="card-base space-y-4">
          <div className="flex items-center gap-2">
            <Icon name="UsersIcon" size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Agent Contributions</h3>
          </div>
          <div className="space-y-3">
            {stats.map((agent) => (
              <div key={agent.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{ backgroundColor: `${agent.color}22`, color: agent.color }}
                    >
                      {agent.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-foreground">{agent.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{agent.role}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{agent.messages} msgs</span>
                    <span>{agent.artifacts} artifacts</span>
                    <span className="font-semibold tabular-nums" style={{ color: agent.color }}>
                      {agent.contribution}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${agent.contribution}%`, backgroundColor: agent.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session outcome */}
      <div className="card-base border-positive/20 bg-positive/5">
        <div className="flex items-start gap-3">
          <Icon name="TrophyIcon" size={20} className="text-positive flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Session Outcome</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {session.agents.length} local models collaborated on{' '}
              <span className="text-foreground">&ldquo;{session.topic}&rdquo;</span> for{' '}
              {formatDuration(session.elapsedSeconds)}, exchanging {session.messages.length}{' '}
              messages across {session.turnCount} turns and producing {session.artifacts.length}{' '}
              artifacts. Status: <span className="text-foreground">{session.status}</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
