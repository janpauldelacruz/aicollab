'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  is_active: boolean;
  last_fired_at: string | null;
  last_status: number | null;
  fire_count: number;
  created_at: string;
}

const ALL_EVENTS = [
  { id: 'on_start', label: 'Session Start', desc: 'Fired when a session begins running', icon: 'PlayIcon' },
  { id: 'on_complete', label: 'Session Complete', desc: 'Fired when a session finishes successfully', icon: 'CheckCircleIcon' },
  { id: 'on_error', label: 'Session Error', desc: 'Fired when a session encounters an error', icon: 'ExclamationCircleIcon' },
];

function EventBadge({ event }: { event: string }) {
  const colors: Record<string, string> = {
    on_start: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    on_complete: 'bg-green-500/10 text-green-400 border-green-500/20',
    on_error: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const labels: Record<string, string> = { on_start: 'start', on_complete: 'complete', on_error: 'error' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[event] || 'bg-muted/40 text-muted-foreground border-border'}`}>
      {labels[event] || event}
    </span>
  );
}

export default function WebhooksClient() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    url: '',
    secret: '',
    events: ['on_start', 'on_complete', 'on_error'] as string[],
  });

  const fetchWebhooks = useCallback(async () => {
    const res = await fetch('/api/webhooks');
    if (res.ok) {
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) fetchWebhooks();
    else setLoading(false);
  }, [user, fetchWebhooks]);

  const resetForm = () => {
    setForm({ name: '', url: '', secret: '', events: ['on_start', 'on_complete', 'on_error'] });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.url.trim()) { toast.error('Webhook URL is required'); return; }
    try { new URL(form.url); } catch { toast.error('Enter a valid URL'); return; }
    if (form.events.length === 0) { toast.error('Select at least one event'); return; }

    setSaving(true);
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const body = editingId
        ? { id: editingId, name: form.name, url: form.url, secret: form.secret || null, events: form.events }
        : { name: form.name, url: form.url, secret: form.secret || null, events: form.events };

      const res = await fetch('/api/webhooks', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success(editingId ? 'Webhook updated' : 'Webhook created');
      resetForm();
      fetchWebhooks();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (wh: Webhook) => {
    const res = await fetch('/api/webhooks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: wh.id, is_active: !wh.is_active }),
    });
    if (res.ok) {
      setWebhooks((prev) => prev.map((w) => w.id === wh.id ? { ...w, is_active: !w.is_active } : w));
      toast.success(wh.is_active ? 'Webhook paused' : 'Webhook activated');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/webhooks?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success('Webhook deleted');
    }
  };

  const handleEdit = (wh: Webhook) => {
    setForm({ name: wh.name, url: wh.url, secret: '', events: wh.events });
    setEditingId(wh.id);
    setShowForm(true);
  };

  const handleTest = async (wh: Webhook) => {
    setTestingId(wh.id);
    try {
      const res = await fetch('/api/webhooks/fire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'on_start', session_id: 'test', payload: { session_name: 'Test Session', session_topic: 'Webhook test ping' } }),
      });
      if (res.ok) toast.success('Test ping sent to webhook');
      else toast.error('Test ping failed — check your endpoint');
    } catch {
      toast.error('Could not reach webhook URL');
    } finally {
      setTestingId(null);
    }
  };

  const toggleEvent = (ev: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Icon name="LockClosedIcon" size={32} className="text-muted-foreground mb-4" />
        <h3 className="text-base font-semibold text-foreground mb-2">Sign in required</h3>
        <Link href="/sign-up-login" className="btn-primary text-sm">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Webhooks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Receive real-time HTTP callbacks when session lifecycle events occur.
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm gap-2">
          <Icon name="PlusIcon" size={15} />
          Add Webhook
        </button>
      </div>

      {/* Event reference */}
      <div className="card-base p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Icon name="BoltIcon" size={15} className="text-accent" />
          Available Events
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ALL_EVENTS.map((ev) => (
            <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Icon name={ev.icon as any} size={15} className="text-accent" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{ev.label}</p>
                <p className="text-xs text-muted-foreground">{ev.desc}</p>
                <code className="text-xs text-primary mt-1 block">{ev.id}</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payload example */}
      <details className="card-base p-4 group">
        <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-foreground select-none">
          <Icon name="CodeBracketIcon" size={15} className="text-muted-foreground" />
          Example Payload
          <Icon name="ChevronDownIcon" size={13} className="text-muted-foreground ml-auto group-open:rotate-180 transition-transform" />
        </summary>
        <pre className="mt-3 text-xs bg-muted/40 border border-border rounded-lg p-3 overflow-x-auto font-mono text-muted-foreground">{`{
  "event": "on_complete",
  "session_id": "uuid",
  "session_name": "Product Brainstorm",
  "session_topic": "New feature ideas",
  "session_status": "completed",
  "turn_count": 12,
  "message_count": 48,
  "artifact_count": 3,
  "elapsed_seconds": 142,
  "completion_pct": 100,
  "timestamp": "2026-09-24T05:00:00.000Z"
}`}</pre>
        <p className="text-xs text-muted-foreground mt-2">
          When a <code className="text-foreground">secret</code> is set, each request includes an{' '}
          <code className="text-foreground">X-AICollab-Signature: sha256=…</code> header for verification.
        </p>
      </details>

      {/* Create / Edit form */}
      {showForm && (
        <div className="card-base p-5 space-y-4 border-primary/30">
          <h2 className="text-sm font-semibold text-foreground">
            {editingId ? 'Edit Webhook' : 'New Webhook'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="My Webhook"
                className="input-base text-sm w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Endpoint URL <span className="text-destructive">*</span></label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://your-server.com/webhook"
                className="input-base text-sm w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Secret (optional) — used to sign payloads with HMAC-SHA256
            </label>
            <input
              type="password"
              value={form.secret}
              onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
              placeholder="Leave blank to skip signing"
              className="input-base text-sm w-full"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Events to subscribe</label>
            <div className="flex flex-wrap gap-3">
              {ALL_EVENTS.map((ev) => (
                <label key={ev.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.events.includes(ev.id)}
                    onChange={() => toggleEvent(ev.id)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">{ev.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm gap-2">
              {saving ? <><Icon name="ArrowPathIcon" size={14} className="animate-spin" />Saving…</> : <><Icon name="CheckIcon" size={14} />{editingId ? 'Update' : 'Create'} Webhook</>}
            </button>
            <button onClick={resetForm} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Webhook list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Your Webhooks
          {webhooks.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">({webhooks.length})</span>}
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="card-base p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <div className="card-base p-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
              <Icon name="BoltIcon" size={22} className="text-accent" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No webhooks yet</p>
            <p className="text-xs text-muted-foreground mb-4">Add a webhook to receive automatic callbacks when sessions start, complete, or error.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm gap-2">
              <Icon name="PlusIcon" size={14} />Add Your First Webhook
            </button>
          </div>
        ) : (
          webhooks.map((wh) => (
            <div key={wh.id} className={`card-base p-4 transition-opacity ${!wh.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-foreground">{wh.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${wh.is_active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-muted/40 text-muted-foreground border-border'}`}>
                      {wh.is_active ? 'Active' : 'Paused'}
                    </span>
                    {wh.last_status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${wh.last_status >= 200 && wh.last_status < 300 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {wh.last_status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">{wh.url}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleTest(wh)} disabled={testingId === wh.id} className="btn-ghost p-1.5 text-xs" title="Send test ping">
                    {testingId === wh.id ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="PaperAirplaneIcon" size={14} />}
                  </button>
                  <button onClick={() => handleEdit(wh)} className="btn-ghost p-1.5" title="Edit">
                    <Icon name="PencilIcon" size={14} />
                  </button>
                  <button onClick={() => handleToggle(wh)} className="btn-ghost p-1.5" title={wh.is_active ? 'Pause' : 'Activate'}>
                    <Icon name={wh.is_active ? 'PauseIcon' : 'PlayIcon'} size={14} />
                  </button>
                  <button onClick={() => handleDelete(wh.id)} className="btn-ghost p-1.5 text-muted-foreground hover:text-destructive" title="Delete">
                    <Icon name="TrashIcon" size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                {wh.events.map((ev) => <EventBadge key={ev} event={ev} />)}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Icon name="BoltIcon" size={11} />
                  {wh.fire_count} deliveries
                </span>
                {wh.last_fired_at && (
                  <span className="flex items-center gap-1">
                    <Icon name="ClockIcon" size={11} />
                    Last fired {new Date(wh.last_fired_at).toLocaleDateString()}
                  </span>
                )}
                {wh.secret && (
                  <span className="flex items-center gap-1 text-accent">
                    <Icon name="LockClosedIcon" size={11} />
                    Signed
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
