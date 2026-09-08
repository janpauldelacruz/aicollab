'use client';
import React from 'react';
import type { LiveAgent } from './LiveChatroomClient';

interface Props {
  agents: LiveAgent[];
  sessionStatus: 'running' | 'paused' | 'stopped';
}

const STATUS_LABELS: Record<LiveAgent['status'], string> = {
  thinking: 'Thinking…',
  speaking: 'Speaking',
  idle: 'Idle',
  waiting: 'Waiting',
};

const STATUS_COLORS: Record<LiveAgent['status'], string> = {
  thinking: 'text-warning',
  speaking: 'text-positive',
  idle: 'text-muted-foreground',
  waiting: 'text-muted-foreground/50',
};

export default function AgentStatusBar({ agents, sessionStatus }: Props) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card/40 overflow-x-auto flex-shrink-0">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border flex-shrink-0"
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: `${agent.color}22`, color: agent.color, borderColor: `${agent.color}44`, border: '1px solid' }}
          >
            {agent.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">{agent.name}</p>
            <div className="flex items-center gap-1">
              {agent.status === 'thinking' && sessionStatus === 'running' && (
                <span className="thinking-dots flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-warning inline-block" />
                  <span className="w-1 h-1 rounded-full bg-warning inline-block" />
                  <span className="w-1 h-1 rounded-full bg-warning inline-block" />
                </span>
              )}
              {agent.status === 'speaking' && sessionStatus === 'running' && (
                <span className="w-1.5 h-1.5 rounded-full bg-positive live-indicator inline-block" />
              )}
              <p className={`text-xs ${STATUS_COLORS[agent.status]}`}>
                {sessionStatus !== 'running' ? 'Paused' : STATUS_LABELS[agent.status]}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-muted-foreground tabular-nums ml-1">{agent.messageCount}</span>
        </div>
      ))}
      <div className="ml-auto flex-shrink-0 pl-2">
        <p className="text-xs text-muted-foreground">
          {agents.filter(a => a.status === 'thinking' || a.status === 'speaking').length} active
        </p>
      </div>
    </div>
  );
}