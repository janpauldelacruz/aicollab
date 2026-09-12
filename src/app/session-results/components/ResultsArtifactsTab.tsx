'use client';
import React, { useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import type { SessionArtifact, StoredSession } from '@/lib/session/sessionStore';

interface Props {
  session: StoredSession;
}

const TYPE_ICONS: Record<string, string> = {
  code: 'CodeBracketIcon',
  document: 'DocumentTextIcon',
  diagram: 'RectangleGroupIcon',
  decision: 'CheckCircleIcon',
  spec: 'ClipboardDocumentListIcon',
};

const TYPE_COLORS: Record<string, string> = {
  code: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  document: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  diagram: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  decision: 'text-positive bg-positive/10 border-positive/20',
  spec: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

function downloadArtifact(artifact: SessionArtifact) {
  const blob = new Blob([artifact.content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = artifact.name;
  link.click();
  URL.revokeObjectURL(url);
  toast.success(`"${artifact.name}" downloaded`);
}

export default function ResultsArtifactsTab({ session }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const artifacts: SessionArtifact[] = session.artifacts;
  const filtered = artifacts.filter((a) => typeFilter === 'all' || a.type === typeFilter);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {['all', 'code', 'document', 'spec', 'decision'].map((t) => (
            <button
              key={`type-filter-${t}`}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === t
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => artifacts.forEach(downloadArtifact)}
          disabled={artifacts.length === 0}
          className="btn-primary text-xs gap-1.5 flex-shrink-0 disabled:opacity-40"
        >
          <Icon name="ArchiveBoxArrowDownIcon" size={14} />
          Export All
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="card-base py-12 flex flex-col items-center gap-3">
          <Icon name="DocumentDuplicateIcon" size={28} className="text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No artifacts in this session yet — agents save code, docs, and decisions here as they
            work.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((artifact) => (
          <div
            key={artifact.id}
            className="card-base group hover:border-primary/30 transition-all cursor-pointer session-card-hover"
            onClick={() => setSelected(selected === artifact.id ? null : artifact.id)}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[artifact.type]}`}
                >
                  <Icon name={TYPE_ICONS[artifact.type] as any} size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{artifact.name}</p>
                  <p className="text-xs text-muted-foreground">
                    by {artifact.createdBy} · {artifact.createdAt}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border flex-shrink-0 ${TYPE_COLORS[artifact.type]}`}
              >
                {artifact.type}
              </span>
            </div>

            {selected === artifact.id && (
              <div className="mt-2 rounded-lg border border-border overflow-hidden">
                {artifact.language && (
                  <div className="px-3 py-1.5 bg-muted/60 border-b border-border">
                    <span className="text-xs font-mono text-muted-foreground">
                      {artifact.language}
                    </span>
                  </div>
                )}
                <pre className="p-3 text-xs font-mono text-foreground leading-relaxed overflow-x-auto bg-background/60 whitespace-pre-wrap max-h-48">
                  {artifact.content}
                </pre>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(artifact.content);
                  toast.success(`"${artifact.name}" copied`);
                }}
                className="btn-secondary text-xs flex-1 gap-1"
              >
                <Icon name="ClipboardDocumentIcon" size={12} />
                Copy
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadArtifact(artifact);
                }}
                className="btn-primary text-xs flex-1 gap-1"
              >
                <Icon name="ArrowDownTrayIcon" size={12} />
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
