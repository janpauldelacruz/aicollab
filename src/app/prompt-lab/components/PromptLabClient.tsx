'use client';
import React, { useState, useCallback, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { runParallelPromptTests, AVAILABLE_MODELS, type PromptTestAgent, type PromptTestResult, type PromptRunSummary,  } from '@/lib/ai/promptLabRunner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedPrompt {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  personality: string;
  model: string;
  provider: string;
  temperature: number;
  max_tokens: number;
  tags: string[];
  is_pinned: boolean;
  usage_count: number;
  created_at: string;
}

interface TestRunAgent {
  id: string;
  name: string;
  model: string;
  provider: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  color: string;
}

const AGENT_COLORS = ['#a78bfa', '#34d399', '#60a5fa', '#f59e0b', '#f472b6', '#fb7185'];

function newAgent(index: number): TestRunAgent {
  const model = AVAILABLE_MODELS[0];
  return {
    id: `agent-${Date.now()}-${index}`,
    name: `Agent ${index + 1}`,
    model: model.value,
    provider: model.provider,
    systemPrompt: 'You are a helpful AI assistant. Answer concisely and clearly.',
    temperature: 0.7,
    maxTokens: 300,
    color: AGENT_COLORS[index % AGENT_COLORS.length],
  };
}

// ─── Cost formatter ───────────────────────────────────────────────────────────

function formatCost(usd: number): string {
  if (usd < 0.0001) return '<$0.0001';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PromptLabClient() {
  const { user } = useAuth();
  const supabase = createClient();

  // Saved prompts
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [promptsLoaded, setPromptsLoaded] = useState(false);
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'lab' | 'saved' | 'history'>('lab');

  // Test agents
  const [agents, setAgents] = useState<TestRunAgent[]>([newAgent(0), newAgent(1)]);

  // Test input
  const [testInput, setTestInput] = useState('');
  const [runName, setRunName] = useState('');

  // Run state
  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<PromptTestResult[]>([]);
  const [runSummary, setRunSummary] = useState<PromptRunSummary | null>(null);
  const [liveResults, setLiveResults] = useState<Record<string, PromptTestResult>>({});

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Save prompt modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: '', description: '', tags: '' });
  const [saving, setSaving] = useState(false);

  // Selected prompt for editing
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

  // ─── Load saved prompts ──────────────────────────────────────────────────────

  const loadSavedPrompts = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    setLoadingPrompts(true);
    try {
      const { data, error } = await supabase
        .from('saved_prompts')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      if (!error && data) setSavedPrompts(data);
    } finally {
      setLoadingPrompts(false);
      setPromptsLoaded(true);
    }
  }, [user, supabase]);

  const loadHistory = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    try {
      const { data, error } = await supabase
        .from('prompt_test_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) setHistory(data);
    } finally {
      setHistoryLoaded(true);
    }
  }, [user, supabase]);

  const handleTabChange = (tab: 'lab' | 'saved' | 'history') => {
    setActiveTab(tab);
    if (tab === 'saved' && !promptsLoaded) loadSavedPrompts();
    if (tab === 'history' && !historyLoaded) loadHistory();
  };

  // ─── Agent management ────────────────────────────────────────────────────────

  const addAgent = () => {
    if (agents.length >= 6) return;
    setAgents((prev) => [...prev, newAgent(prev.length)]);
  };

  const removeAgent = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  };

  const updateAgent = (id: string, patch: Partial<TestRunAgent>) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const updated = { ...a, ...patch };
        // Auto-set provider when model changes
        if (patch.model) {
          const modelOpt = AVAILABLE_MODELS.find((m) => m.value === patch.model);
          if (modelOpt) updated.provider = modelOpt.provider;
        }
        return updated;
      })
    );
  };

  // ─── Run tests ───────────────────────────────────────────────────────────────

  const runTests = async () => {
    if (!testInput.trim() || agents.length === 0 || isRunning) return;
    setIsRunning(true);
    setRunResults([]);
    setRunSummary(null);
    setLiveResults({});

    const testAgents: PromptTestAgent[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      model: a.model,
      provider: a.provider,
      systemPrompt: a.systemPrompt,
      temperature: a.temperature,
      maxTokens: a.maxTokens,
    }));

    try {
      const summary = await runParallelPromptTests(testAgents, testInput, (result) => {
        setLiveResults((prev) => ({ ...prev, [result.agentId]: result }));
      });

      setRunResults(summary.results);
      setRunSummary(summary);

      // Persist to Supabase
      if (isSupabaseConfigured && user) {
        await supabase.from('prompt_test_runs').insert({
          user_id: user.id,
          run_name: runName.trim() || `Run ${new Date().toLocaleTimeString()}`,
          test_input: testInput,
          agents: testAgents,
          results: summary.results,
          run_status: 'completed',
          total_tokens: summary.totalTokens,
          prompt_tokens: summary.totalPromptTokens,
          completion_tokens: summary.totalCompletionTokens,
          estimated_cost: summary.totalCost,
          duration_ms: summary.durationMs,
          started_at: new Date(Date.now() - summary.durationMs).toISOString(),
          completed_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Run failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  // ─── Save prompt ─────────────────────────────────────────────────────────────

  const savePrompt = async () => {
    if (!isSupabaseConfigured || !user || !saveForm.name.trim()) return;
    const agent = agents[0];
    setSaving(true);
    try {
      const { data, error } = await supabase.from('saved_prompts').insert({
        user_id: user.id,
        name: saveForm.name.trim(),
        description: saveForm.description.trim(),
        system_prompt: agent.systemPrompt,
        personality: '',
        model: agent.model,
        provider: agent.provider,
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
        tags: saveForm.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      }).select().single();
      if (!error && data) {
        setSavedPrompts((prev) => [data, ...prev]);
        setSaveModalOpen(false);
        setSaveForm({ name: '', description: '', tags: '' });
      }
    } finally {
      setSaving(false);
    }
  };

  const deletePrompt = async (id: string) => {
    if (!isSupabaseConfigured || !user) return;
    await supabase.from('saved_prompts').delete().eq('id', id);
    setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
  };

  const loadPromptIntoAgent = (prompt: SavedPrompt, agentId: string) => {
    updateAgent(agentId, {
      systemPrompt: prompt.system_prompt,
      model: prompt.model,
      provider: prompt.provider,
      temperature: prompt.temperature,
      maxTokens: prompt.max_tokens,
    });
    setActiveTab('lab');
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Icon name="BeakerIcon" size={22} className="text-primary" />
            Prompt Lab
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Save, compare, and test agent prompts across parallel runs — with token and cost tracking
          </p>
        </div>
        <div className="flex gap-2">
          {isSupabaseConfigured && user && (
            <button
              onClick={() => setSaveModalOpen(true)}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <Icon name="BookmarkIcon" size={14} />
              Save Prompt
            </button>
          )}
          <button
            onClick={runTests}
            disabled={isRunning || !testInput.trim() || agents.length === 0}
            className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Icon name="PlayIcon" size={14} />
                Run Tests
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['lab', 'saved', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'lab' ? 'Lab' : tab === 'saved' ? 'Saved Prompts' : 'Run History'}
          </button>
        ))}
      </div>

      {/* ── LAB TAB ── */}
      {activeTab === 'lab' && (
        <div className="space-y-6">
          {/* Test input */}
          <div className="card-base space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Test Input</label>
              <input
                type="text"
                placeholder="Run name (optional)"
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                className="input-base text-xs py-1.5 w-48"
              />
            </div>
            <textarea
              rows={4}
              placeholder="Enter the user message to test across all agents…"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="input-base resize-none w-full"
            />
          </div>

          {/* Agents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Test Agents ({agents.length}/6)
              </h2>
              <button
                onClick={addAgent}
                disabled={agents.length >= 6}
                className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <Icon name="PlusIcon" size={12} />
                Add Agent
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {agents.map((agent, idx) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  index={idx}
                  isRunning={isRunning}
                  liveResult={liveResults[agent.id]}
                  finalResult={runResults.find((r) => r.agentId === agent.id)}
                  onUpdate={(patch) => updateAgent(agent.id, patch)}
                  onRemove={() => removeAgent(agent.id)}
                  canRemove={agents.length > 1}
                  isEditing={editingAgentId === agent.id}
                  onToggleEdit={() =>
                    setEditingAgentId((prev) => (prev === agent.id ? null : agent.id))
                  }
                />
              ))}
            </div>
          </div>

          {/* Run summary */}
          {runSummary && (
            <RunSummaryPanel summary={runSummary} results={runResults} agents={agents} />
          )}
        </div>
      )}

      {/* ── SAVED PROMPTS TAB ── */}
      {activeTab === 'saved' && (
        <SavedPromptsTab
          prompts={savedPrompts}
          loading={loadingPrompts}
          agents={agents}
          onLoad={loadPromptIntoAgent}
          onDelete={deletePrompt}
          isSupabase={isSupabaseConfigured}
          user={user}
        />
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <HistoryTab
          history={history}
          loading={!historyLoaded}
          isSupabase={isSupabaseConfigured}
          user={user}
        />
      )}

      {/* Save prompt modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Save Prompt</h3>
              <button onClick={() => setSaveModalOpen(false)} className="btn-ghost p-1.5">
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Concise Analyst"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="What is this prompt for?"
                  value={saveForm.description}
                  onChange={(e) => setSaveForm((f) => ({ ...f, description: e.target.value }))}
                  className="input-base w-full resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. analysis, concise, gpt-4o"
                  value={saveForm.tags}
                  onChange={(e) => setSaveForm((f) => ({ ...f, tags: e.target.value }))}
                  className="input-base w-full"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Saves the system prompt, model, and parameters from Agent 1.
              </p>
            </div>
            <div className="flex gap-2 justify-end p-4 border-t border-border">
              <button onClick={() => setSaveModalOpen(false)} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                onClick={savePrompt}
                disabled={saving || !saveForm.name.trim()}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: TestRunAgent;
  index: number;
  isRunning: boolean;
  liveResult?: PromptTestResult;
  finalResult?: PromptTestResult;
  onUpdate: (patch: Partial<TestRunAgent>) => void;
  onRemove: () => void;
  canRemove: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
}

function AgentCard({
  agent,
  index,
  isRunning,
  liveResult,
  finalResult,
  onUpdate,
  onRemove,
  canRemove,
  isEditing,
  onToggleEdit,
}: AgentCardProps) {
  const result = finalResult ?? liveResult;
  const isPending = isRunning && !liveResult;
  const isComplete = !!finalResult;

  return (
    <div
      className="card-base border-l-4 flex flex-col gap-3"
      style={{ borderLeftColor: agent.color }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: agent.color }}
        />
        <input
          type="text"
          value={agent.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 bg-transparent text-sm font-medium text-foreground focus:outline-none border-b border-transparent focus:border-border"
        />
        <div className="flex items-center gap-1 ml-auto">
          {isPending && (
            <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          )}
          {isComplete && (
            <Icon name="CheckCircleIcon" size={14} className="text-positive" />
          )}
          <button onClick={onToggleEdit} className="btn-ghost p-1" title="Configure">
            <Icon name="AdjustmentsHorizontalIcon" size={14} />
          </button>
          {canRemove && (
            <button onClick={onRemove} className="btn-ghost p-1 text-negative" title="Remove">
              <Icon name="XMarkIcon" size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Model selector */}
      <div className="flex gap-2">
        <select
          value={agent.model}
          onChange={(e) => onUpdate({ model: e.target.value })}
          className="input-base text-xs py-1.5 flex-1"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label} ({m.provider})
            </option>
          ))}
        </select>
      </div>

      {/* Expanded config */}
      {isEditing && (
        <div className="space-y-2 pt-1 border-t border-border">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">System Prompt</label>
            <textarea
              rows={4}
              value={agent.systemPrompt}
              onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
              className="input-base text-xs resize-none w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Temperature: {agent.temperature}
              </label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={agent.temperature}
                onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Max Tokens</label>
              <input
                type="number"
                min={50}
                max={4000}
                step={50}
                value={agent.maxTokens}
                onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value) })}
                className="input-base text-xs py-1 w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="pt-2 border-t border-border space-y-2">
          {result.success ? (
            <>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                {result.content}
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Icon name="CpuChipIcon" size={11} />
                  {result.totalTokens.toLocaleString()} tokens
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="CurrencyDollarIcon" size={11} />
                  {formatCost(result.estimatedCost)}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="ClockIcon" size={11} />
                  {(result.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-negative bg-negative/10 rounded p-2">
              ⚠ {result.error ?? 'Failed'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Run Summary Panel ────────────────────────────────────────────────────────

function RunSummaryPanel({
  summary,
  results,
  agents,
}: {
  summary: PromptRunSummary;
  results: PromptTestResult[];
  agents: TestRunAgent[];
}) {
  const successCount = results.filter((r) => r.success).length;

  // Chart data
  const barData = results.map((r) => {
    const agent = agents.find((a) => a.id === r.agentId);
    return {
      name: r.agentName,
      tokens: r.totalTokens,
      cost: parseFloat(r.estimatedCost.toFixed(4)),
      duration: parseFloat((r.durationMs / 1000).toFixed(2)),
      color: agent?.color ?? '#6366f1',
    };
  });

  const radarData = results
    .filter((r) => r.success)
    .map((r) => {
      const maxTokens = Math.max(...results.map((x) => x.totalTokens), 1);
      const maxDuration = Math.max(...results.map((x) => x.durationMs), 1);
      const maxCost = Math.max(...results.map((x) => x.estimatedCost), 0.0001);
      return {
        agent: r.agentName,
        'Token Efficiency': Math.round((1 - r.totalTokens / maxTokens) * 100),
        'Speed': Math.round((1 - r.durationMs / maxDuration) * 100),
        'Cost Efficiency': Math.round((1 - r.estimatedCost / maxCost) * 100),
        'Output Length': Math.min(100, Math.round((r.content?.length ?? 0) / 20)),
        'Success': r.success ? 100 : 0,
      };
    });

  const [chartTab, setChartTab] = React.useState<'tokens' | 'cost' | 'speed' | 'radar'>('tokens');

  return (
    <div className="card-base space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Icon name="ChartBarIcon" size={16} className="text-primary" />
        Run Summary & Comparison
      </h3>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Agents Run', value: `${successCount}/${results.length}`, icon: 'CpuChipIcon', color: 'text-primary' },
          { label: 'Total Tokens', value: summary.totalTokens.toLocaleString(), icon: 'HashtagIcon', color: 'text-accent' },
          { label: 'Est. Cost', value: formatCost(summary.totalCost), icon: 'CurrencyDollarIcon', color: 'text-warning' },
          { label: 'Duration', value: `${(summary.durationMs / 1000).toFixed(1)}s`, icon: 'ClockIcon', color: 'text-positive' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name={kpi.icon as any} size={12} className={kpi.color} />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <p className="text-lg font-bold text-foreground tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Chart tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: 'tokens', label: 'Token Usage' },
          { id: 'cost', label: 'Cost / Model' },
          { id: 'speed', label: 'Speed' },
          { id: 'radar', label: 'Quality Radar' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setChartTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              chartTab === t.id
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      {(chartTab === 'tokens' || chartTab === 'cost' || chartTab === 'speed') && (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={barData}
            margin={{ top: 4, right: 4, bottom: 4, left: -10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <Tooltip
              contentStyle={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--foreground)' }}
            />
            <Bar
              dataKey={chartTab === 'tokens' ? 'tokens' : chartTab === 'cost' ? 'cost' : 'duration'}
              radius={[4, 4, 0, 0]}
              fill="var(--primary)"
            />
          </BarChart>
        </ResponsiveContainer>
      )}

      {chartTab === 'radar' && radarData.length > 0 && (
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={[
            { metric: 'Token Efficiency', ...Object.fromEntries(radarData.map((r) => [r.agent, r['Token Efficiency']])) },
            { metric: 'Speed', ...Object.fromEntries(radarData.map((r) => [r.agent, r['Speed']])) },
            { metric: 'Cost Efficiency', ...Object.fromEntries(radarData.map((r) => [r.agent, r['Cost Efficiency']])) },
            { metric: 'Output Length', ...Object.fromEntries(radarData.map((r) => [r.agent, r['Output Length']])) },
            { metric: 'Success', ...Object.fromEntries(radarData.map((r) => [r.agent, r['Success']])) },
          ]}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
            {radarData.map((r, i) => {
              const agent = agents.find((a) => a.name === r.agent);
              return (
                <Radar
                  key={r.agent}
                  name={r.agent}
                  dataKey={r.agent}
                  stroke={agent?.color ?? '#6366f1'}
                  fill={agent?.color ?? '#6366f1'}
                  fillOpacity={0.15}
                />
              );
            })}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </RadarChart>
        </ResponsiveContainer>
      )}

      {chartTab === 'radar' && radarData.length === 0 && (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          No successful results to compare
        </div>
      )}

      {/* Per-agent breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Per-Agent Breakdown
        </p>
        {results.map((r) => {
          const agent = agents.find((a) => a.id === r.agentId);
          const totalCost = summary.totalCost || 0.0001;
          const contribution = Math.round((r.estimatedCost / totalCost) * 100);
          return (
            <div key={r.agentId} className="flex items-center gap-3 text-xs">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: agent?.color ?? '#6366f1' }}
              />
              <span className="font-medium text-foreground w-28 truncate">{r.agentName}</span>
              <span className="text-muted-foreground w-20 truncate">{r.model.split('/').pop()}</span>
              <span className="text-muted-foreground tabular-nums w-20">
                {r.totalTokens.toLocaleString()} tok
              </span>
              <span className="text-muted-foreground tabular-nums w-16">
                {formatCost(r.estimatedCost)}
              </span>
              <span className="text-muted-foreground tabular-nums w-12">
                {(r.durationMs / 1000).toFixed(1)}s
              </span>
              <span className="text-muted-foreground tabular-nums w-10">
                {contribution}%
              </span>
              {r.success ? (
                <Icon name="CheckCircleIcon" size={12} className="text-positive" />
              ) : (
                <Icon name="XCircleIcon" size={12} className="text-negative" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Saved Prompts Tab ────────────────────────────────────────────────────────

function SavedPromptsTab({
  prompts,
  loading,
  agents,
  onLoad,
  onDelete,
  isSupabase,
  user,
}: {
  prompts: SavedPrompt[];
  loading: boolean;
  agents: TestRunAgent[];
  onLoad: (prompt: SavedPrompt, agentId: string) => void;
  onDelete: (id: string) => void;
  isSupabase: boolean;
  user: any;
}) {
  const [loadTarget, setLoadTarget] = useState<SavedPrompt | null>(null);

  if (!isSupabase || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl">
        <Icon name="LockClosedIcon" size={36} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Sign in to save and manage prompts</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl">
        <Icon name="BookmarkIcon" size={36} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No saved prompts yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Run a test and click "Save Prompt" to store it here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loadTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-2xl p-4 space-y-3">
            <h3 className="font-semibold text-foreground text-sm">Load into which agent?</h3>
            <div className="space-y-2">
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { onLoad(loadTarget, a.id); setLoadTarget(null); }}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm text-left"
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                  {a.name} — <span className="text-muted-foreground text-xs">{a.model}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setLoadTarget(null)} className="btn-secondary text-xs w-full">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {prompts.map((p) => (
          <div key={p.id} className="card-base space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                )}
              </div>
              <button
                onClick={() => onDelete(p.id)}
                className="btn-ghost p-1 text-muted-foreground hover:text-negative flex-shrink-0"
              >
                <Icon name="TrashIcon" size={13} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {p.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{p.model.split('/').pop()}</span>
              <span>·</span>
              <span>temp {p.temperature}</span>
              <span>·</span>
              <span>{p.usage_count} uses</span>
            </div>
            <button
              onClick={() => setLoadTarget(p)}
              className="btn-secondary text-xs w-full flex items-center justify-center gap-1"
            >
              <Icon name="ArrowDownTrayIcon" size={12} />
              Load into Agent
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({
  history,
  loading,
  isSupabase,
  user,
}: {
  history: any[];
  loading: boolean;
  isSupabase: boolean;
  user: any;
}) {
  if (!isSupabase || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl">
        <Icon name="LockClosedIcon" size={36} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Sign in to view run history</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl">
        <Icon name="ClockIcon" size={36} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No runs yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Run a test in the Lab tab to see history here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((run) => {
        const results: PromptTestResult[] = run.results ?? [];
        const successCount = results.filter((r: any) => r.success).length;
        return (
          <div key={run.id} className="card-base space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-medium text-foreground">{run.run_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{run.test_input}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                <span>{new Date(run.created_at).toLocaleDateString()}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  run.run_status === 'completed' ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
                }`}>
                  {run.run_status}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Icon name="CpuChipIcon" size={11} />
                {successCount}/{results.length} agents
              </span>
              <span className="flex items-center gap-1">
                <Icon name="HashtagIcon" size={11} />
                {(run.total_tokens ?? 0).toLocaleString()} tokens
              </span>
              <span className="flex items-center gap-1">
                <Icon name="CurrencyDollarIcon" size={11} />
                {formatCost(run.estimated_cost ?? 0)}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="ClockIcon" size={11} />
                {((run.duration_ms ?? 0) / 1000).toFixed(1)}s
              </span>
            </div>
            {/* Per-agent mini results */}
            {results.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-border">
                {results.map((r: any) => (
                  <div key={r.agentId} className="flex items-center gap-2 text-xs">
                    {r.success ? (
                      <Icon name="CheckCircleIcon" size={11} className="text-positive flex-shrink-0" />
                    ) : (
                      <Icon name="XCircleIcon" size={11} className="text-negative flex-shrink-0" />
                    )}
                    <span className="font-medium text-foreground w-24 truncate">{r.agentName}</span>
                    <span className="text-muted-foreground truncate">{r.model?.split('/').pop()}</span>
                    <span className="ml-auto text-muted-foreground tabular-nums">
                      {(r.totalTokens ?? 0).toLocaleString()} tok · {formatCost(r.estimatedCost ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
