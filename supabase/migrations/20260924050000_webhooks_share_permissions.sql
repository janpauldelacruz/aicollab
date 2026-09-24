-- ─── Webhooks ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_webhooks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL DEFAULT 'My Webhook',
  url           text NOT NULL,
  secret        text,
  events        text[] NOT NULL DEFAULT ARRAY['on_start','on_complete','on_error'],
  is_active     boolean NOT NULL DEFAULT true,
  last_fired_at timestamptz,
  last_status   int,
  fire_count    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own webhooks"
  ON public.session_webhooks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Webhook delivery log ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id    uuid NOT NULL REFERENCES public.session_webhooks(id) ON DELETE CASCADE,
  session_id    uuid REFERENCES public.collab_sessions(id) ON DELETE SET NULL,
  event         text NOT NULL,
  payload       jsonb,
  status_code   int,
  response_body text,
  delivered_at  timestamptz NOT NULL DEFAULT now(),
  success       boolean NOT NULL DEFAULT false
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own webhook deliveries"
  ON public.webhook_deliveries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.session_webhooks w
      WHERE w.id = webhook_id AND w.user_id = auth.uid()
    )
  );

-- ─── Enhanced share link permissions ─────────────────────────────────────────
-- Add permission_level column to session_share_links if it doesn't exist

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'session_share_links'
      AND column_name = 'permission_level'
  ) THEN
    ALTER TABLE public.session_share_links
      ADD COLUMN permission_level text NOT NULL DEFAULT 'final_results';
  END IF;
END $$;

-- permission_level values: 'live_progress' | 'final_results'
-- live_progress: viewer sees real-time messages as they arrive
-- final_results: viewer only sees completed session data
