import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { SessionConfig, AgentConfig } from '@/app/session-setup/components/SessionSetupClient';

export type SessionStatus = 'draft' | 'running' | 'paused' | 'completed' | 'stopped';

export interface DBSession {
  id: string;
  user_id: string;
  name: string;
  mode: string;
  topic: string;
  goal: string;
  max_turns: number;
  turn_timeout: number;
  session_status: SessionStatus;
  turn_count: number;
  message_count: number;
  artifact_count: number;
  agent_count: number;
  elapsed_seconds: number;
  completion_pct: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBMessage {
  id: string;
  session_id: string;
  agent_id: string;
  agent_name: string;
  agent_role: string;
  agent_color: string;
  content: string;
  message_type: string;
  code_language?: string;
  reply_to?: string;
  artifact_id?: string;
  elapsed_seconds: number;
  created_at: string;
}

export interface DBArtifact {
  id: string;
  session_id: string;
  artifact_key: string;
  name: string;
  artifact_type: string;
  content: string;
  created_by: string;
  language?: string;
  created_at: string;
}

export interface DBShareLink {
  id: string;
  session_id: string;
  created_by: string;
  token: string;
  label: string;
  allow_rerun: boolean;
  access_count: number;
  expires_at: string | null;
  created_at: string;
}

// ─── Session CRUD ────────────────────────────────────────────────────────────

export async function createSession(
  config: SessionConfig,
  userId: string
): Promise<DBSession | null> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collab_sessions')
    .insert({
      user_id: userId,
      name: config.name || 'Untitled Session',
      mode: config.mode,
      topic: config.topic,
      goal: config.goal,
      max_turns: config.maxTurns,
      turn_timeout: config.turnTimeout,
      session_status: 'draft',
      agent_count: config.agents.length,
    })
    .select()
    .single();

  if (error) {
    console.error('createSession error:', error.message);
    return null;
  }

  // Insert agents
  if (config.agents.length > 0) {
    const agentRows = config.agents.map((a: AgentConfig) => ({
      session_id: data.id,
      agent_key: a.id,
      name: a.name,
      role: a.role,
      model: a.model,
      personality: a.personality,
      creativity: a.creativity,
      verbosity: a.verbosity,
      assertiveness: a.assertiveness,
      system_prompt: a.systemPrompt,
      color: '#6366f1',
    }));
    await supabase.from('session_agents').insert(agentRows);
  }

  return data;
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  extra?: Partial<
    Pick<
      DBSession,
      | 'turn_count'
      | 'message_count'
      | 'artifact_count'
      | 'elapsed_seconds'
      | 'completion_pct'
      | 'started_at'
      | 'completed_at'
    >
  >
): Promise<void> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  const updates: any = { session_status: status, ...extra };
  if (status === 'running' && !extra?.started_at) {
    updates.started_at = new Date().toISOString();
  }
  if (status === 'completed' || status === 'stopped') {
    updates.completed_at = new Date().toISOString();
    updates.completion_pct = status === 'completed' ? 100 : (extra?.completion_pct ?? 0);
  }
  const { error } = await supabase.from('collab_sessions').update(updates).eq('id', sessionId);
  if (error) console.error('updateSessionStatus error:', error.message);
}

export async function getUserSessions(userId: string): Promise<DBSession[]> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collab_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getUserSessions error:', error.message);
    return [];
  }
  return data || [];
}

export async function getSessionById(sessionId: string): Promise<DBSession | null> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collab_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (error) return null;
  return data;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function insertMessage(
  sessionId: string,
  msg: {
    agentId: string;
    agentName: string;
    agentRole: string;
    agentColor: string;
    content: string;
    type: string;
    codeLanguage?: string;
    replyTo?: string;
    artifactId?: string;
    elapsedSeconds: number;
  }
): Promise<void> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  const { error } = await supabase.from('session_messages').insert({
    session_id: sessionId,
    agent_id: msg.agentId,
    agent_name: msg.agentName,
    agent_role: msg.agentRole,
    agent_color: msg.agentColor,
    content: msg.content,
    message_type: msg.type,
    code_language: msg.codeLanguage,
    reply_to: msg.replyTo,
    artifact_id: msg.artifactId,
    elapsed_seconds: msg.elapsedSeconds,
  });
  if (error) console.error('insertMessage error:', error.message);
}

export async function getSessionMessages(sessionId: string): Promise<DBMessage[]> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('session_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

// ─── Artifacts ───────────────────────────────────────────────────────────────

export async function insertArtifact(
  sessionId: string,
  artifact: {
    artifactKey: string;
    name: string;
    type: string;
    content: string;
    createdBy: string;
    language?: string;
  }
): Promise<void> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  const { error } = await supabase.from('session_artifacts').insert({
    session_id: sessionId,
    artifact_key: artifact.artifactKey,
    name: artifact.name,
    artifact_type: artifact.type,
    content: artifact.content,
    created_by: artifact.createdBy,
    language: artifact.language,
  });
  if (error) console.error('insertArtifact error:', error.message);
}

export async function getSessionArtifacts(sessionId: string): Promise<DBArtifact[]> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('session_artifacts')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

// ─── Share Links ─────────────────────────────────────────────────────────────

/**
 * Share tokens are the only thing protecting a public session link, so they
 * come from the platform CSPRNG. Math.random() is predictable and would let
 * someone enumerate other people's links.
 */
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // Rejection-free mapping is not needed here; the slight modulo bias over a
  // 62-char alphabet leaves far more entropy than a share link requires.
  return Array.from(bytes, (b) => chars.charAt(b % chars.length)).join('');
}

export async function createShareLink(
  sessionId: string,
  userId: string,
  options: { label?: string; allowRerun?: boolean; expiresInDays?: number } = {}
): Promise<DBShareLink | null> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  const token = generateToken();
  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 86400000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('session_share_links')
    .insert({
      session_id: sessionId,
      created_by: userId,
      token,
      label: options.label || 'Shared Link',
      allow_rerun: options.allowRerun ?? true,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    console.error('createShareLink error:', error.message);
    return null;
  }
  return data;
}

export async function getShareLinksForSession(sessionId: string): Promise<DBShareLink[]> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('session_share_links')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function getSessionByShareToken(token: string): Promise<{
  session: DBSession;
  agents: any[];
  messages: DBMessage[];
  artifacts: DBArtifact[];
  shareLink: DBShareLink;
} | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();

  // Get share link
  const { data: link, error: linkError } = await supabase
    .from('session_share_links')
    .select('*')
    .eq('token', token)
    .single();

  if (linkError || !link) return null;
  if (link.expires_at && new Date(link.expires_at) < new Date()) return null;

  // Increment access count
  await supabase
    .from('session_share_links')
    .update({ access_count: link.access_count + 1 })
    .eq('id', link.id);

  // Get session
  const { data: session } = await supabase
    .from('collab_sessions')
    .select('*')
    .eq('id', link.session_id)
    .single();

  if (!session) return null;

  // Get agents, messages, artifacts
  const [agentsRes, messagesRes, artifactsRes] = await Promise.all([
    supabase.from('session_agents').select('*').eq('session_id', link.session_id),
    supabase
      .from('session_messages')
      .select('*')
      .eq('session_id', link.session_id)
      .order('created_at', { ascending: true }),
    supabase.from('session_artifacts').select('*').eq('session_id', link.session_id),
  ]);

  return {
    session,
    agents: agentsRes.data || [],
    messages: messagesRes.data || [],
    artifacts: artifactsRes.data || [],
    shareLink: link,
  };
}

export async function deleteShareLink(linkId: string): Promise<void> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  await supabase.from('session_share_links').delete().eq('id', linkId);
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function trackEvent(
  eventType: string,
  userId: string | null,
  sessionId: string | null,
  metadata: Record<string, any> = {},
  agentModel?: string,
  agentName?: string
): Promise<void> {
  if (!isSupabaseConfigured) return null as never;
  const supabase = createClient();
  const { error } = await supabase.from('analytics_events').insert({
    event_type: eventType,
    user_id: userId,
    session_id: sessionId,
    metadata,
    agent_model: agentModel,
    agent_name: agentName,
  });
  if (error) console.error('trackEvent error:', error.message);
}

export async function getAnalyticsSummary(userId: string): Promise<{
  totalSessions: number;
  completedSessions: number;
  totalMessages: number;
  modelUsage: Record<string, number>;
  exportCount: number;
}> {
  if (!isSupabaseConfigured) {
    return {
      totalSessions: 0,
      completedSessions: 0,
      totalMessages: 0,
      modelUsage: {},
      exportCount: 0,
    };
  }
  const supabase = createClient();

  const [sessionsRes, eventsRes] = await Promise.all([
    supabase.from('collab_sessions').select('session_status, message_count').eq('user_id', userId),
    supabase.from('analytics_events').select('event_type, agent_model').eq('user_id', userId),
  ]);

  const sessions = sessionsRes.data || [];
  const events = eventsRes.data || [];

  const modelUsage: Record<string, number> = {};
  let exportCount = 0;

  events.forEach((e) => {
    if (e.event_type === 'agent_turn' && e.agent_model) {
      modelUsage[e.agent_model] = (modelUsage[e.agent_model] || 0) + 1;
    }
    if (e.event_type === 'artifact_export') exportCount++;
  });

  return {
    totalSessions: sessions.length,
    completedSessions: sessions.filter((s) => s.session_status === 'completed').length,
    totalMessages: sessions.reduce((sum, s) => sum + (s.message_count || 0), 0),
    modelUsage,
    exportCount,
  };
}
