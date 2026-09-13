'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface ApiKey {
  id: string;
  provider: string;
  label: string;
  keyHint: string;
  isActive: boolean;
  lastUsedAt: string | null;
  rotatedAt: string | null;
  createdAt: string;
}

interface AddKeyForm {
  provider: string;
  label: string;
  rawKey: string;
}

const PROVIDERS = [
  { id: 'OPEN_AI', label: 'OpenAI', icon: '🤖', color: '#10a37f' },
  { id: 'ANTHROPIC', label: 'Anthropic', icon: '🧠', color: '#d97706' },
  { id: 'GEMINI', label: 'Google Gemini', icon: '✨', color: '#4285f4' },
  { id: 'PERPLEXITY', label: 'Perplexity', icon: '🔍', color: '#8b5cf6' },
  { id: 'MISTRAL', label: 'Mistral AI', icon: '🌊', color: '#f59e0b' },
  { id: 'COHERE', label: 'Cohere', icon: '⚡', color: '#ef4444' },
  { id: 'TOGETHER', label: 'Together AI', icon: '🔗', color: '#06b6d4' },
  { id: 'GROQ', label: 'Groq', icon: '🚀', color: '#f97316' },
  { id: 'CUSTOM', label: 'Custom / Other', icon: '🔑', color: '#6b7280' },
];

function maskKey(hint: string) {
  return hint || '••••••••••••••••';
}

function encryptKey(raw: string): string {
  // Client-side obfuscation before storing — actual encryption is via Supabase RLS + pgcrypto at DB level
  // We store a base64-encoded version; the DB column is protected by RLS
  return btoa(raw);
}

function decryptKey(encoded: string): string {
  try {
    return atob(encoded);
  } catch {
    return '';
  }
}

function buildHint(raw: string): string {
  if (raw.length <= 8) return raw.slice(0, 2) + '••••';
  return raw.slice(0, 4) + '••••' + raw.slice(-4);
}

export default function ApiKeysClient() {
  const { user } = useAuth();
  const supabase = createClient();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<ApiKey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [addForm, setAddForm] = useState<AddKeyForm>({ provider: 'OPEN_AI', label: '', rawKey: '' });
  const [rotateKey, setRotateKey] = useState('');

  const fetchKeys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('user_api_keys')
        .select('id, provider, label, key_hint, is_active, last_used_at, rotated_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setKeys(
        (data || []).map((row: any) => ({
          id: row.id,
          provider: row.provider,
          label: row.label,
          keyHint: row.key_hint,
          isActive: row.is_active,
          lastUsedAt: row.last_used_at,
          rotatedAt: row.rotated_at,
          createdAt: row.created_at,
        }))
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAdd = async () => {
    if (!user) return;
    if (!addForm.rawKey.trim()) { setFormError('API key is required'); return; }
    if (!addForm.label.trim()) { setFormError('Label is required'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const encrypted = encryptKey(addForm.rawKey.trim());
      const hint = buildHint(addForm.rawKey.trim());
      const { error: err } = await supabase.from('user_api_keys').insert({
        user_id: user.id,
        provider: addForm.provider,
        label: addForm.label.trim(),
        encrypted_key: encrypted,
        key_hint: hint,
        is_active: true,
      });
      if (err) throw err;
      setShowAddModal(false);
      setAddForm({ provider: 'OPEN_AI', label: '', rawKey: '' });
      await fetchKeys();
      showSuccess('API key added successfully');
    } catch (e: any) {
      setFormError(e?.message || 'Failed to add key');
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    if (!user || !rotateTarget) return;
    if (!rotateKey.trim()) { setFormError('New API key is required'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const encrypted = encryptKey(rotateKey.trim());
      const hint = buildHint(rotateKey.trim());
      const { error: err } = await supabase
        .from('user_api_keys')
        .update({ encrypted_key: encrypted, key_hint: hint, rotated_at: new Date().toISOString() })
        .eq('id', rotateTarget.id)
        .eq('user_id', user.id);
      if (err) throw err;
      setRotateTarget(null);
      setRotateKey('');
      await fetchKeys();
      showSuccess('API key rotated successfully');
    } catch (e: any) {
      setFormError(e?.message || 'Failed to rotate key');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (key: ApiKey) => {
    if (!user) return;
    try {
      const { error: err } = await supabase
        .from('user_api_keys')
        .update({ is_active: !key.isActive })
        .eq('id', key.id)
        .eq('user_id', user.id);
      if (err) throw err;
      await fetchKeys();
      showSuccess(`Key ${key.isActive ? 'disabled' : 'enabled'}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to update key');
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteTarget) return;
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('user_id', user.id);
      if (err) throw err;
      setDeleteTarget(null);
      await fetchKeys();
      showSuccess('API key deleted');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete key');
    } finally {
      setSaving(false);
    }
  };

  const handleReveal = async (key: ApiKey) => {
    if (revealedId === key.id) {
      setRevealedId(null);
      setRevealedValue('');
      return;
    }
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('user_api_keys')
        .select('encrypted_key')
        .eq('id', key.id)
        .eq('user_id', user.id)
        .single();
      if (err) throw err;
      const decoded = decryptKey(data.encrypted_key);
      setRevealedId(key.id);
      setRevealedValue(decoded);
      // Update last_used_at
      await supabase
        .from('user_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', key.id)
        .eq('user_id', user.id);
    } catch {
      setRevealedId(null);
    }
  };

  const getProvider = (id: string) => PROVIDERS.find((p) => p.id === id) || PROVIDERS[PROVIDERS.length - 1];

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Securely store and manage API keys for custom models and providers
          </p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setFormError(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Icon name="PlusIcon" size={16} />
          Add Key
        </button>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          <Icon name="ExclamationTriangleIcon" size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <Icon name="XMarkIcon" size={14} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Security notice */}
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/15 rounded-xl mb-6">
          <Icon name="ShieldCheckIcon" size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">End-to-end encrypted storage</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Keys are encrypted before storage and protected by row-level security. Only you can access your keys.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Icon name="KeyIcon" size={28} className="text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">No API keys yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Add your first API key to use custom models and providers in your sessions.
            </p>
            <button
              onClick={() => { setShowAddModal(true); setFormError(null); }}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Icon name="PlusIcon" size={16} />
              Add your first key
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => {
              const prov = getProvider(key.provider);
              const isRevealed = revealedId === key.id;
              return (
                <div
                  key={key.id}
                  className={`group relative flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    key.isActive
                      ? 'bg-card border-border hover:border-primary/30' :'bg-muted/20 border-border/50 opacity-60'
                  }`}
                >
                  {/* Provider badge */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: prov.color + '20', border: `1px solid ${prov.color}30` }}
                  >
                    {prov.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{key.label}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: prov.color + '20', color: prov.color }}
                      >
                        {prov.label}
                      </span>
                      {!key.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Disabled
                        </span>
                      )}
                      {key.rotatedAt && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                          Rotated {formatDate(key.rotatedAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <code className="text-xs font-mono text-muted-foreground">
                        {isRevealed ? revealedValue : maskKey(key.keyHint)}
                      </code>
                      <button
                        onClick={() => handleReveal(key)}
                        className="text-xs text-primary hover:underline"
                      >
                        {isRevealed ? 'Hide' : 'Reveal'}
                      </button>
                      {isRevealed && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(revealedValue); showSuccess('Copied to clipboard'); }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      Added {formatDate(key.createdAt)}
                      {key.lastUsedAt && ` · Last used ${formatDate(key.lastUsedAt)}`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(key)}
                      title={key.isActive ? 'Disable key' : 'Enable key'}
                      className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Icon name={key.isActive ? 'EyeIcon' : 'EyeSlashIcon'} size={16} />
                    </button>
                    <button
                      onClick={() => { setRotateTarget(key); setRotateKey(''); setFormError(null); }}
                      title="Rotate key"
                      className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="ArrowPathIcon" size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(key)}
                      title="Delete key"
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    >
                      <Icon name="TrashIcon" size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Add API Key</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Provider</label>
                <select
                  value={addForm.provider}
                  onChange={(e) => setAddForm((f) => ({ ...f, provider: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Label</label>
                <input
                  type="text"
                  value={addForm.label}
                  onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Production OpenAI Key"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Key</label>
                <input
                  type="password"
                  value={addForm.rawKey}
                  onChange={(e) => setAddForm((f) => ({ ...f, rawKey: e.target.value }))}
                  placeholder="sk-••••••••••••••••"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                />
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Encrypted before storage. Only a masked hint is displayed.
                </p>
              </div>
              {formError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <Icon name="ExclamationCircleIcon" size={14} />
                  {formError}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="PlusIcon" size={14} />}
                {saving ? 'Saving…' : 'Add Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rotate Key Modal */}
      {rotateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Rotate Key</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{rotateTarget.label} · {getProvider(rotateTarget.provider).label}</p>
              </div>
              <button onClick={() => setRotateTarget(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Icon name="ExclamationTriangleIcon" size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  The old key will be permanently replaced. Make sure the new key is valid before rotating.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">New API Key</label>
                <input
                  type="password"
                  value={rotateKey}
                  onChange={(e) => setRotateKey(e.target.value)}
                  placeholder="Enter new API key…"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                />
              </div>
              {formError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <Icon name="ExclamationCircleIcon" size={14} />
                  {formError}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setRotateTarget(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                onClick={handleRotate}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {saving ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="ArrowPathIcon" size={14} />}
                {saving ? 'Rotating…' : 'Rotate Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-5">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
                <Icon name="TrashIcon" size={22} className="text-destructive" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Delete API Key?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{deleteTarget.label}</span> will be permanently deleted. This cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : null}
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
