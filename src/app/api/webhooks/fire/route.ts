import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

function serverSupabase(cookieStore: any) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value, options }: any) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export type WebhookEvent = 'on_start' | 'on_complete' | 'on_error';

export interface WebhookPayload {
  event: WebhookEvent;
  session_id: string;
  session_name: string;
  session_topic: string;
  session_status: string;
  turn_count?: number;
  message_count?: number;
  artifact_count?: number;
  elapsed_seconds?: number;
  completion_pct?: number;
  error_message?: string;
  timestamp: string;
}

async function deliverWebhook(
  webhookId: string,
  webhookUrl: string,
  secret: string | null,
  payload: WebhookPayload,
  sessionId: string,
  supabase: any
): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-AICollab-Event': payload.event,
    'X-AICollab-Timestamp': payload.timestamp,
  };

  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-AICollab-Signature'] = `sha256=${sig}`;
  }

  let statusCode = 0;
  let responseBody = '';
  let success = false;

  try {
    const res = await fetch(webhookUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
    statusCode = res.status;
    responseBody = await res.text().catch(() => '');
    success = res.ok;
  } catch (err: any) {
    responseBody = err?.message || 'Request failed';
  }

  // Log delivery
  await supabase.from('webhook_deliveries').insert({
    webhook_id: webhookId,
    session_id: sessionId,
    event: payload.event,
    payload,
    status_code: statusCode,
    response_body: responseBody.slice(0, 2000),
    success,
  });

  // Update webhook stats
  await supabase
    .from('session_webhooks')
    .update({
      last_fired_at: payload.timestamp,
      last_status: statusCode,
      fire_count: supabase.rpc ? undefined : undefined, // handled below
      updated_at: new Date().toISOString(),
    })
    .eq('id', webhookId);

  await supabase.rpc('increment_webhook_fire_count', { webhook_id: webhookId }).catch(() => {
    // fallback: just update last_fired_at
  });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = serverSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { event: WebhookEvent; session_id: string; payload?: Partial<WebhookPayload> };
  const { event, session_id, payload: extra } = body;

  if (!event || !session_id) {
    return NextResponse.json({ error: 'event and session_id are required' }, { status: 400 });
  }

  // Get session
  const { data: session } = await supabase
    .from('collab_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('user_id', user.id)
    .single();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Get active webhooks for this user that include this event
  const { data: webhooks } = await supabase
    .from('session_webhooks')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .contains('events', [event]);

  if (!webhooks || webhooks.length === 0) {
    return NextResponse.json({ fired: 0, message: 'No active webhooks for this event' });
  }

  const webhookPayload: WebhookPayload = {
    event,
    session_id: session.id,
    session_name: session.name,
    session_topic: session.topic,
    session_status: session.session_status,
    turn_count: session.turn_count,
    message_count: session.message_count,
    artifact_count: session.artifact_count,
    elapsed_seconds: session.elapsed_seconds,
    completion_pct: session.completion_pct,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  // Fire all webhooks in parallel (non-blocking)
  await Promise.allSettled(
    webhooks.map((wh: any) =>
      deliverWebhook(wh.id, wh.url, wh.secret, webhookPayload, session_id, supabase)
    )
  );

  return NextResponse.json({ fired: webhooks.length });
}
