import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /auth/callback
 * Where Supabase sends the browser from an email link: sign-up confirmation or
 * password reset. Swaps the one-time code (or token hash) for a session
 * cookie, then continues to `next` (same-origin paths only, so this cannot be
 * used as an open redirect).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') ?? '/sessions-dashboard';
  const next =
    nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/sessions-dashboard';

  const providerError = searchParams.get('error_description') || searchParams.get('error');
  if (providerError) {
    const back = new URL('/sign-up-login', origin);
    back.searchParams.set('auth_error', providerError);
    return NextResponse.redirect(back);
  }

  // Email templates that link with ?token_hash=…&type=… work from any browser,
  // unlike ?code=, which needs the browser that started the flow.
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (tokenHash && type) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    const target = type === 'recovery' ? '/reset-password' : next;
    if (!error) return NextResponse.redirect(new URL(target, origin));

    const back = new URL('/sign-up-login', origin);
    back.searchParams.set('auth_error', error.message);
    return NextResponse.redirect(back);
  }

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));

    const back = new URL('/sign-up-login', origin);
    back.searchParams.set('auth_error', error.message);
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(new URL('/sign-up-login', origin));
}
