import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route protection and session refresh.
 *
 * Every page used to be reachable without signing in, which is fine for a
 * single-user install and wrong for a shared one. When Supabase is configured
 * the app requires a session; when it is not, the app stays open so a local
 * self-hosted install keeps working without an account.
 */

/** Reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = ['/sign-up-login', '/auth', '/shared'];

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const configured = !!url && !!key && !url.includes('dummy') && !key.includes('updateyour');

  // Local install with no auth backend: leave everything open.
  if (!configured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url!, key!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options as never);
        }
      },
    },
  });

  // Refreshes an expiring session as a side effect — do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // API routes enforce auth themselves and answer with JSON. Redirecting them
  // to an HTML sign-in page would hand callers a 307 and an unparseable body.
  if (pathname.startsWith('/api/')) return response;

  if (!user && !isPublic(pathname)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = '/sign-up-login';
    signIn.searchParams.set('next', pathname);
    return NextResponse.redirect(signIn);
  }

  // A signed-in user has no reason to sit on the sign-in page.
  if (user && pathname === '/sign-up-login') {
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = '/sessions-dashboard';
    dashboard.search = '';
    return NextResponse.redirect(dashboard);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    '/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
