import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// This route bootstraps admin: sets the earliest registered user as the sole admin.
// Only callable by the current signed-in user; the DB function enforces the logic.

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call the bootstrap_admin DB function
    const { error } = await supabase.rpc('bootstrap_admin');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return the current user's admin status
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin, email')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      isAdmin: profile?.is_admin ?? false,
      email: profile?.email,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ isAdmin: false });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    return NextResponse.json({ isAdmin: profile?.is_admin ?? false });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
