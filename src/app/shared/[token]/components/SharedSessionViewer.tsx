'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { getSessionByShareToken } from '@/lib/supabase/sessionService';
import type { DBSession, DBMessage, DBArtifact, DBShareLink } from '@/lib/supabase/sessionService';

interface SharedSessionViewerProps {
  token: string;
}

interface SharedData {
  session: DBSession;
  agents: any[];
  messages: DBMessage[];
  artifacts: DBArtifact[];
  shareLink: DBShareLink;
}

const AGENT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

function getAgentColor(agentId: string, agents: any[]): string {
  const idx = agents.findIndex((a) => a.agent_key === agentId || a.id === agentId);
  return idx >= 0 ? (agents[idx].color || AGENT_COLORS[idx % AGENT_COLORS.length]) : AGENT_COLORS[0];
}

export default function SharedSessionViewer({ token }: SharedSessionViewerProps) {
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'artifacts'>('transcript');

  useEffect(() => {
    getSessionByShareToken(token).then((result) => {
      if (!result) {
        setError('This share link is invalid or has expired.');
      } else {
        setData(result);
      }
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading shared session…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Icon name="ExclamationTriangleIcon" size={28} className="text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Link Not Found</h1>
          <p className="text-sm text-muted-foreground mb-6">{error || 'This share link is invalid or has expired.'}</p>
          <Link href="/" className="btn-primary text-sm">Go to AICollab</Link>
        </div>
      </div>
    );
  }

  const { session, agents, messages, artifacts, shareLink } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center gap-3 px-4 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Icon name="ShareIcon" size={14} className="text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Shared Session</span>
        </div>
        <div className="w-px h-5 bg-border" />
        <span className="text-sm text-muted-foreground truncate hidden sm:block">{session.name}</span>
        <div className="ml-auto flex items-center gap-2">
          {shareLink.allow_rerun && (
            <Link href="/session-setup" className="btn-primary text-xs gap-1.5 py-1.5">
              <Icon name="ArrowPathIcon" size={13} />
              Re-run
            </Link>
          )}
          <Link href="/sign-up-login" className="btn-secondary text-xs gap-1.5 py-1.5">
            <Icon name="UserPlusIcon" size={13} />
            Sign Up Free
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Session info */}
        <div className="card-base p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground mb-1">{session.name}</h1>
              <p className="text-sm text-muted-foreground">{session.topic}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/40 border border-border">
                <Icon name="ChatBubbleLeftRightIcon" size={12} />
                {messages.length} messages
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/40 border border-border">
                <Icon name="DocumentDuplicateIcon" size={12} />
                {artifacts.length} artifacts
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/40 border border-border">
                <Icon name="UsersIcon" size={12} />
                {agents.length} agents
              </span>
            </div>
          </div>

          {/* Agent roster */}
          <div className="flex items-center gap-2 flex-wrap">
            {agents.map((agent, i) => (
              <div
                key={agent.id || agent.agent_key}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium"
                style={{
                  backgroundColor: `${AGENT_COLORS[i % AGENT_COLORS.length]}15`,
                  borderColor: `${AGENT_COLORS[i % AGENT_COLORS.length]}30`,
                  color: AGENT_COLORS[i % AGENT_COLORS.length],
                }}
              >
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: `${AGENT_COLORS[i % AGENT_COLORS.length]}30` }}
                >
                  {agent.name?.charAt(0)}
                </div>
                {agent.name}
                <span className="opacity-60">· {agent.model}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {[
            { id: 'transcript', label: 'Transcript', icon: 'ChatBubbleLeftRightIcon' },
            { id: 'artifacts', label: `Artifacts (${artifacts.length})`, icon: 'DocumentDuplicateIcon' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150 ${
                activeTab === tab.id
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon as any} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Transcript */}
        {activeTab === 'transcript' && (
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No messages in this session.</div>
            ) : (
              messages.map((msg) => {
                const color = getAgentColor(msg.agent_id, agents);
                return (
                  <div key={msg.id} className="flex gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      {msg.agent_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold" style={{ color }}>{msg.agent_name}</span>
                        <span className="text-xs text-muted-foreground/60">{msg.agent_role}</span>
                      </div>
                      {msg.message_type === 'code' ? (
                        <pre className="text-xs bg-muted/50 border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono">
                          {msg.content}
                        </pre>
                      ) : (
                        <p className="text-sm text-foreground leading-relaxed">{msg.content}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Artifacts */}
        {activeTab === 'artifacts' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {artifacts.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">No artifacts in this session.</div>
            ) : (
              artifacts.map((artifact) => (
                <div key={artifact.id} className="card-base p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{artifact.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{artifact.artifact_type} · by {artifact.created_by}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(artifact.content);
                        toast.success('Copied to clipboard');
                      }}
                      className="btn-ghost p-1.5"
                      title="Copy content"
                    >
                      <Icon name="ClipboardDocumentIcon" size={14} />
                    </button>
                  </div>
                  <pre className="text-xs bg-muted/40 border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-48">
                    {artifact.content}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {/* CTA */}
        <div className="card-base p-6 text-center bg-gradient-to-br from-primary/5 to-accent/5">
          <h3 className="text-base font-semibold text-foreground mb-2">Want to run your own AI collaborations?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            AICollab lets you orchestrate multiple AI agents to brainstorm, code, and build together.
          </p>
          <Link href="/sign-up-login" className="btn-primary text-sm gap-2">
            <Icon name="RocketLaunchIcon" size={15} />
            Get Started Free
          </Link>
        </div>
      </div>
    </div>
  );
}
