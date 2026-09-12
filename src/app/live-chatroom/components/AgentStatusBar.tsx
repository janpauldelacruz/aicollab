'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';
import type { LiveAgent } from './LiveChatroomClient';
import type { OrchestrationMode } from '@/lib/ai/multiAgentChat';

interface Props {
  agents: LiveAgent[];
  sessionStatus: 'running' | 'paused' | 'stopped';
  orchestrationMode?: OrchestrationMode;
  pinnedAgentId?: string | null;
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

export default function AgentStatusBar({ agents, sessionStatus, orchestrationMode, pinnedAgentId }: Props) {
  const activeCount = agents.filter(a => a.status === 'thinking' || a.status === 'speaking').length;
  const isParallel = orchestrationMode === 'parallel';

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card/40 overflow-x-auto flex-shrink-0">
      {agents.map((agent) => {
        const isPinned = pinnedAgentId === agent.id;
        return (
          <div
            key={agent.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border flex-shrink-0 transition-all ${
              isPinned ? 'border-warning/40 bg-warning/5' : 'border-border bg-muted/30'
            }`}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{ backgroundColor: `${agent.color}22`, color: agent.color, borderColor: `${agent.color}44`, border: '1px solid' }}
            >
              {agent.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium text-foreground">{agent.name}</p>
                {isPinned && <Icon name="LockClosedIcon" size={9} className="text-warning flex-shrink-0" />}
              </div>
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
        );
      })}
      <div className="ml-auto flex-shrink-0 pl-2 flex items-center gap-2">
        {isParallel && sessionStatus === 'running' && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
            <Icon name="BoltIcon" size={10} className="text-violet-400" />
            <span className="text-xs text-violet-400 font-medium">Parallel</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {activeCount} active
        </p>
      </div>
    </div>
  );
}