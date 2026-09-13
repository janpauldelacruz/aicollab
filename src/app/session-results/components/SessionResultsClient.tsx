'use client';
import { toast } from 'sonner';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ModeBadge, SessionStatusBadge } from '@/components/ui/StatusBadge';
import ResultsSummaryTab from './ResultsSummaryTab';
import ResultsTranscriptTab from './ResultsTranscriptTab';
import ResultsArtifactsTab from './ResultsArtifactsTab';
import ResultsAnalyticsTab from './ResultsAnalyticsTab';
import {
  formatDuration,
  listSessions,
  loadSession,
  loadSessionById,
} from '@/lib/session/sessionStore';
import { useLiveData } from '@/lib/session/useLiveData';
import type { StoredSession } from '@/lib/session/sessionStore';
import ExportModal from './ExportModal';

const TABS = [
  { id: 'tab-summary', label: 'Summary', icon: 'DocumentTextIcon' },
  { id: 'tab-transcript', label: 'Transcript', icon: 'ChatBubbleLeftRightIcon' },
  { id: 'tab-artifacts', label: 'Artifacts', icon: 'DocumentDuplicateIcon' },
  { id: 'tab-analytics', label: 'Analytics', icon: 'ChartBarIcon' },
];

function EmptyState() {
  return (
    <div className="card-base flex flex-col items-center justify-center text-center py-16 gap-4">
      <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
        <Icon name="ChatBubbleLeftRightIcon" size={22} className="text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">No session results yet</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Run a session in the Live Chatroom and the full transcript, artifacts, and analytics will
          appear here.
        </p>
      </div>
      <Link href="/live-chatroom" className="btn-primary text-xs gap-1.5">
        <Icon name="PlayIcon" size={14} />
        Open Live Chatroom
      </Link>
    </div>
  );
}

function exportSession(session: StoredSession) {
  const lines = [
    `# ${session.topic}`,
    '',
    `Started: ${new Date(session.startedAt).toLocaleString()}`,
    `Duration: ${formatDuration(session.elapsedSeconds)}`,
    `Agents: ${session.agents.map((a) => `${a.name} (${a.role}, ${a.model})`).join(', ')}`,
    `Messages: ${session.messages.length}`,
    '',
  ];

  const deliverable = session.artifacts.find((a) => a.name === 'DELIVERABLE.md');
  if (deliverable) {
    lines.push('## Deliverable', '', deliverable.content, '');
  }

  const files = session.artifacts.filter((a) => a.name !== 'DELIVERABLE.md');
  if (files.length > 0) {
    lines.push('## Files', '');
    for (const file of files) {
      lines.push(
        `### ${file.name}`,
        '',
        `_by ${file.createdBy}_`,
        '',
        '```' + (file.language || ''),
        file.content,
        '```',
        ''
      );
    }
  }

  lines.push(
    '## Transcript',
    '',
    ...session.messages.map((m) => `**[${m.timestamp}] ${m.agentName}** — ${m.content}\n`)
  );

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${session.id}.md`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success('Session transcript downloaded');
}

export default function SessionResultsClient() {
  const [activeTab, setActiveTab] = useState('tab-summary');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Read ?id= after mount so server and client render the same first paint.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setSelectedId(id);
  }, []);

  const read = useCallback(
    () => ({
      archive: listSessions(),
      session: selectedId ? loadSessionById(selectedId) : loadSession(),
    }),
    [selectedId]
  );
  const [{ archive, session }, refresh] = useLiveData(read, {
    archive: [] as StoredSession[],
    session: null as StoredSession | null,
  });

  if (!session) {
    return <EmptyState />;
  }

  // Must be a key the badge knows — 'active' was not one, which crashed the page.
  const status =
    session.status === 'running' ? 'running' : session.status === 'paused' ? 'paused' : 'completed';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Link href="/sessions-dashboard" className="btn-ghost p-2 mt-0.5">
            <Icon name="ArrowLeftIcon" size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-foreground">{session.topic}</h1>
              <SessionStatusBadge status={status} />
              <ModeBadge mode="build" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {session.agents.length} agents · {session.messages.length} messages ·{' '}
              {session.artifacts.length} artifacts · {formatDuration(session.elapsedSeconds)} ·
              Started {new Date(session.startedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {archive.length > 1 && (
            <select
              value={session.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="input-base text-xs py-1.5 w-auto max-w-[15rem]"
              title="Past sessions are kept — pick one"
            >
              {archive.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.topic.slice(0, 40)}
                  {s.topic.length > 40 ? '…' : ''} · {new Date(s.startedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}
          <button onClick={refresh} className="btn-secondary text-xs gap-1.5">
            <Icon name="ArrowPathIcon" size={14} />
            Refresh
          </button>
          <Link href="/share-session" className="btn-secondary text-xs gap-1.5">
            <Icon name="ShareIcon" size={14} />
            Share
          </Link>
          <button onClick={() => exportSession(session)} className="btn-secondary text-xs gap-1.5">
            <Icon name="ArrowDownTrayIcon" size={14} />
            Quick Export
          </button>
          <button onClick={() => setExportModalOpen(true)} className="btn-primary text-xs gap-1.5">
            <Icon name="ArrowDownTrayIcon" size={14} />
            Export Transcript
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => {
          const badge =
            tab.id === 'tab-artifacts'
              ? session.artifacts.length
              : tab.id === 'tab-transcript'
                ? session.messages.length
                : 0;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon as never} size={15} />
              {tab.label}
              {badge > 0 && (
                <span className="bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded-full font-mono">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'tab-summary' && <ResultsSummaryTab session={session} />}
      {activeTab === 'tab-transcript' && <ResultsTranscriptTab session={session} />}
      {activeTab === 'tab-artifacts' && <ResultsArtifactsTab session={session} />}
      {activeTab === 'tab-analytics' && <ResultsAnalyticsTab session={session} />}

      {/* JSON / Markdown / PDF export of this session */}
      {exportModalOpen && (
        <ExportModal session={session} onClose={() => setExportModalOpen(false)} />
      )}
    </div>
  );
}
