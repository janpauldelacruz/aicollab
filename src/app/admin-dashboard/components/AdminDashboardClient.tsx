'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,  } from 'recharts';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

interface SpendAlert {
  id: string;
  threshold_usd: number;
  window_hours: number;
  is_active: boolean;
}

interface TokenStats {
  userId: string;
  email: string;
  fullName: string;
  totalTokens: number;
  totalCost: number;
  runCount: number;
}

const formatCost = (usd: number) => {
  if (usd < 0.0001) return '<$0.0001';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
};

export default function AdminDashboardClient() {
  const { user } = useAuth();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'spend' | 'alerts'>('overview');

  // Data
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tokenStats, setTokenStats] = useState<TokenStats[]>([]);
  const [sessionStats, setSessionStats] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<SpendAlert[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [loading, setLoading] = useState(false);

  // Alert form
  const [alertForm, setAlertForm] = useState({ threshold_usd: 10, window_hours: 24 });
  const [savingAlert, setSavingAlert] = useState(false);

  // Check admin
  useEffect(() => {
    if (!isSupabaseConfigured || !user) { setAdminLoading(false); return; }
    supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setIsAdmin(data?.is_admin ?? false);
        setAdminLoading(false);
      });
  }, [user, supabase]);

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      // Users
      const { data: usersData } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, plan, is_admin, is_active, created_at')
        .order('created_at', { ascending: false });
      if (usersData) {
        setUsers(usersData);
        setActiveUsers(usersData.filter((u) => u.is_active).length);
      }

      // Token spend from prompt_test_runs
      const { data: runsData } = await supabase
        .from('prompt_test_runs')
        .select('user_id, total_tokens, estimated_cost, created_at');
      if (runsData) {
        const byUser: Record<string, TokenStats> = {};
        let spend = 0;
        let tokens = 0;
        runsData.forEach((r: any) => {
          spend += r.estimated_cost ?? 0;
          tokens += r.total_tokens ?? 0;
          if (!byUser[r.user_id]) {
            const u = usersData?.find((u) => u.id === r.user_id);
            byUser[r.user_id] = {
              userId: r.user_id,
              email: u?.email ?? 'Unknown',
              fullName: u?.full_name ?? '',
              totalTokens: 0,
              totalCost: 0,
              runCount: 0,
            };
          }
          byUser[r.user_id].totalTokens += r.total_tokens ?? 0;
          byUser[r.user_id].totalCost += r.estimated_cost ?? 0;
          byUser[r.user_id].runCount += 1;
        });
        setTotalSpend(spend);
        setTotalTokens(tokens);
        setTokenStats(Object.values(byUser).sort((a, b) => b.totalCost - a.totalCost));
      }

      // Sessions
      const { data: sessionsData, count } = await supabase
        .from('collab_sessions')
        .select('session_status, mode, created_at', { count: 'exact' });
      if (sessionsData) {
        setTotalSessions(count ?? 0);
        // Group by mode for chart
        const byMode: Record<string, number> = {};
        sessionsData.forEach((s: any) => {
          byMode[s.mode] = (byMode[s.mode] ?? 0) + 1;
        });
        setSessionStats(Object.entries(byMode).map(([mode, count]) => ({ mode, count })));
      }

      // Alerts
      const { data: alertsData } = await supabase.from('admin_spend_alerts').select('*');
      if (alertsData) setAlerts(alertsData);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, supabase]);

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin, loadData]);

  const saveAlert = async () => {
    setSavingAlert(true);
    try {
      const { data } = await supabase
        .from('admin_spend_alerts')
        .insert({ threshold_usd: alertForm.threshold_usd, window_hours: alertForm.window_hours })
        .select()
        .single();
      if (data) setAlerts((prev) => [data, ...prev]);
    } finally {
      setSavingAlert(false);
    }
  };

  const deleteAlert = async (id: string) => {
    await supabase.from('admin_spend_alerts').delete().eq('id', id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const toggleAlertActive = async (alert: SpendAlert) => {
    const { data } = await supabase
      .from('admin_spend_alerts')
      .update({ is_active: !alert.is_active })
      .eq('id', alert.id)
      .select()
      .single();
    if (data) setAlerts((prev) => prev.map((a) => (a.id === data.id ? data : a)));
  };

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Icon name="ShieldExclamationIcon" size={48} className="text-muted-foreground/30 mb-4" />
        <p className="text-base font-semibold text-foreground">Admin Access Required</p>
        <p className="text-sm text-muted-foreground mt-1">
          You need admin privileges to view this dashboard.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-2">
          Go to Account Settings → Admin tab to bootstrap admin access.
        </p>
      </div>
    );
  }

  const TABS = [
    { id: 'overview', label: 'Overview', icon: 'LayoutDashboardIcon' },
    { id: 'users', label: 'Users', icon: 'UsersIcon' },
    { id: 'spend', label: 'Token Spend', icon: 'CurrencyDollarIcon' },
    { id: 'alerts', label: 'Spend Alerts', icon: 'BellAlertIcon' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Icon name="ShieldCheckIcon" size={22} className="text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor all users' token spend, session activity, agent performance, and cost per model
          </p>
        </div>
        <button onClick={loadData} disabled={loading} className="btn-secondary text-sm flex items-center gap-1.5">
          <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as any} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: users.length, icon: 'UsersIcon', color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Active Users', value: activeUsers, icon: 'UserCircleIcon', color: 'text-positive', bg: 'bg-positive/10' },
              { label: 'Total Sessions', value: totalSessions, icon: 'ChatBubbleLeftRightIcon', color: 'text-accent', bg: 'bg-accent/10' },
              { label: 'Total Spend', value: formatCost(totalSpend), icon: 'CurrencyDollarIcon', color: 'text-warning', bg: 'bg-warning/10' },
            ].map((kpi) => (
              <div key={kpi.label} className="card-base">
                <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
                  <Icon name={kpi.icon as any} size={18} className={kpi.color} />
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sessions by mode */}
            <div className="card-base space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon name="ChartBarIcon" size={14} className="text-primary" />
                Sessions by Mode
              </h3>
              {sessionStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sessionStats} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mode" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: 'var(--foreground)' }}
                    />
                    <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No session data yet</div>
              )}
            </div>

            {/* Top spenders */}
            <div className="card-base space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon name="CurrencyDollarIcon" size={14} className="text-warning" />
                Top Token Spenders
              </h3>
              {tokenStats.length > 0 ? (
                <div className="space-y-2">
                  {tokenStats.slice(0, 5).map((stat, i) => (
                    <div key={stat.userId} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {stat.fullName || stat.email}
                        </p>
                        <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (stat.totalCost / (tokenStats[0]?.totalCost || 1)) * 100)}%`,
                              background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-foreground tabular-nums">{formatCost(stat.totalCost)}</p>
                        <p className="text-xs text-muted-foreground">{stat.totalTokens.toLocaleString()} tok</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No spend data yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── USERS ── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{users.length} total users</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['User', 'Plan', 'Status', 'Admin', 'Joined'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground text-xs">{u.full_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        u.plan === 'elite' ? 'bg-warning/10 text-warning' :
                        u.plan === 'pro'? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {u.plan ?? 'free'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        u.is_active ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
                      }`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_admin && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">Admin</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">No users found</div>
            )}
          </div>
        </div>
      )}

      {/* ── SPEND ── */}
      {activeTab === 'spend' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Total Spend', value: formatCost(totalSpend), icon: 'CurrencyDollarIcon', color: 'text-warning' },
              { label: 'Total Tokens', value: totalTokens.toLocaleString(), icon: 'HashtagIcon', color: 'text-accent' },
              { label: 'Prompt Lab Runs', value: tokenStats.reduce((s, t) => s + t.runCount, 0), icon: 'BeakerIcon', color: 'text-primary' },
            ].map((kpi) => (
              <div key={kpi.label} className="card-base">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={kpi.icon as any} size={14} className={kpi.color} />
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
                <p className="text-xl font-bold text-foreground tabular-nums">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Per-user spend table */}
          <div className="card-base space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Per-User Token Spend</h3>
            {tokenStats.length > 0 ? (
              <div className="space-y-3">
                {tokenStats.map((stat) => (
                  <div key={stat.userId} className="flex items-center gap-4">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-primary">
                        {(stat.fullName || stat.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-foreground truncate">
                          {stat.fullName || stat.email}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0 ml-2">
                          <span>{stat.totalTokens.toLocaleString()} tokens</span>
                          <span className="font-semibold text-foreground">{formatCost(stat.totalCost)}</span>
                          <span>{stat.runCount} runs</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (stat.totalCost / (tokenStats[0]?.totalCost || 1)) * 100)}%`,
                            background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">No spend data yet</div>
            )}
          </div>
        </div>
      )}

      {/* ── ALERTS ── */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Create alert */}
          <div className="card-base space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icon name="BellAlertIcon" size={14} className="text-warning" />
              Create Spend Alert
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Threshold (USD)</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={alertForm.threshold_usd}
                  onChange={(e) => setAlertForm((f) => ({ ...f, threshold_usd: parseFloat(e.target.value) }))}
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Window (hours)</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={alertForm.window_hours}
                  onChange={(e) => setAlertForm((f) => ({ ...f, window_hours: parseInt(e.target.value) }))}
                  className="input-base w-full"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Alert when total spend exceeds <strong className="text-foreground">${alertForm.threshold_usd}</strong> within the last <strong className="text-foreground">{alertForm.window_hours}h</strong>
            </p>
            <button
              onClick={saveAlert}
              disabled={savingAlert}
              className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingAlert ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Icon name="PlusIcon" size={14} />
              )}
              Add Alert
            </button>
          </div>

          {/* Alert list */}
          {alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="card-base flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${alert.is_active ? 'bg-positive live-indicator' : 'bg-muted-foreground'}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Alert at <span className="text-warning">${alert.threshold_usd}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Within {alert.window_hours}h window · {alert.is_active ? 'Active' : 'Paused'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAlertActive(alert)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        alert.is_active
                          ? 'border-positive/30 bg-positive/10 text-positive hover:bg-positive/20' :'border-border bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {alert.is_active ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="btn-ghost p-1.5 text-negative"
                    >
                      <Icon name="TrashIcon" size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border rounded-xl">
              <Icon name="BellSlashIcon" size={36} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No spend alerts configured</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
