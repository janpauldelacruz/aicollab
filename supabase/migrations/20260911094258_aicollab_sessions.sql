-- AICollab: Sessions, Agents, Transcripts, Artifacts, Share Links, Analytics
-- Migration: 20260911094258_aicollab_sessions.sql

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================
DROP TYPE IF EXISTS public.session_mode CASCADE;
CREATE TYPE public.session_mode AS ENUM ('brainstorm', 'code', 'build', 'chat');

DROP TYPE IF EXISTS public.session_status CASCADE;
CREATE TYPE public.session_status AS ENUM ('draft', 'running', 'paused', 'completed', 'stopped');

DROP TYPE IF EXISTS public.message_type CASCADE;
CREATE TYPE public.message_type AS ENUM ('message', 'code', 'decision', 'question', 'artifact');

DROP TYPE IF EXISTS public.artifact_type CASCADE;
CREATE TYPE public.artifact_type AS ENUM ('code', 'document', 'diagram', 'decision', 'spec');

DROP TYPE IF EXISTS public.analytics_event_type CASCADE;
CREATE TYPE public.analytics_event_type AS ENUM (
  'session_start', 'session_pause', 'session_resume', 'session_stop', 'session_complete',
  'artifact_export', 'share_link_created', 'share_link_accessed',
  'agent_turn', 'artifact_created'
);

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- Sessions table
CREATE TABLE IF NOT EXISTS public.collab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Session',
  mode public.session_mode NOT NULL DEFAULT 'build',
  topic TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  max_turns INTEGER NOT NULL DEFAULT 50,
  turn_timeout INTEGER NOT NULL DEFAULT 30,
  session_status public.session_status NOT NULL DEFAULT 'draft',
  turn_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  artifact_count INTEGER NOT NULL DEFAULT 0,
  agent_count INTEGER NOT NULL DEFAULT 0,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  completion_pct INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Session agents
CREATE TABLE IF NOT EXISTS public.session_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.collab_sessions(id) ON DELETE CASCADE,
  agent_key TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'researcher',
  model TEXT NOT NULL,
  personality TEXT NOT NULL DEFAULT '',
  creativity NUMERIC NOT NULL DEFAULT 0.7,
  verbosity NUMERIC NOT NULL DEFAULT 0.5,
  assertiveness NUMERIC NOT NULL DEFAULT 0.5,
  system_prompt TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#6366f1',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Session messages (transcript)
CREATE TABLE IF NOT EXISTS public.session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.collab_sessions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  agent_color TEXT NOT NULL DEFAULT '#6366f1',
  content TEXT NOT NULL,
  message_type public.message_type NOT NULL DEFAULT 'message',
  code_language TEXT,
  reply_to TEXT,
  artifact_id TEXT,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Session artifacts
CREATE TABLE IF NOT EXISTS public.session_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.collab_sessions(id) ON DELETE CASCADE,
  artifact_key TEXT NOT NULL,
  name TEXT NOT NULL,
  artifact_type public.artifact_type NOT NULL DEFAULT 'document',
  content TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Share links
CREATE TABLE IF NOT EXISTS public.session_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.collab_sessions(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'Shared Link',
  allow_rerun BOOLEAN NOT NULL DEFAULT true,
  access_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Analytics events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.collab_sessions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  event_type public.analytics_event_type NOT NULL,
  agent_model TEXT,
  agent_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_collab_sessions_user_id ON public.collab_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_collab_sessions_status ON public.collab_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_collab_sessions_created_at ON public.collab_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_agents_session_id ON public.session_agents(session_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_session_id ON public.session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_created_at ON public.session_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_session_artifacts_session_id ON public.session_artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_share_links_token ON public.session_share_links(token);
CREATE INDEX IF NOT EXISTS idx_session_share_links_session_id ON public.session_share_links(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);

-- ============================================================
-- 4. FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Function to get session with computed fields
CREATE OR REPLACE FUNCTION public.get_session_completion_pct(p_turn_count INTEGER, p_max_turns INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT CASE WHEN p_max_turns > 0 THEN LEAST(100, (p_turn_count * 100 / p_max_turns)) ELSE 0 END;
$$;

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
ALTER TABLE public.collab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- collab_sessions: owner access
DROP POLICY IF EXISTS "users_manage_own_collab_sessions" ON public.collab_sessions;
CREATE POLICY "users_manage_own_collab_sessions"
ON public.collab_sessions FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- collab_sessions: public read via share link (handled in app layer)
DROP POLICY IF EXISTS "public_read_shared_sessions" ON public.collab_sessions;
CREATE POLICY "public_read_shared_sessions"
ON public.collab_sessions FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.session_share_links sl
    WHERE sl.session_id = collab_sessions.id
      AND (sl.expires_at IS NULL OR sl.expires_at > CURRENT_TIMESTAMP)
  )
);

-- session_agents: owner access
DROP POLICY IF EXISTS "users_manage_own_session_agents" ON public.session_agents;
CREATE POLICY "users_manage_own_session_agents"
ON public.session_agents FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.collab_sessions cs WHERE cs.id = session_agents.session_id AND cs.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.collab_sessions cs WHERE cs.id = session_agents.session_id AND cs.user_id = auth.uid())
);

-- session_agents: public read via share link
DROP POLICY IF EXISTS "public_read_shared_session_agents" ON public.session_agents;
CREATE POLICY "public_read_shared_session_agents"
ON public.session_agents FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.session_share_links sl
    WHERE sl.session_id = session_agents.session_id
      AND (sl.expires_at IS NULL OR sl.expires_at > CURRENT_TIMESTAMP)
  )
);

-- session_messages: owner access
DROP POLICY IF EXISTS "users_manage_own_session_messages" ON public.session_messages;
CREATE POLICY "users_manage_own_session_messages"
ON public.session_messages FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.collab_sessions cs WHERE cs.id = session_messages.session_id AND cs.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.collab_sessions cs WHERE cs.id = session_messages.session_id AND cs.user_id = auth.uid())
);

-- session_messages: public read via share link
DROP POLICY IF EXISTS "public_read_shared_session_messages" ON public.session_messages;
CREATE POLICY "public_read_shared_session_messages"
ON public.session_messages FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.session_share_links sl
    WHERE sl.session_id = session_messages.session_id
      AND (sl.expires_at IS NULL OR sl.expires_at > CURRENT_TIMESTAMP)
  )
);

-- session_artifacts: owner access
DROP POLICY IF EXISTS "users_manage_own_session_artifacts" ON public.session_artifacts;
CREATE POLICY "users_manage_own_session_artifacts"
ON public.session_artifacts FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.collab_sessions cs WHERE cs.id = session_artifacts.session_id AND cs.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.collab_sessions cs WHERE cs.id = session_artifacts.session_id AND cs.user_id = auth.uid())
);

-- session_artifacts: public read via share link
DROP POLICY IF EXISTS "public_read_shared_session_artifacts" ON public.session_artifacts;
CREATE POLICY "public_read_shared_session_artifacts"
ON public.session_artifacts FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.session_share_links sl
    WHERE sl.session_id = session_artifacts.session_id
      AND (sl.expires_at IS NULL OR sl.expires_at > CURRENT_TIMESTAMP)
  )
);

-- session_share_links: owner manage
DROP POLICY IF EXISTS "users_manage_own_session_share_links" ON public.session_share_links;
CREATE POLICY "users_manage_own_session_share_links"
ON public.session_share_links FOR ALL TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- session_share_links: public read (to validate tokens)
DROP POLICY IF EXISTS "public_read_session_share_links" ON public.session_share_links;
CREATE POLICY "public_read_session_share_links"
ON public.session_share_links FOR SELECT TO anon
USING (true);

-- analytics_events: owner insert/read
DROP POLICY IF EXISTS "users_manage_own_analytics_events" ON public.analytics_events;
CREATE POLICY "users_manage_own_analytics_events"
ON public.analytics_events FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 7. TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS update_collab_sessions_updated_at ON public.collab_sessions;
CREATE TRIGGER update_collab_sessions_updated_at
  BEFORE UPDATE ON public.collab_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
