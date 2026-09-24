-- ─── Playbooks ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.playbooks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name            text NOT NULL DEFAULT 'Untitled Playbook',
  description     text NOT NULL DEFAULT '',
  orchestration_mode text NOT NULL DEFAULT 'build',
  topic           text NOT NULL DEFAULT '',
  goal            text NOT NULL DEFAULT '',
  directives      text NOT NULL DEFAULT '',
  agents          jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags            text[] NOT NULL DEFAULT ARRAY[]::text[],
  use_count       integer NOT NULL DEFAULT 0,
  is_pinned       boolean NOT NULL DEFAULT false,
  source_session_id uuid REFERENCES public.collab_sessions(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'playbooks' AND policyname = 'playbooks_owner') THEN
    CREATE POLICY playbooks_owner ON public.playbooks
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ─── Admin spend alerts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_spend_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  threshold_usd   numeric NOT NULL DEFAULT 10.0,
  window_hours    integer NOT NULL DEFAULT 24,
  is_active       boolean NOT NULL DEFAULT true,
  last_triggered  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.admin_spend_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_spend_alerts' AND policyname = 'admin_spend_alerts_admin_only') THEN
    CREATE POLICY admin_spend_alerts_admin_only ON public.admin_spend_alerts
      USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true))
      WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true));
  END IF;
END $$;

-- ─── Updated_at triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'playbooks_updated_at') THEN
    CREATE TRIGGER playbooks_updated_at BEFORE UPDATE ON public.playbooks
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
