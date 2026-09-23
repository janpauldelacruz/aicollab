import { NextRequest, NextResponse } from 'next/server';

/**
 * Protection for the AI routes.
 *
 * On a private machine these routes are harmless. The moment the app is
 * reachable by anyone else they become an open relay: a stranger can spend the
 * configured API credits or drive the host's GPU. Both guards below are off by
 * default so local use is unchanged, and switch on when the app is shared.
 */

const ACCESS_TOKEN = process.env.AICOLLAB_ACCESS_TOKEN?.trim();

/** Requests per window, per client. Generous enough for a real session. */
const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;

const hits = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

/** Drops expired buckets so the map cannot grow without bound. */
function sweep(now: number): void {
  if (hits.size < 500) return;
  for (const [key, bucket] of hits) {
    if (bucket.resetAt <= now) hits.delete(key);
  }
}

export interface GuardFailure {
  response: NextResponse;
}

/**
 * Returns a response to send back when the request should be rejected, or null
 * when it may proceed.
 */
export function guardAIRequest(request: NextRequest): GuardFailure | null {
  // 1. Shared-deployment token, when the operator has set one.
  if (ACCESS_TOKEN) {
    const provided =
      request.headers.get('x-aicollab-token') || request.cookies.get('aicollab_token')?.value || '';

    if (provided !== ACCESS_TOKEN) {
      return {
        response: NextResponse.json(
          {
            error: 'Not authorised',
            details:
              'This deployment requires an access token. Set the aicollab_token cookie or the x-aicollab-token header.',
          },
          { status: 401 }
        ),
      };
    }
  }

  // 2. Rate limit, always on — a runaway client should not be able to pin the GPU.
  const now = Date.now();
  sweep(now);

  const key = clientKey(request);
  const bucket = hits.get(key);

  if (!bucket || bucket.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return {
      response: NextResponse.json(
        {
          error: 'Too many requests',
          details: `Limit is ${RATE_LIMIT} requests per minute. Retry in ${retryAfter}s.`,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      ),
    };
  }

  return null;
}
