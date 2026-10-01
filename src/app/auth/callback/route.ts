import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /auth/callback
 * Where Supabase sends the browser after Google / GitHub sign-in and after an
 * email-confirmation link. Swaps the one-time code for a session cookie, then
 * continues to `next` (same-origin paths only, so this cannot be used as an
 * open redirect).
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
