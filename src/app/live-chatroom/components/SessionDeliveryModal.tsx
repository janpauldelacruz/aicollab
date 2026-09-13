'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import type { ChatMessage, Artifact, LiveAgent } from './LiveChatroomClient';

interface Props {
  topic: string;
  messages: ChatMessage[];
  artifacts: Artifact[];
  agents: LiveAgent[];
  elapsedSeconds: number;
  turnCount: number;
  maxTurns: number;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function extractKeyDecisions(messages: ChatMessage[]): string[] {
  const decisionKeywords = [
    /\bwe (should|will|decided|agreed|chose|recommend)\b/i,
    /\bdecision[:\s]/i,
    /\bfinal(ly|ly decided)?\b.*\buse\b/i,
    /\bgo with\b/i,
    /\blet'?s (use|build|implement|adopt)\b/i,
  ];
  const decisions: string[] = [];
  for (const msg of messages) {
    const lines = msg.content
      .split(/[.\n]/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      if (line.length < 20 || line.length > 200) continue;
      if (decisionKeywords.some((re) => re.test(line))) {
        decisions.push(line);
        if (decisions.length >= 4) break;
      }
    }
    if (decisions.length >= 4) break;
  }
  return decisions;
}

function getTopContributors(agents: LiveAgent[]): LiveAgent[] {
  return [...agents].sort((a, b) => b.messageCount - a.messageCount).slice(0, 3);
}

export default function SessionDeliveryModal({
  topic,
  messages,
  artifacts,
  agents,
  elapsedSeconds,
  turnCount,
  maxTurns,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);
  const keyDecisions = extractKeyDecisions(messages);
  const topContributors = getTopContributors(agents);
  const completionPct = maxTurns > 0 ? Math.min(100, Math.round((turnCount / maxTurns) * 100)) : 0;
  const totalMessages = messages.length;

  const handleCopySummary = () => {
    const lines = [
      `# Session Summary: ${topic}`,
      ``,
      `**Duration:** ${formatDuration(elapsedSeconds)}`,
      `**Messages:** ${totalMessages}`,
      `**Artifacts:** ${artifacts.length}`,
      `**Turns:** ${turnCount}/${maxTurns} (${completionPct}% complete)`,
      ``,
      `## Agents`,
      ...agents.map((a) => `- ${a.name} (${a.role}): ${a.messageCount} messages`),
      ``,
      ...(keyDecisions.length > 0
        ? [`## Key Decisions`, ...keyDecisions.map((d, i) => `${i + 1}. ${d}`), ``]
        : []),
      ...(artifacts.length > 0
        ? [`## Artifacts Produced`, ...artifacts.map((a) => `- ${a.name} (${a.type})`)]
        : []),
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      toast.success('Summary copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-border flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-positive/15 border border-positive/25 flex items-center justify-center flex-shrink-0">
              <Icon name="TrophyIcon" size={20} className="text-positive" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Session Complete</h2>
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{topic}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 flex-shrink-0">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Duration',
                value: formatDuration(elapsedSeconds),
                icon: 'ClockIcon',
                color: 'text-warning',
              },
              {
                label: 'Messages',
                value: String(totalMessages),
                icon: 'ChatBubbleLeftRightIcon',
                color: 'text-primary',
              },
              {
                label: 'Artifacts',
                value: String(artifacts.length),
                icon: 'DocumentDuplicateIcon',
                color: 'text-accent',
              },
              {
                label: 'Completion',
                value: `${completionPct}%`,
                icon: 'CheckCircleIcon',
                color: 'text-positive',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-muted/30 p-3 text-center"
              >
                <Icon name={s.icon as any} size={16} className={`${s.color} mx-auto mb-1`} />
                <p className="text-xl font-bold text-foreground tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Agent contributions */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Icon name="UsersIcon" size={15} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Agent Contributions</h3>
            </div>
            <div className="space-y-2">
              {agents.map((agent) => {
                const pct =
                  totalMessages > 0 ? Math.round((agent.messageCount / totalMessages) * 100) : 0;
                return (
                  <div key={agent.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: `${agent.color}22`, color: agent.color }}
                        >
                          {agent.name.charAt(0)}
                        </div>
                        <span className="font-medium text-foreground">{agent.name}</span>
                        <span className="text-muted-foreground">({agent.role})</span>
                      </div>
                      <span className="font-mono text-muted-foreground">
                        {agent.messageCount} msgs · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: agent.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key decisions extracted */}
          {keyDecisions.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="CheckCircleIcon" size={15} className="text-positive" />
                <h3 className="text-sm font-semibold text-foreground">Key Decisions Reached</h3>
              </div>
              <ul className="space-y-2">
                {keyDecisions.map((d, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-positive/15 border border-positive/25 flex items-center justify-center text-xs font-semibold text-positive mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-foreground leading-snug">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Artifacts produced */}
          {artifacts.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="DocumentDuplicateIcon" size={15} className="text-accent" />
                <h3 className="text-sm font-semibold text-foreground">Artifacts Produced</h3>
                <span className="bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded-full font-mono">
                  {artifacts.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {artifacts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-background/40"
                  >
                    <Icon name="DocumentTextIcon" size={14} className="text-accent flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {a.type}
                        {a.language ? ` · ${a.language}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What was accomplished */}
          <div className="rounded-xl border border-positive/20 bg-positive/5 p-4">
            <div className="flex items-start gap-3">
              <Icon name="SparklesIcon" size={16} className="text-positive flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  What was accomplished
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {agents.length} AI agents collaborated on{' '}
                  <span className="text-foreground font-medium">&ldquo;{topic}&rdquo;</span> for{' '}
                  {formatDuration(elapsedSeconds)}, producing {totalMessages} messages
                  {artifacts.length > 0
                    ? ` and ${artifacts.length} artifact${artifacts.length !== 1 ? 's' : ''}`
                    : ''}
                  .
                  {completionPct === 100
                    ? ' The session ran to full completion.'
                    : ` The session reached ${completionPct}% of the planned turns.`}
                  {keyDecisions.length > 0
                    ? ` ${keyDecisions.length} key decision${keyDecisions.length !== 1 ? 's' : ''} were identified.`
                    : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-border flex-shrink-0 flex flex-col sm:flex-row gap-3">
          <button onClick={handleCopySummary} className="btn-secondary text-sm gap-2 flex-1">
            <Icon name={copied ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={15} />
            {copied ? 'Copied!' : 'Copy Summary'}
          </button>
          <Link
            href="/session-results"
            className="btn-primary text-sm gap-2 flex-1 flex items-center justify-center"
            onClick={onClose}
          >
            <Icon name="ChartBarIcon" size={15} />
            View Full Results
          </Link>
        </div>
      </div>
    </div>
  );
}
