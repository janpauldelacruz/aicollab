'use client';
import React, { useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import type { Artifact } from './LiveChatroomClient';

interface Props {
  artifacts: Artifact[];
}

const TYPE_ICONS: Record<Artifact['type'], string> = {
  code: 'CodeBracketIcon',
  document: 'DocumentTextIcon',
  diagram: 'RectangleGroupIcon',
  decision: 'CheckCircleIcon',
  spec: 'ClipboardDocumentListIcon',
};

const TYPE_COLORS: Record<Artifact['type'], string> = {
  code: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  document: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  diagram: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  decision: 'text-positive bg-positive/10 border-positive/20',
  spec: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

export default function ArtifactSidebar({ artifacts }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedArtifact = artifacts.find((a) => a.id === selected);

  return (
    <div className="flex flex-col h-full bg-card/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Icon name="DocumentDuplicateIcon" size={15} className="text-accent" />
          <span className="text-sm font-semibold text-foreground">Artifacts</span>
          <span className="bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded-full font-mono">{artifacts.length}</span>
        </div>
        {selected && (
          <button onClick={() => setSelected(null)} className="btn-ghost p-1 text-xs">
            <Icon name="ArrowLeftIcon" size={13} />
          </button>
        )}
      </div>

      {selectedArtifact ? (
        /* Artifact detail view */
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedArtifact.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Created by {selectedArtifact.createdBy} at {selectedArtifact.createdAt}</p>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${TYPE_COLORS[selectedArtifact.type]}`}>
              <Icon name={TYPE_ICONS[selectedArtifact.type] as any} size={11} />
              {selectedArtifact.type}
            </span>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            {selectedArtifact.language && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
                <span className="text-xs font-mono text-muted-foreground">{selectedArtifact.language}</span>
              </div>
            )}
            <pre className="p-3 text-xs font-mono text-foreground leading-relaxed overflow-x-auto bg-background/60 whitespace-pre-wrap">
              {selectedArtifact.content}
            </pre>
          </div>
          <div className="flex gap-2">
            <button onClick={() => toast.success(`"${selectedArtifact.name}" copied to clipboard`)} className="btn-secondary text-xs flex-1 gap-1.5">
              <Icon name="ClipboardDocumentIcon" size={13} />
              Copy
            </button>
            <button onClick={() => toast.success(`"${selectedArtifact.name}" downloaded`)} className="btn-primary text-xs flex-1 gap-1.5">
              <Icon name="ArrowDownTrayIcon" size={13} />
              Download
            </button>
          </div>
        </div>
      ) : (
        /* Artifact list */
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {artifacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Icon name="DocumentDuplicateIcon" size={32} className="text-muted-foreground/30 mb-3" />
              <p className="text-xs text-muted-foreground">No artifacts yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Agents will save code, docs, and decisions here as they work</p>
            </div>
          ) : (
            artifacts.map((artifact) => (
              <button
                key={artifact.id}
                onClick={() => setSelected(artifact.id)}
                className="artifact-appear w-full flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
              >
                <div className={`w-7 h-7 rounded-md border flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[artifact.type]}`}>
                  <Icon name={TYPE_ICONS[artifact.type] as any} size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{artifact.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{artifact.createdBy} · {artifact.createdAt}</p>
                </div>
                <Icon name="ChevronRightIcon" size={13} className="text-muted-foreground/40 group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
              </button>
            ))
          )}
        </div>
      )}

      {/* Footer actions */}
      {!selected && artifacts.length > 0 && (
        <div className="p-3 border-t border-border flex-shrink-0">
          <button onClick={() => toast.success(`${artifacts.length} artifacts exported as ZIP`)} className="btn-secondary w-full text-xs gap-1.5">
            <Icon name="ArchiveBoxArrowDownIcon" size={14} />
            Export All Artifacts
          </button>
        </div>
      )}
    </div>
  );
}