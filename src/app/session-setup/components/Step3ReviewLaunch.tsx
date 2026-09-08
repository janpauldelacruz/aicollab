'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { ModeBadge } from '@/components/ui/StatusBadge';
import type { SessionConfig, AgentRole } from './SessionSetupClient';

interface Props {
  config: SessionConfig;
  onBack: () => void;
  onLaunch: () => void;
  isLaunching: boolean;
}

const ROLE_COLORS: Record<AgentRole, string> = {
  pm: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  brainstormer: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  coder: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  designer: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  critic: 'bg-red-500/20 text-red-400 border-red-500/30',
  researcher: 'bg-green-500/20 text-green-400 border-green-500/30',
  architect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export default function Step3ReviewLaunch({ config, onBack, onLaunch, isLaunching }: Props) {
  const missingAgents = config.agents.length < 2;
  const missingName = !config.name.trim();
  const missingTopic = !config.topic.trim();
  const canLaunch = !missingAgents && !missingName && !missingTopic;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Review &amp; Launch</h2>
        <p className="text-sm text-muted-foreground mt-1">Confirm your session configuration before launching</p>
      </div>

      {/* Session overview */}
      <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Session Name</p>
            <p className="text-lg font-semibold text-foreground">{config.name || '-'}</p>
          </div>
          <ModeBadge mode={config.mode} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Topic</p>
          <p className="text-sm text-foreground leading-relaxed">{config.topic || '-'}</p>
        </div>
        {config.goal && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Goal</p>
            <p className="text-sm text-foreground leading-relaxed">{config.goal}</p>
          </div>
        )}
        <div className="flex items-center gap-6 pt-1 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Max Turns</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">{config.maxTurns}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Turn Timeout</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">{config.turnTimeout}s</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Agents</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">{config.agents.length}</p>
          </div>
        </div>
      </div>

      {/* Agent roster */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Agent Roster ({config.agents.length})</p>
        {config.agents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl">No agents configured - go back to Step 2</p>
        ) : (
          <div className="space-y-2">
            {config.agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/10">
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold flex-shrink-0 ${ROLE_COLORS[agent.role]}`}>
                  {agent.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{agent.name}</p>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${ROLE_COLORS[agent.role]}`}>
                      {agent.role}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{agent.model}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {[
                    { label: 'C', val: agent.creativity, title: 'Creativity' },
                    { label: 'V', val: agent.verbosity, title: 'Verbosity' },
                    { label: 'A', val: agent.assertiveness, title: 'Assertiveness' },
                  ].map((s) => (
                    <div key={`review-stat-${agent.id}-${s.label}`} className="text-center" title={s.title}>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-xs font-semibold text-foreground tabular-nums">{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation warnings */}
      {!canLaunch && (
        <div className="space-y-2">
          {missingName && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-negative/10 border border-negative/20">
              <Icon name="XCircleIcon" size={15} className="text-negative flex-shrink-0" />
              <p className="text-xs text-negative">Session name is missing - go back to Step 1</p>
            </div>
          )}
          {missingTopic && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-negative/10 border border-negative/20">
              <Icon name="XCircleIcon" size={15} className="text-negative flex-shrink-0" />
              <p className="text-xs text-negative">Topic / task is missing - go back to Step 1</p>
            </div>
          )}
          {missingAgents && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-negative/10 border border-negative/20">
              <Icon name="XCircleIcon" size={15} className="text-negative flex-shrink-0" />
              <p className="text-xs text-negative">At least 2 agents are required - go back to Step 2</p>
            </div>
          )}
        </div>
      )}

      {canLaunch && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-positive/10 border border-positive/20">
          <Icon name="CheckCircleIcon" size={15} className="text-positive flex-shrink-0" />
          <p className="text-xs text-positive">Everything looks good - your session is ready to launch</p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-secondary gap-1.5">
          <Icon name="ArrowLeftIcon" size={16} />
          Back
        </button>
        <button
          type="button"
          onClick={onLaunch}
          disabled={!canLaunch || isLaunching}
          className="btn-primary px-8 gap-2"
        >
          {isLaunching ? (
            <>
              <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
              Launching...
            </>
          ) : (
            <>
              <Icon name="RocketLaunchIcon" size={16} />
              Launch Session
            </>
          )}
        </button>
      </div>
    </div>
  );
}