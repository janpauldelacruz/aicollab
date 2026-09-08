'use client';
import React, { useState } from 'react';
import Link from 'next/link';

import Icon from '@/components/ui/AppIcon';

import SessionsKPIGrid from './SessionsKPIGrid';
import SessionsTable from './SessionsTable';

export type SessionMode = 'brainstorm' | 'code' | 'build' | 'chat';
export type SessionStatus = 'running' | 'completed' | 'paused' | 'draft';

export interface Session {
  id: string;
  name: string;
  mode: SessionMode;
  status: SessionStatus;
  agentCount: number;
  messageCount: number;
  artifactCount: number;
  duration: string;
  startedAt: string;
  topic: string;
  completionPct: number;
}

export const MOCK_SESSIONS: Session[] = [
  { id: 'sess-001', name: 'SaaS MVP Architecture', mode: 'build', status: 'running', agentCount: 5, messageCount: 142, artifactCount: 8, duration: '1h 23m', startedAt: '2026-09-07 00:10', topic: 'Design and implement a SaaS MVP with auth, billing, and onboarding', completionPct: 68 },
  { id: 'sess-002', name: 'API Rate Limiting Strategy', mode: 'brainstorm', status: 'running', agentCount: 3, messageCount: 87, artifactCount: 3, duration: '42m', startedAt: '2026-09-07 00:51', topic: 'Debate best strategies for API rate limiting in distributed systems', completionPct: 45 },
  { id: 'sess-003', name: 'React Component Library', mode: 'code', status: 'completed', agentCount: 4, messageCount: 231, artifactCount: 14, duration: '2h 07m', startedAt: '2026-09-06 21:00', topic: 'Build a reusable component library with Tailwind and TypeScript', completionPct: 100 },
  { id: 'sess-004', name: 'Onboarding UX Debate', mode: 'brainstorm', status: 'completed', agentCount: 4, messageCount: 178, artifactCount: 6, duration: '1h 44m', startedAt: '2026-09-06 18:30', topic: 'Compare progressive vs upfront onboarding approaches for B2B SaaS', completionPct: 100 },
  { id: 'sess-005', name: 'Database Schema Design', mode: 'code', status: 'paused', agentCount: 3, messageCount: 64, artifactCount: 4, duration: '38m', startedAt: '2026-09-06 17:15', topic: 'Design normalized schema for multi-tenant analytics platform', completionPct: 31 },
  { id: 'sess-006', name: 'Product Roadmap Q4', mode: 'build', status: 'completed', agentCount: 6, messageCount: 312, artifactCount: 11, duration: '3h 12m', startedAt: '2026-09-06 14:00', topic: 'Collaboratively build Q4 product roadmap with prioritization framework', completionPct: 100 },
  { id: 'sess-007', name: 'Security Audit Checklist', mode: 'code', status: 'completed', agentCount: 3, messageCount: 99, artifactCount: 7, duration: '1h 02m', startedAt: '2026-09-05 22:00', topic: 'Generate comprehensive security audit checklist for Node.js APIs', completionPct: 100 },
  { id: 'sess-008', name: 'Brand Voice Workshop', mode: 'chat', status: 'completed', agentCount: 4, messageCount: 205, artifactCount: 5, duration: '1h 55m', startedAt: '2026-09-05 19:00', topic: 'Explore brand voice options for a developer tools startup', completionPct: 100 },
  { id: 'sess-009', name: 'Micro-Frontend Architecture', mode: 'build', status: 'draft', agentCount: 5, messageCount: 0, artifactCount: 0, duration: '—', startedAt: '—', topic: 'Plan micro-frontend architecture for enterprise portal', completionPct: 0 },
  { id: 'sess-010', name: 'LLM Fine-tuning Strategy', mode: 'brainstorm', status: 'completed', agentCount: 4, messageCount: 156, artifactCount: 4, duration: '1h 28m', startedAt: '2026-09-05 16:00', topic: 'Debate approaches to fine-tuning LLMs for domain-specific tasks', completionPct: 100 },
];

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Paused', value: 'paused' },
  { label: 'Draft', value: 'draft' },
];

const MODE_FILTERS: { label: string; value: string }[] = [
  { label: 'All Modes', value: 'all' },
  { label: 'Build', value: 'build' },
  { label: 'Brainstorm', value: 'brainstorm' },
  { label: 'Code', value: 'code' },
  { label: 'Chat', value: 'chat' },
];

export default function SessionsDashboardClient() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = MOCK_SESSIONS.filter((s) => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchMode = modeFilter === 'all' || s.mode === modeFilter;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.topic.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchMode && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor all AI collaboration sessions — running, completed, and queued.
          </p>
        </div>
        <Link href="/session-setup" className="btn-primary flex-shrink-0">
          <Icon name="PlusIcon" size={16} />
          New Session
        </Link>
      </div>

      {/* KPI Grid */}
      <SessionsKPIGrid sessions={MOCK_SESSIONS} />

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sessions or topics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={`status-filter-${f.value}`}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  statusFilter === f.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="input-base text-xs py-1.5 w-auto pr-8"
          >
            {MODE_FILTERS.map((f) => (
              <option key={`mode-filter-${f.value}`} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sessions table */}
      <SessionsTable sessions={filtered} />
    </div>
  );
}