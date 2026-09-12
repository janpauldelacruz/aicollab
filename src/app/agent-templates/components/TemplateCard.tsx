'use client';
import React from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import type { AgentTemplate } from './AgentTemplatesClient';
import { shortModelLabel } from '@/lib/ai/models';

interface Props {
  template: AgentTemplate;
  onDuplicate: (t: AgentTemplate) => void;
  onDelete: (t: AgentTemplate) => void;
  onUse: (t: AgentTemplate) => void;
}

const ROLE_COLORS: Record<string, string> = {
  pm: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  brainstormer: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  coder: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  designer: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  critic: 'bg-red-500/20 text-red-400 border-red-500/30',
  researcher: 'bg-green-500/20 text-green-400 border-green-500/30',
  architect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const ROLE_LABELS: Record<string, string> = {
  pm: 'Project Manager',
  brainstormer: 'Brainstormer',
  coder: 'Coder',
  designer: 'Designer',
  critic: 'Critic',
  researcher: 'Researcher',
  architect: 'Architect',
};

const ROLE_AVATAR_COLORS: Record<string, string> = {
  pm: '#a78bfa',
  brainstormer: '#fbbf24',
  coder: '#22d3ee',
  designer: '#f472b6',
  critic: '#f87171',
  researcher: '#4ade80',
  architect: '#60a5fa',
};

export default function TemplateCard({ template, onDuplicate, onDelete, onUse }: Props) {
  const avatarColor = ROLE_AVATAR_COLORS[template.role];

  return (
    <div className="card-base group hover:border-primary/30 transition-all duration-200 session-card-hover flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{
              backgroundColor: `${avatarColor}22`,
              color: avatarColor,
              border: `1.5px solid ${avatarColor}44`,
            }}
          >
            {template.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground">{template.name}</p>
              {template.isBuiltIn && (
                <span className="flex-shrink-0">
                  <Icon name="SparklesIcon" size={11} className="text-accent" />
                </span>
              )}
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {shortModelLabel(template.model)}
            </span>
          </div>
        </div>

        {/* Actions — visible on hover */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onDuplicate(template)}
            className="btn-ghost p-1.5"
            title="Duplicate template"
          >
            <Icon name="DocumentDuplicateIcon" size={13} />
          </button>
          {!template.isBuiltIn && (
            <button
              onClick={() => onDelete(template)}
              className="btn-ghost p-1.5 text-negative hover:bg-negative/10"
              title="Delete template — this cannot be undone"
            >
              <Icon name="TrashIcon" size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Role badge */}
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border w-fit mb-2 ${ROLE_COLORS[template.role]}`}
      >
        {ROLE_LABELS[template.role]}
      </span>

      {/* Personality */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3 flex-1">
        {template.personality}
      </p>

      {/* Traits */}
      <div className="flex flex-wrap gap-1 mb-3">
        {template.traits.slice(0, 3).map((trait) => (
          <span
            key={`trait-${template.id}-${trait}`}
            className="px-2 py-0.5 rounded-full bg-muted/60 text-xs text-muted-foreground border border-border/50"
          >
            {trait}
          </span>
        ))}
        {template.traits.length > 3 && (
          <span className="px-2 py-0.5 rounded-full bg-muted/40 text-xs text-muted-foreground/60">
            +{template.traits.length - 3}
          </span>
        )}
      </div>

      {/* Behavior bars */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Creativity', val: template.creativity },
          { label: 'Verbosity', val: template.verbosity },
          { label: 'Assertive', val: template.assertiveness },
        ].map((s) => (
          <div key={`card-stat-${template.id}-${s.label}`}>
            <div className="h-1 rounded-full bg-muted overflow-hidden mb-1">
              <div
                className="h-full rounded-full"
                style={{ width: `${s.val}%`, backgroundColor: avatarColor, opacity: 0.7 }}
              />
            </div>
            <p className="text-xs text-muted-foreground/60 text-center">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Icon name="PlayCircleIcon" size={11} />
            {template.usageCount} uses
          </span>
          <span className="flex items-center gap-1">
            <Icon name="CalendarIcon" size={11} />
            {template.lastUsed === '—' ? 'Never' : template.lastUsed}
          </span>
        </div>
        <button
          onClick={() => onUse(template)}
          title="Add this agent to a new session"
          className="btn-ghost text-xs py-1 px-2 text-primary hover:bg-primary/10"
        >
          Use
        </button>
      </div>
    </div>
  );
}
