'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import type { StoredSession } from '@/lib/session/sessionStore';

interface Props {
  session: StoredSession;
}

const ROLE_LABELS: Record<string, string> = {
  pm: 'PM',
  coder: 'Coder',
  designer: 'Designer',
  critic: 'Critic',
  architect: 'Architect',
  brainstormer: 'Brainstormer',
  researcher: 'Researcher',
};

export default function ResultsTranscriptTab({ session }: Props) {
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = session.messages.filter((m) => {
    const matchSearch =
      m.content.toLowerCase().includes(search.toLowerCase()) ||
      m.agentName.toLowerCase().includes(search.toLowerCase());
    const matchAgent = agentFilter === 'all' || m.agentId === agentFilter;
    const matchType = typeFilter === 'all' || m.type === typeFilter;
    return matchSearch && matchAgent && matchType;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon
            name="MagnifyingGlassIcon"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search transcript…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-sm"
          />
        </div>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="input-base text-xs py-1.5 w-auto"
        >
          <option value="all">All Agents</option>
          {session.agents.map((a) => (
            <option key={`agent-filter-${a.id}`} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="input-base text-xs py-1.5 w-auto"
        >
          <option value="all">All Types</option>
          <option value="message">Messages</option>
          <option value="code">Code</option>
          <option value="decision">Decisions</option>
        </select>
        <p className="text-xs text-muted-foreground self-center flex-shrink-0">
          {filtered.length} messages
        </p>
      </div>

      {/* Transcript */}
      <div className="card-base p-0 divide-y divide-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <Icon name="MagnifyingGlassIcon" size={28} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No messages match your filters</p>
          </div>
        ) : (
          filtered.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5"
                style={{
                  backgroundColor: `${msg.agentColor}22`,
                  color: msg.agentColor,
                  border: `1px solid ${msg.agentColor}44`,
                }}
              >
                {msg.agentName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold" style={{ color: msg.agentColor }}>
                    {msg.agentName}
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    {ROLE_LABELS[msg.agentRole] || msg.agentRole}
                  </span>
                  {msg.type === 'decision' && (
                    <span className="text-xs text-positive bg-positive/10 px-1.5 py-0.5 rounded font-medium">
                      Decision
                    </span>
                  )}
                  {msg.type === 'code' && (
                    <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded font-medium">
                      Code
                    </span>
                  )}
                  <span className="text-xs font-mono text-muted-foreground/40 ml-auto">
                    {msg.timestamp}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
