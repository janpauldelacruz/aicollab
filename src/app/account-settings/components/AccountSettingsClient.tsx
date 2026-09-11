'use client';
import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type Tab = 'profile' | 'usage' | 'preferences' | 'export';

interface UsageStats {
  sessionsRun: number;
  totalArtifacts: number;
  totalMessages: number;
  totalAgentsUsed: number;
  avgSessionDuration: string;
  mostUsedModel: string;
}

interface ModelPref {
  role: string;
  model: string;
}

interface ExportDefaults {
  format: 'markdown' | 'json' | 'pdf' | 'txt';
  includeTranscript: boolean;
  includeArtifacts: boolean;
  includeAgentInfo: boolean;
  includeSummary: boolean;
}

const MODEL_OPTIONS = [
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'claude-3-5-sonnet-20241022',
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'llama-3.1-70b-instruct',
  'mistral-large-latest',
  'Custom / Other…',
];

const DEFAULT_MODEL_PREFS: ModelPref[] = [
  { role: 'Architect', model: 'claude-3-5-sonnet-20241022' },
  { role: 'Developer', model: 'gpt-4o' },
  { role: 'Reviewer', model: 'gemini-1.5-pro' },
];

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profile', icon: 'UserCircleIcon' },
  { id: 'usage', label: 'Usage Stats', icon: 'BarChart2Icon' },
  { id: 'preferences', label: 'Model Preferences', icon: 'CpuIcon' },
  { id: 'export', label: 'Export Defaults', icon: 'DownloadIcon' },
];

export default function AccountSettingsClient() {
  const { user, signOut } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('Pro');

  // Usage stats (mock derived from sessions)
  const [usage, setUsage] = useState<UsageStats>({
    sessionsRun: 0,
    totalArtifacts: 0,
    totalMessages: 0,
    totalAgentsUsed: 0,
    avgSessionDuration: '—',
    mostUsedModel: '—',
  });

  // Model preferences
  const [modelPrefs, setModelPrefs] = useState<ModelPref[]>(DEFAULT_MODEL_PREFS);

  // Export defaults
  const [exportDefaults, setExportDefaults] = useState<ExportDefaults>({
    format: 'markdown',
    includeTranscript: true,
    includeArtifacts: true,
    includeAgentInfo: true,
    includeSummary: true,
  });

  useEffect(() => {
    if (user) {
      setEmail(user.email ?? '');
      setDisplayName(user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User');
    }
    loadUsageStats();
    loadPreferences();
  }, [user]);

  const loadUsageStats = async () => {
    try {
      const { data: sessions } = await supabase
        .from('collab_sessions')
        .select('id, message_count, artifact_count')
        .eq('user_id', user?.id);

      if (sessions && sessions.length > 0) {
        const totalArtifacts = sessions.reduce((sum: number, s: any) => sum + (s.artifact_count ?? 0), 0);
        const totalMessages = sessions.reduce((sum: number, s: any) => sum + (s.message_count ?? 0), 0);
        setUsage((prev) => ({
          ...prev,
          sessionsRun: sessions.length,
          totalArtifacts,
          totalMessages,
        }));
      } else {
        // Fallback mock stats for demo
        setUsage({
          sessionsRun: 24,
          totalArtifacts: 87,
          totalMessages: 1342,
          totalAgentsUsed: 6,
          avgSessionDuration: '1h 18m',
          mostUsedModel: 'claude-3-5-sonnet-20241022',
        });
      }
    } catch {
      setUsage({
        sessionsRun: 24,
        totalArtifacts: 87,
        totalMessages: 1342,
        totalAgentsUsed: 6,
        avgSessionDuration: '1h 18m',
        mostUsedModel: 'claude-3-5-sonnet-20241022',
      });
    }
  };

  const loadPreferences = () => {
    try {
      const stored = localStorage.getItem('aicollab_model_prefs');
      if (stored) setModelPrefs(JSON.parse(stored));
      const storedExport = localStorage.getItem('aicollab_export_defaults');
      if (storedExport) setExportDefaults(JSON.parse(storedExport));
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'profile' && user) {
        await supabase.auth.updateUser({ data: { full_name: displayName } });
      }
      if (activeTab === 'preferences') {
        localStorage.setItem('aicollab_model_prefs', JSON.stringify(modelPrefs));
      }
      if (activeTab === 'export') {
        localStorage.setItem('aicollab_export_defaults', JSON.stringify(exportDefaults));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  };

  const updateModelPref = (index: number, field: keyof ModelPref, value: string) => {
    setModelPrefs((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const addModelPref = () => {
    setModelPrefs((prev) => [...prev, { role: 'New Role', model: 'gpt-4o' }]);
  };

  const removeModelPref = (index: number) => {
    setModelPrefs((prev) => prev.filter((_, i) => i !== index));
  };

  const statCards = [
    { label: 'Sessions Run', value: usage.sessionsRun, icon: 'PlayCircleIcon', color: 'text-primary' },
    { label: 'Total Artifacts', value: usage.totalArtifacts, icon: 'FileTextIcon', color: 'text-emerald-400' },
    { label: 'Total Messages', value: usage.totalMessages, icon: 'MessageSquareIcon', color: 'text-blue-400' },
    { label: 'Agents Used', value: usage.totalAgentsUsed, icon: 'CpuIcon', color: 'text-violet-400' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Account Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your profile, usage, and preferences</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? (
              <Icon name="LoaderIcon" size={15} className="animate-spin" />
            ) : saved ? (
              <Icon name="CheckIcon" size={15} />
            ) : (
              <Icon name="SaveIcon" size={15} />
            )}
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Sidebar Tabs */}
          <aside className="w-48 flex-shrink-0">
            <nav className="space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary/10 text-primary border border-primary/20' :'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon name={tab.icon as any} size={16} className="flex-shrink-0" />
                  {tab.label}
                </button>
              ))}

              <div className="pt-4 mt-4 border-t border-border">
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Icon name="LogOutIcon" size={16} className="flex-shrink-0" />
                  Sign Out
                </button>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-5">
                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Personal Information</h2>
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{displayName}</p>
                      <p className="text-xs text-muted-foreground">{email}</p>
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        <Icon name="ZapIcon" size={10} />
                        {plan} Plan
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-muted-foreground cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-3">Subscription</h2>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/15">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Icon name="ZapIcon" size={15} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{plan} Plan</p>
                        <p className="text-xs text-muted-foreground">Unlimited sessions · All models</p>
                      </div>
                    </div>
                    <button className="text-xs font-medium text-primary hover:underline">Manage</button>
                  </div>
                </div>
              </div>
            )}

            {/* Usage Stats Tab */}
            {activeTab === 'usage' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  {statCards.map((card) => (
                    <div key={card.label} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name={card.icon as any} size={15} className={card.color} />
                        <span className="text-xs text-muted-foreground">{card.label}</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{card.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Session Insights</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <Icon name="ClockIcon" size={14} className="text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Avg. Session Duration</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{usage.avgSessionDuration}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <Icon name="CpuIcon" size={14} className="text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Most Used Model</span>
                      </div>
                      <span className="text-sm font-medium text-foreground font-mono">{usage.mostUsedModel}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon name="TrendingUpIcon" size={14} className="text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Completion Rate</span>
                      </div>
                      <span className="text-sm font-medium text-emerald-400">
                        {usage.sessionsRun > 0 ? '78%' : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-3">Activity This Month</h2>
                  <div className="flex items-end gap-1 h-16">
                    {[4, 7, 3, 9, 5, 11, 6, 8, 4, 12, 7, 9, 5, 10].map((v, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm bg-primary/30 hover:bg-primary/60 transition-colors"
                        style={{ height: `${(v / 12) * 100}%` }}
                        title={`${v} sessions`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Sessions per day (last 14 days)</p>
                </div>
              </div>
            )}

            {/* Model Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="space-y-5">
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Default Agent Models</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Pre-fill agent roles when creating new sessions</p>
                    </div>
                    <button
                      onClick={addModelPref}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Icon name="PlusIcon" size={13} />
                      Add Role
                    </button>
                  </div>
                  <div className="space-y-3">
                    {modelPrefs.map((pref, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border/60">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon name="CpuIcon" size={13} className="text-primary" />
                        </div>
                        <input
                          type="text"
                          value={pref.role}
                          onChange={(e) => updateModelPref(i, 'role', e.target.value)}
                          placeholder="Role name"
                          className="w-28 px-2 py-1.5 rounded-md bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <select
                          value={pref.model}
                          onChange={(e) => updateModelPref(i, 'model', e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded-md bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                        >
                          {MODEL_OPTIONS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeModelPref(i)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Icon name="TrashIcon" size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-3">Session Defaults</h2>
                  <div className="space-y-3">
                    {[
                      { label: 'Auto-start session on launch', key: 'autoStart', value: true },
                      { label: 'Show agent thinking indicators', key: 'showThinking', value: true },
                      { label: 'Enable real-time artifact preview', key: 'artifactPreview', value: false },
                    ].map((setting) => (
                      <div key={setting.key} className="flex items-center justify-between py-2">
                        <span className="text-sm text-foreground">{setting.label}</span>
                        <button
                          className={`relative w-10 h-5 rounded-full transition-colors ${setting.value ? 'bg-primary' : 'bg-muted'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${setting.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Export Defaults Tab */}
            {activeTab === 'export' && (
              <div className="space-y-5">
                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Default Export Format</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {(['markdown', 'json', 'pdf', 'txt'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setExportDefaults((p) => ({ ...p, format: fmt }))}
                        className={`flex items-center gap-2.5 p-3 rounded-lg border text-sm font-medium transition-all ${
                          exportDefaults.format === fmt
                            ? 'border-primary bg-primary/10 text-primary' :'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Icon
                          name={fmt === 'markdown' ? 'FileTextIcon' : fmt === 'json' ? 'CodeIcon' : fmt === 'pdf' ? 'FileIcon' : 'AlignLeftIcon'}
                          size={15}
                          className="flex-shrink-0"
                        />
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Include in Export</h2>
                  <div className="space-y-3">
                    {(
                      [
                        { key: 'includeTranscript', label: 'Full Transcript', desc: 'All agent messages and responses' },
                        { key: 'includeArtifacts', label: 'Artifacts', desc: 'Generated code, docs, and files' },
                        { key: 'includeAgentInfo', label: 'Agent Configuration', desc: 'Model names, roles, and settings' },
                        { key: 'includeSummary', label: 'Session Summary', desc: 'Auto-generated overview and key points' },
                      ] as { key: keyof ExportDefaults; label: string; desc: string }[]
                    ).map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <button
                          onClick={() =>
                            setExportDefaults((p) => ({ ...p, [item.key]: !p[item.key] }))
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${exportDefaults[item.key] ? 'bg-primary' : 'bg-muted'}`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${exportDefaults[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-3">Export Preview</h2>
                  <div className="rounded-lg bg-background border border-border p-3 font-mono text-xs text-muted-foreground space-y-1">
                    <p className="text-primary"># Session Export — AICollab</p>
                    {exportDefaults.includeSummary && <p>## Summary</p>}
                    {exportDefaults.includeAgentInfo && <p>## Agents: Architect · Developer · Reviewer</p>}
                    {exportDefaults.includeTranscript && <p>## Transcript (142 messages)</p>}
                    {exportDefaults.includeArtifacts && <p>## Artifacts (8 files)</p>}
                    <p className="text-muted-foreground/50">Format: .{exportDefaults.format}</p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
