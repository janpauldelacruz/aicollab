'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';

const KEY_DECISIONS = [
  { id: 'dec-001', decision: 'Use shared PostgreSQL database with row-level security for multi-tenancy', madeBy: 'Mira', rationale: 'Simpler ops for MVP scale (SMB 5–50 users), with documented migration path to schema-per-tenant', timestamp: '00:05:00' },
  { id: 'dec-002', decision: 'Implement 3-step progressive onboarding with skip options and sensible defaults', madeBy: 'Mira', rationale: 'Research shows 40% better completion vs long forms; skippers get pre-populated demo data', timestamp: '00:06:30' },
  { id: 'dec-003', decision: 'Use Stripe metered billing from day one even with flat-rate initial pricing', madeBy: 'Orion', rationale: 'Enables future usage-based tiers without architectural changes', timestamp: '00:08:05' },
  { id: 'dec-004', decision: 'Add composite indexes on tenant_id for all tenant-scoped tables', madeBy: 'Zara', rationale: 'Rex identified missing index — critical for performance at scale', timestamp: '00:06:45' },
];

const AGENT_STATS = [
  { id: 'stat-mira', name: 'Mira', role: 'PM', messages: 12, artifacts: 2, color: '#a78bfa', contribution: 19 },
  { id: 'stat-zara', name: 'Zara', role: 'Coder', messages: 18, artifacts: 3, color: '#22d3ee', contribution: 28 },
  { id: 'stat-rex', name: 'Rex', role: 'Critic', messages: 11, artifacts: 1, color: '#f87171', contribution: 17 },
  { id: 'stat-orion', name: 'Orion', role: 'Architect', messages: 9, artifacts: 3, color: '#60a5fa', contribution: 24 },
  { id: 'stat-lena', name: 'Lena', role: 'Designer', messages: 7, artifacts: 1, color: '#f472b6', contribution: 12 },
];

export default function ResultsSummaryTab() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { id: 'sum-messages', label: 'Total Messages', value: '57', icon: 'ChatBubbleLeftRightIcon', color: 'text-primary' },
          { id: 'sum-artifacts', label: 'Artifacts Produced', value: '8', icon: 'DocumentDuplicateIcon', color: 'text-accent' },
          { id: 'sum-decisions', label: 'Key Decisions', value: '4', icon: 'CheckCircleIcon', color: 'text-positive' },
          { id: 'sum-duration', label: 'Session Duration', value: '1h 23m', icon: 'ClockIcon', color: 'text-warning' },
        ].map((s) => (
          <div key={s.id} className="card-base">
            <div className="flex items-center gap-2 mb-2">
              <Icon name={s.icon as any} size={16} className={s.color} />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key decisions */}
        <div className="card-base space-y-4">
          <div className="flex items-center gap-2">
            <Icon name="CheckCircleIcon" size={16} className="text-positive" />
            <h3 className="text-sm font-semibold text-foreground">Key Decisions</h3>
          </div>
          <div className="space-y-3">
            {KEY_DECISIONS.map((d, i) => (
              <div key={d.id} className="flex gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-positive/20 border border-positive/30 flex items-center justify-center mt-0.5">
                  <span className="text-xs font-semibold text-positive">{i + 1}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">{d.decision}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{d.rationale}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-muted-foreground/60">by {d.madeBy}</span>
                    <span className="text-xs font-mono text-muted-foreground/40">{d.timestamp}</span>
                  </div>
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
            {AGENT_STATS.sort((a, b) => b.contribution - a.contribution).map((agent) => (
              <div key={agent.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: `${agent.color}22`, color: agent.color }}>
                      {agent.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-foreground">{agent.name}</span>
                    <span className="text-xs text-muted-foreground">{agent.role}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{agent.messages} msgs</span>
                    <span>{agent.artifacts} artifacts</span>
                    <span className="font-semibold tabular-nums" style={{ color: agent.color }}>{agent.contribution}%</span>
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
              The session successfully produced a complete SaaS MVP architecture including a PostgreSQL schema with row-level security, a 3-step onboarding flow specification, Stripe billing integration design, and a security checklist. All 4 key architectural decisions were reached by consensus, with Rex's critical feedback improving the database indexing strategy and onboarding empty-state handling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}