import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';
import {
  deleteUserKey,
  listUserKeys,
  rotateUserKey,
  saveUserKey,
  setKeyActive,
} from '@/lib/supabase/keyVault';
import { isEncryptionConfigured } from '@/lib/crypto/secretBox';

export const dynamic = 'force-dynamic';

/**
 * Managing the API keys a user brings with them.
 *
 * Raw keys are accepted here, encrypted, and never sent back — responses carry
 * only a hint like "sk-pr…4f2a". The browser therefore never holds a usable
 * credential after submission.
 */

function notConfigured() {
  return NextResponse.json(
    {
      error: 'Key storage is not configured',
      details: 'Set ENCRYPTION_KEY and the Supabase variables in .env before storing credentials.',
    },
    { status: 503 }
  );
}

function unauthorised() {
  return NextResponse.json(
    { error: 'Sign in required', details: 'Only a signed-in user can manage API keys.' },
    { status: 401 }
  );
}

function failed(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Key vault error:', message);
  return NextResponse.json({ error: 'Key operation failed', details: message }, { status: 500 });
}

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return unauthorised();

  try {
    return NextResponse.json({ keys: await listUserKeys(user.id) });
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isEncryptionConfigured()) return notConfigured();

  const user = await getAuthedUser();
  if (!user) return unauthorised();

  try {
    const { provider, label, rawKey } = await request.json();
    if (!provider || !rawKey) {
      return NextResponse.json(
        { error: 'provider and rawKey are required', details: 'Request validation failed' },
        { status: 400 }
      );
    }

    const key = await saveUserKey({ userId: user.id, provider, label: label ?? '', rawKey });
    return NextResponse.json({ key });
  } catch (error) {
    return failed(error);
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorised();

  try {
    const { keyId, rawKey, isActive } = await request.json();
    if (!keyId) {
      return NextResponse.json(
        { error: 'keyId is required', details: 'Request validation failed' },
        { status: 400 }
      );
    }

    if (typeof rawKey === 'string' && rawKey.trim()) {
      if (!isEncryptionConfigured()) return notConfigured();
      return NextResponse.json({
        key: await rotateUserKey({ userId: user.id, keyId, rawKey }),
      });
    }

    if (typeof isActive === 'boolean') {
      await setKeyActive(user.id, keyId, isActive);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: 'Nothing to update', details: 'Provide rawKey or isActive' },
      { status: 400 }
    );
  } catch (error) {
    return failed(error);
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorised();

  try {
    const keyId = new URL(request.url).searchParams.get('id');
    if (!keyId) {
      return NextResponse.json(
        { error: 'id is required', details: 'Request validation failed' },
        { status: 400 }
      );
    }

    await deleteUserKey(user.id, keyId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failed(error);
  }
}
