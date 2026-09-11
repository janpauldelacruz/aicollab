'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import {
  createShareLink,
  getShareLinksForSession,
  deleteShareLink,
  getSessionById,
} from '@/lib/supabase/sessionService';
import type { DBShareLink, DBSession } from '@/lib/supabase/sessionService';

interface ShareSessionClientProps {
  sessionId: string | null;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aicollab6986.builtwithrocket.new';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className={`btn-secondary text-xs gap-1.5 px-3 transition-all ${copied ? 'text-positive border-positive/30' : ''}`}
    >
      <Icon name={copied ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={13} />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function ShareSessionClient({ sessionId }: ShareSessionClientProps) {
  const { user } = useAuth();
  const [session, setSession] = useState<DBSession | null>(null);
  const [links, setLinks] = useState<DBShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [allowRerun, setAllowRerun] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');

  useEffect(() => {
    if (!sessionId || !user) {
      setLoading(false);
      return;
    }
    Promise.all([
      getSessionById(sessionId),
      getShareLinksForSession(sessionId),
    ]).then(([sess, lnks]) => {
      setSession(sess);
      setLinks(lnks);
      setLoading(false);
    });
  }, [sessionId, user]);

  const handleCreate = async () => {
    if (!sessionId || !user) return;
    setCreating(true);
    try {
      const link = await createShareLink(sessionId, user.id, {
        label: label.trim() || 'Shared Link',
        allowRerun,
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      });
      if (link) {
        setLinks((prev) => [link, ...prev]);
        setLabel('');
        toast.success('Share link created!');
      } else {
        toast.error('Failed to create share link');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (linkId: string) => {
    await deleteShareLink(linkId);
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    toast.success('Share link deleted');
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Icon name="LockClosedIcon" size={32} className="text-muted-foreground mb-4" />
        <h3 className="text-base font-semibold text-foreground mb-2">Sign in required</h3>
        <p className="text-sm text-muted-foreground mb-4">You need to be signed in to manage share links.</p>
        <Link href="/sign-up-login" className="btn-primary text-sm">Sign In</Link>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Icon name="ExclamationTriangleIcon" size={32} className="text-warning mb-4" />
        <h3 className="text-base font-semibold text-foreground mb-2">No session selected</h3>
        <p className="text-sm text-muted-foreground mb-4">Go to Past Collaborations and click Share on a session.</p>
        <Link href="/past-collaborations" className="btn-primary text-sm">Past Collaborations</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/past-collaborations" className="btn-ghost p-2 mt-0.5">
          <Icon name="ArrowLeftIcon" size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Share Session</h1>
          {session && (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{session.name}</span>
              {' · '}{session.topic}
            </p>
          )}
        </div>
      </div>

      {/* What gets shared */}
      <div className="card-base p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Icon name="InformationCircleIcon" size={16} className="text-accent" />
          What recipients can access
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: 'ChatBubbleLeftRightIcon', label: 'Full Transcript', desc: 'All agent messages in order' },
            { icon: 'DocumentDuplicateIcon', label: 'Artifacts', desc: 'Code, docs, and decisions' },
            { icon: 'ArrowPathIcon', label: 'Re-run Option', desc: 'Launch with same agent roster' },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Icon name={item.icon as any} size={16} className="text-accent" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create new link */}
      <div className="card-base p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Create New Share Link</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Link Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. For team review, Client preview…"
              className="input-base text-sm w-full"
            />
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowRerun}
                onChange={(e) => setAllowRerun(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-foreground">Allow re-run with original agents</span>
            </label>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Expires in (days, optional)</label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : '')}
              placeholder="Never expires"
              min={1}
              max={365}
              className="input-base text-sm w-40"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="btn-primary text-sm gap-2"
        >
          {creating ? (
            <><Icon name="ArrowPathIcon" size={15} className="animate-spin" />Creating…</>
          ) : (
            <><Icon name="LinkIcon" size={15} />Generate Share Link</>
          )}
        </button>
      </div>

      {/* Existing links */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Active Links
          {links.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">({links.length})</span>
          )}
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="card-base p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="card-base p-8 text-center">
            <Icon name="LinkIcon" size={28} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No share links yet. Create one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => {
              const shareUrl = `${SITE_URL}/shared/${link.token}`;
              const isExpired = link.expires_at ? new Date(link.expires_at) < new Date() : false;
              return (
                <div key={link.id} className={`card-base p-4 ${isExpired ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-foreground">{link.label}</span>
                        {isExpired && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Expired</span>
                        )}
                        {link.allow_rerun && !isExpired && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">Re-run enabled</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">{shareUrl}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(link.id)}
                      className="btn-ghost p-1.5 text-muted-foreground hover:text-destructive flex-shrink-0"
                      title="Delete link"
                    >
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Icon name="CalendarIcon" size={11} />
                      Created {formatDate(link.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="EyeIcon" size={11} />
                      {link.access_count} view{link.access_count !== 1 ? 's' : ''}
                    </span>
                    {link.expires_at && (
                      <span className="flex items-center gap-1">
                        <Icon name="ClockIcon" size={11} />
                        {isExpired ? 'Expired' : `Expires ${formatDate(link.expires_at)}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyButton text={shareUrl} />
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost text-xs gap-1.5 px-3"
                    >
                      <Icon name="ArrowTopRightOnSquareIcon" size={13} />
                      Open
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
