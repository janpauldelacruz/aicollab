import React from 'react';

type StatusType = 'running' | 'completed' | 'paused' | 'draft' | 'archived';
type ModeType = 'brainstorm' | 'code' | 'build' | 'chat';
type RoleType = 'brainstormer' | 'coder' | 'pm' | 'designer' | 'critic' | 'researcher' | 'architect';

export function SessionStatusBadge({ status }: { status: StatusType }) {
  const map: Record<StatusType, { label: string; className: string; dot?: boolean }> = {
    running: { label: 'Running', className: 'badge-status-running', dot: true },
    completed: { label: 'Completed', className: 'badge-status-completed' },
    paused: { label: 'Paused', className: 'badge-status-paused' },
    draft: { label: 'Draft', className: 'badge-status-draft' },
    archived: { label: 'Archived', className: 'badge-status-draft' },
  };
  const cfg = map[status];
  return (
    <span className={cfg.className}>
      {cfg.dot && <span className="w-1.5 h-1.5 rounded-full bg-positive live-indicator inline-block" />}
      {cfg.label}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: ModeType }) {
  const map: Record<ModeType, { label: string; className: string }> = {
    brainstorm: { label: 'Brainstorm', className: 'badge-mode-brainstorm' },
    code: { label: 'Code', className: 'badge-mode-code' },
    build: { label: 'Build', className: 'badge-mode-build' },
    chat: { label: 'Chat', className: 'badge-mode-chat' },
  };
  const cfg = map[mode];
  return <span className={cfg.className}>{cfg.label}</span>;
}

export function RoleBadge({ role }: { role: RoleType }) {
  const map: Record<RoleType, string> = {
    brainstormer: 'badge-role-brainstormer',
    coder: 'badge-role-coder',
    pm: 'badge-role-pm',
    designer: 'badge-role-designer',
    critic: 'badge-role-critic',
    researcher: 'badge-role-researcher',
    architect: 'badge-role-architect',
  };
  const labels: Record<RoleType, string> = {
    brainstormer: 'Brainstormer',
    coder: 'Coder',
    pm: 'Project Manager',
    designer: 'Designer',
    critic: 'Critic',
    researcher: 'Researcher',
    architect: 'Architect',
  };
  return <span className={map[role]}>{labels[role]}</span>;
}