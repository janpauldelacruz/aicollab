'use client';
import React, { useState, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface PlaybookAgent {
  id: string;
  name: string;
  role: string;
  model: string;
  provider: string;
  systemPrompt: string;
  color: string;
  creativity: number;
  verbosity: number;
  assertiveness: number;
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  orchestration_mode: string;
  topic: string;
  goal: string;
  directives: string;
  agents: PlaybookAgent[];
  tags: string[];
  use_count: number;
  is_pinned: boolean;
  source_session_id: string | null;
  created_at: string;
  updated_at: string;
}

const MODE_COLORS: Record<string, string> = {
  brainstorm: '#f59e0b',
  code: '#06b6d4',
  build: '#a78bfa',
  chat: '#22c55e',
};

const AGENT_COLORS = ['#a78bfa', '#34d399', '#60a5fa', '#f59e0b', '#f472b6', '#fb7185'];

export default function PlaybooksClient() {
  const { user } = useAuth();
  const supabase = createClient();

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');

  const [form, setForm] = useState({
    name: '',
    description: '',
    orchestration_mode: 'build',
    topic: '',
    goal: '',
    directives: '',
    tags: '',
    agents: [] as PlaybookAgent[],
  });

  const loadPlaybooks = useCallback(async () => {
    if (!isSupabaseConfigured || !user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('playbooks')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      if (!error && data) setPlaybooks(data);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { loadPlaybooks(); }, [loadPlaybooks]);

  const openCreate = () => {
    setForm({
      name: '',
      description: '',
      orchestration_mode: 'build',
      topic: '',
      goal: '',
      directives: '',
      tags: '',
      agents: [
        { id: 'a1', name: 'Agent 1', role: 'researcher', model: 'gpt-4o', provider: 'OPEN_AI', systemPrompt: 'You are a helpful AI assistant.', color: AGENT_COLORS[0], creativity: 0.7, verbosity: 0.5, assertiveness: 0.5 },
      ],
    });
    setEditingPlaybook(null);
    setCreateModalOpen(true);
  };

  const openEdit = (pb: Playbook) => {
    setForm({
      name: pb.name,
      description: pb.description,
      orchestration_mode: pb.orchestration_mode,
      topic: pb.topic,
      goal: pb.goal,
      directives: pb.directives,
      tags: pb.tags.join(', '),
      agents: pb.agents,
    });
    setEditingPlaybook(pb);
    setCreateModalOpen(true);
  };

  const savePlaybook = async () => {
    if (!isSupabaseConfigured || !user || !form.name.trim()) return;
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      description: form.description.trim(),
      orchestration_mode: form.orchestration_mode,
      topic: form.topic.trim(),
      goal: form.goal.trim(),
      directives: form.directives.trim(),
      agents: form.agents,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };

    try {
      if (editingPlaybook) {
        const { data, error } = await supabase
          .from('playbooks')
          .update(payload)
          .eq('id', editingPlaybook.id)
          .select()
          .single();
        if (!error && data) {
          setPlaybooks((prev) => prev.map((p) => (p.id === data.id ? data : p)));
          toast.success('Playbook updated');
        }
      } else {
        const { data, error } = await supabase
          .from('playbooks')
          .insert(payload)
          .select()
          .single();
        if (!error && data) {
          setPlaybooks((prev) => [data, ...prev]);
          toast.success('Playbook saved');
        }
      }
      setCreateModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save playbook');
    }
  };

  const deletePlaybook = async (id: string) => {
    if (!isSupabaseConfigured || !user) return;
    await supabase.from('playbooks').delete().eq('id', id);
    setPlaybooks((prev) => prev.filter((p) => p.id !== id));
    toast.success('Playbook deleted');
  };

  const togglePin = async (pb: Playbook) => {
    const { data } = await supabase
      .from('playbooks')
      .update({ is_pinned: !pb.is_pinned })
      .eq('id', pb.id)
      .select()
      .single();
    if (data) setPlaybooks((prev) => prev.map((p) => (p.id === data.id ? data : p)));
  };

  const launchPlaybook = async (pb: Playbook) => {
    await supabase.from('playbooks').update({ use_count: pb.use_count + 1 }).eq('id', pb.id);
    // Build session-setup URL with playbook params
    const params = new URLSearchParams({
      playbook: pb.id,
      mode: pb.orchestration_mode,
      topic: pb.topic,
      goal: pb.goal,
    });
    window.location.href = `/session-setup?${params.toString()}`;
  };

  const addAgent = () => {
    const idx = form.agents.length;
    setForm((f) => ({
      ...f,
      agents: [
        ...f.agents,
        {
          id: `a${Date.now()}`,
          name: `Agent ${idx + 1}`,
          role: 'researcher',
          model: 'gpt-4o',
          provider: 'OPEN_AI',
          systemPrompt: 'You are a helpful AI assistant.',
          color: AGENT_COLORS[idx % AGENT_COLORS.length],
          creativity: 0.7,
          verbosity: 0.5,
          assertiveness: 0.5,
        },
      ],
    }));
  };

  const updateAgent = (id: string, patch: Partial<PlaybookAgent>) => {
    setForm((f) => ({
      ...f,
      agents: f.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const removeAgent = (id: string) => {
    setForm((f) => ({ ...f, agents: f.agents.filter((a) => a.id !== id) }));
  };

  const filtered = playbooks.filter((pb) => {
    const matchSearch =
      !searchQuery ||
      pb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pb.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pb.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchMode = filterMode === 'all' || pb.orchestration_mode === filterMode;
    return matchSearch && matchMode;
  });

  if (!isSupabaseConfigured || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Icon name="LockClosedIcon" size={40} className="text-muted-foreground/30 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Sign in to manage playbooks</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Icon name="BookOpenIcon" size={22} className="text-primary" />
            Playbooks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Save completed sessions as reusable workflows — launch complex multi-agent setups in one click
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-1.5">
          <Icon name="PlusIcon" size={14} />
          New Playbook
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search playbooks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base pl-8 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'brainstorm', 'code', 'build', 'chat'].map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterMode === mode
                  ? 'bg-primary/15 text-primary border border-primary/30' :'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {mode === 'all' ? 'All' : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-border rounded-xl">
          <Icon name="BookOpenIcon" size={40} className="text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">
            {searchQuery || filterMode !== 'all' ? 'No playbooks match your filters' : 'No playbooks yet'}
          </p>
          {!searchQuery && filterMode === 'all' && (
            <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
              Save agent rosters, orchestration modes, and directives for one-click reuse
            </p>
          )}
          {!searchQuery && filterMode === 'all' && (
            <button onClick={openCreate} className="btn-primary text-sm">
              Create your first playbook
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((pb) => (
            <PlaybookCard
              key={pb.id}
              playbook={pb}
              onLaunch={() => launchPlaybook(pb)}
              onEdit={() => openEdit(pb)}
              onDelete={() => deletePlaybook(pb.id)}
              onTogglePin={() => togglePin(pb)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
              <h3 className="font-semibold text-foreground text-base">
                {editingPlaybook ? 'Edit Playbook' : 'New Playbook'}
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="btn-ghost p-1.5">
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">Playbook Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. SaaS MVP Builder"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="input-base w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="What does this playbook do?"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="input-base w-full resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Orchestration Mode</label>
                  <select
                    value={form.orchestration_mode}
                    onChange={(e) => setForm((f) => ({ ...f, orchestration_mode: e.target.value }))}
                    className="input-base w-full"
                  >
                    {['brainstorm', 'code', 'build', 'chat'].map((m) => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. saas, mvp, backend"
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                    className="input-base w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">Topic Preset</label>
                  <input
                    type="text"
                    placeholder="e.g. Build a SaaS MVP with auth and billing"
                    value={form.topic}
                    onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                    className="input-base w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">Goal</label>
                  <input
                    type="text"
                    placeholder="e.g. Produce a complete architecture document and code scaffold"
                    value={form.goal}
                    onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                    className="input-base w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">Directives</label>
                  <textarea
                    rows={3}
                    placeholder="Special instructions for agents (e.g. Always prioritize security, Use TypeScript, etc.)"
                    value={form.directives}
                    onChange={(e) => setForm((f) => ({ ...f, directives: e.target.value }))}
                    className="input-base w-full resize-none"
                  />
                </div>
              </div>

              {/* Agent roster */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-foreground">Agent Roster ({form.agents.length})</label>
                  <button
                    onClick={addAgent}
                    disabled={form.agents.length >= 6}
                    className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-40"
                  >
                    <Icon name="PlusIcon" size={11} />
                    Add Agent
                  </button>
                </div>
                <div className="space-y-2">
                  {form.agents.map((agent, idx) => (
                    <div key={agent.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/20">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: agent.color }} />
                      <input
                        type="text"
                        value={agent.name}
                        onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                        className="flex-1 bg-transparent text-xs font-medium text-foreground focus:outline-none min-w-0"
                        placeholder="Agent name"
                      />
                      <select
                        value={agent.role}
                        onChange={(e) => updateAgent(agent.id, { role: e.target.value })}
                        className="input-base text-xs py-1 w-28"
                      >
                        {['researcher', 'coder', 'architect', 'pm', 'critic', 'designer'].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <select
                        value={agent.model}
                        onChange={(e) => updateAgent(agent.id, { model: e.target.value })}
                        className="input-base text-xs py-1 w-32"
                      >
                        {['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022', 'gemini/gemini-2.5-flash'].map((m) => (
                          <option key={m} value={m}>{m.split('/').pop()}</option>
                        ))}
                      </select>
                      {form.agents.length > 1 && (
                        <button onClick={() => removeAgent(agent.id)} className="btn-ghost p-1 text-negative">
                          <Icon name="XMarkIcon" size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end p-5 border-t border-border flex-shrink-0">
              <button onClick={() => setCreateModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={savePlaybook}
                disabled={!form.name.trim()}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {editingPlaybook ? 'Save Changes' : 'Create Playbook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Playbook Card ─────────────────────────────────────────────────────────────

function PlaybookCard({
  playbook,
  onLaunch,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  playbook: Playbook;
  onLaunch: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const modeColor = MODE_COLORS[playbook.orchestration_mode] ?? '#a78bfa';

  return (
    <div className="card-base flex flex-col gap-3 group hover:border-primary/30 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${modeColor}18`, border: `1px solid ${modeColor}30` }}>
            <Icon name="BookOpenIcon" size={14} style={{ color: modeColor } as any} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{playbook.name}</p>
            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: `${modeColor}15`, color: modeColor }}>
              {playbook.orchestration_mode}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onTogglePin} className={`btn-ghost p-1 ${playbook.is_pinned ? 'text-warning' : ''}`} title="Pin">
            <Icon name="BookmarkIcon" size={13} />
          </button>
          <button onClick={onEdit} className="btn-ghost p-1" title="Edit">
            <Icon name="PencilIcon" size={13} />
          </button>
          <button onClick={onDelete} className="btn-ghost p-1 text-negative" title="Delete">
            <Icon name="TrashIcon" size={13} />
          </button>
        </div>
      </div>

      {/* Description */}
      {playbook.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{playbook.description}</p>
      )}

      {/* Topic */}
      {playbook.topic && (
        <div className="flex items-start gap-1.5">
          <Icon name="ChatBubbleLeftIcon" size={11} className="text-muted-foreground/60 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground line-clamp-1">{playbook.topic}</p>
        </div>
      )}

      {/* Agent roster preview */}
      {playbook.agents.length > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1.5">
            {playbook.agents.slice(0, 5).map((agent) => (
              <div
                key={agent.id}
                className="w-5 h-5 rounded-full border border-card flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: `${agent.color}30`, color: agent.color }}
                title={`${agent.name} (${agent.role})`}
              >
                {agent.name.charAt(0)}
              </div>
            ))}
            {playbook.agents.length > 5 && (
              <div className="w-5 h-5 rounded-full border border-card bg-muted flex items-center justify-center text-xs text-muted-foreground">
                +{playbook.agents.length - 5}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{playbook.agents.length} agent{playbook.agents.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Tags */}
      {playbook.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {playbook.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
              {tag}
            </span>
          ))}
          {playbook.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{playbook.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border mt-auto">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Icon name="PlayIcon" size={10} />
          {playbook.use_count} run{playbook.use_count !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onLaunch}
          className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
        >
          <Icon name="RocketLaunchIcon" size={12} />
          Launch
        </button>
      </div>
    </div>
  );
}
