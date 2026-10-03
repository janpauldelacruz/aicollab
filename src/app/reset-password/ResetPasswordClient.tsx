'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const MIN_LENGTH = 8;

/**
 * Landing page for the "forgot password" email. The link goes through
 * /auth/callback, which exchanges its one-time code for a session, so by the
 * time this renders the user is signed in and only needs to pick a password.
 * Without a session the link was expired, already used, or opened in another
 * browser — the user is sent back to request a fresh one.
 */
export default function ResetPasswordClient() {
  const { user, loading, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await updatePassword(password);
      toast.success('Password updated — you are signed in.');
      router.push('/sessions-dashboard');
      router.refresh();
    } catch (err: any) {
      const message: string = err?.message || 'Could not update the password';
      setError(
        /different from the old/i.test(message)
          ? 'Pick a password different from your old one.'
          : message
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 space-y-6">
        <div className="flex items-center gap-2.5">
          <AppLogo size={30} />
          <span className="font-semibold text-lg text-foreground">AICollab</span>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Checking your reset link…</p>
        ) : !user ? (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Link expired</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                This reset link has expired, was already used, or was opened in a different browser
                from the one that requested it. Request a new one and open it here.
              </p>
            </div>
            <Link href="/sign-up-login" className="btn-primary w-full py-2.5 justify-center">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Set a new password</h1>
              <p className="text-sm text-muted-foreground mt-1">
                For <span className="text-foreground font-medium">{user.email}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`Min. ${MIN_LENGTH} characters`}
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  <Icon name={show ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Confirm new password
              </label>
              <input
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="input-base"
              />
            </div>

            {error && <p className="text-xs text-negative">{error}</p>}

            <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
              {saving ? (
                <>
                  <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                  Saving…
                </>
              ) : (
                'Save new password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
