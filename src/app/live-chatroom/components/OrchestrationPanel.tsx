'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import type { OrchestrationMode } from '@/lib/ai/multiAgentChat';
import type { LiveAgent } from './LiveChatroomClient';

interface Props {
  agents: LiveAgent[];
  orchestrationMode: OrchestrationMode;
  sessionStatus: 'idle' | 'running' | 'paused' | 'stopped';
  turnCount: number;
  maxTurns: number;
  currentAgentIndex: number;
  onOrchestrationModeChange: (mode: OrchestrationMode) => void;
  onInjectDirective: (directive: string, targetAgentId?: string) => void;
  onSkipAgent: (agentId: string) => void;
  onPinAgent: (agentId: string) => void;
  pinnedAgentId: string | null;
  onMaxTurnsChange: (turns: number) => void;
}

const ORCHESTRATION_MODES: {
  value: OrchestrationMode;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    value: 'round-robin',
    label: 'Round Robin',
    icon: 'ArrowPathIcon',
    description: 'Agents take turns in order',
  },
  {
    value: 'parallel',
    label: 'Parallel',
    icon: 'BoltIcon',
    description: 'All agents respond simultaneously',
  },
  {
    value: 'sequential',
    label: 'Sequential',
    icon: 'QueueListIcon',
    description: 'Each agent completes before next starts',
  },
  {
    value: 'priority',
    label: 'Priority',
    icon: 'FunnelIcon',
    description: 'Agents respond by priority rank',
  },
  {
    value: 'reactive',
    label: 'Reactive',
    icon: 'CpuChipIcon',
    description: 'Agents respond based on relevance',
  },
];

export default function OrchestrationPanel({
  agents,
  orchestrationMode,
  sessionStatus,
  turnCount,
  maxTurns,
  currentAgentIndex,
  onOrchestrationModeChange,
  onInjectDirective,
  onSkipAgent,
  onPinAgent,
  pinnedAgentId,
  onMaxTurnsChange,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [directiveText, setDirectiveText] = useState('');
  const [targetAgentId, setTargetAgentId] = useState<string>('__all__');
  const [showDirectiveInput, setShowDirectiveInput] = useState(false);
  const [localMaxTurns, setLocalMaxTurns] = useState(maxTurns);

  const handleInject = () => {
    if (!directiveText.trim()) return;
    onInjectDirective(
      directiveText.trim(),
      targetAgentId === '__all__' ? undefined : targetAgentId
    );
    setDirectiveText('');
    setShowDirectiveInput(false);
  };

  const currentMode = ORCHESTRATION_MODES.find((m) => m.value === orchestrationMode);
  const activeAgentIndex = currentAgentIndex % agents.length;

  return (
    <div className="border-b border-border bg-card/60 flex-shrink-0">
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-4 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="CpuChipIcon" size={13} className="text-accent" />
          <span className="font-medium text-foreground">Orchestration</span>
          <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium border border-accent/20">
            {currentMode?.label}
          </span>
          <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={12} />
        </button>

        {/* Quick controls always visible */}
        <div className="ml-auto flex items-center gap-2">
          {sessionStatus === 'running' && (
            <>
              <button
                onClick={() => setShowDirectiveInput(!showDirectiveInput)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs hover:bg-accent/20 transition-colors"
                title="Inject directive to agents"
              >
                <Icon name="PaperAirplaneIcon" size={12} />
                Inject
              </button>
              {pinnedAgentId && (
                <button
                  onClick={() => onPinAgent('')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs hover:bg-warning/20 transition-colors"
                >
                  <Icon name="LockOpenIcon" size={12} />
                  Unpin
                </button>
              )}
            </>
          )}
          {/* Turn progress */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border">
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${Math.min(100, (turnCount / maxTurns) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {turnCount}/{maxTurns}
            </span>
          </div>
        </div>
      </div>

      {/* Directive injection bar */}
      {showDirectiveInput && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <select
            value={targetAgentId}
            onChange={(e) => setTargetAgentId(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-accent flex-shrink-0"
          >
            <option value="__all__">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={directiveText}
            onChange={(e) => setDirectiveText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInject()}
            placeholder="e.g. Focus on security implications, be more concise…"
            className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            autoFocus
          />
          <button
            onClick={handleInject}
            disabled={!directiveText.trim()}
            className="btn-primary text-xs py-1.5 px-3 gap-1.5 disabled:opacity-50"
          >
            <Icon name="PaperAirplaneIcon" size={12} />
            Send
          </button>
          <button
            onClick={() => setShowDirectiveInput(false)}
            className="btn-ghost text-xs py-1.5 px-2"
          >
            <Icon name="XMarkIcon" size={12} />
          </button>
        </div>
      )}

      {/* Expanded panel */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
          {/* Orchestration mode selector */}
          <div>
            <p className="text-xs font-medium text-foreground mb-2">Execution Mode</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {ORCHESTRATION_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => onOrchestrationModeChange(mode.value)}
                  disabled={sessionStatus === 'running'}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all text-xs ${
                    orchestrationMode === mode.value
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-border bg-muted/20 text-muted-foreground hover:border-border/80 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                  title={mode.description}
                >
                  <Icon name={mode.icon as any} size={14} />
                  <span className="font-medium leading-tight">{mode.label}</span>
                </button>
              ))}
            </div>
            {sessionStatus === 'running' && (
              <p className="text-xs text-muted-foreground mt-1.5">
                ⚠ Pause session to change execution mode
              </p>
            )}
          </div>

          {/* Agent controls */}
          <div>
            <p className="text-xs font-medium text-foreground mb-2">Agent Controls</p>
            <div className="space-y-1.5">
              {agents.map((agent, i) => {
                const isActive =
                  orchestrationMode === 'round-robin' &&
                  i === activeAgentIndex &&
                  sessionStatus === 'running';
                const isPinned = pinnedAgentId === agent.id;
                return (
                  <div
                    key={agent.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all ${
                      isActive ? 'border-accent/40 bg-accent/5' : 'border-border bg-muted/10'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: `${agent.color}22`, color: agent.color }}
                    >
                      {agent.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">{agent.name}</span>
                        <span className="text-xs text-muted-foreground/60">({agent.role})</span>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-positive live-indicator" />
                        )}
                        {isPinned && (
                          <Icon name="LockClosedIcon" size={10} className="text-warning" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {agent.model.split('/').pop()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onPinAgent(isPinned ? '' : agent.id)}
                        className={`p-1 rounded transition-colors ${isPinned ? 'text-warning' : 'text-muted-foreground hover:text-foreground'}`}
                        title={isPinned ? 'Unpin agent' : 'Pin agent (always responds next)'}
                      >
                        <Icon name={isPinned ? 'LockClosedIcon' : 'LockOpenIcon'} size={12} />
                      </button>
                      <button
                        onClick={() => onSkipAgent(agent.id)}
                        disabled={sessionStatus !== 'running'}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                        title="Skip this agent's next turn"
                      >
                        <Icon name="ForwardIcon" size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Max turns control */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-foreground">Max Turns</p>
              <span className="text-xs font-mono text-muted-foreground">{localMaxTurns}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={10}
                max={200}
                step={10}
                value={localMaxTurns}
                onChange={(e) => setLocalMaxTurns(Number(e.target.value))}
                onMouseUp={() => onMaxTurnsChange(localMaxTurns)}
                onTouchEnd={() => onMaxTurnsChange(localMaxTurns)}
                className="flex-1 accent-accent"
              />
              <div className="flex gap-1">
                {[25, 50, 100].map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setLocalMaxTurns(v);
                      onMaxTurnsChange(v);
                    }}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${localMaxTurns === v ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
