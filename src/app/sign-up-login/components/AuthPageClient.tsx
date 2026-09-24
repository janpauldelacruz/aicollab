'use client';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import AgentNetworkViz from './AgentNetworkViz';
import { useAuth } from '@/contexts/AuthContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

type AuthTab = 'login' | 'signup';

interface LoginForm {
  email: string;
  password: string;
  remember: boolean;
}

interface SignupForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

export default function AuthPageClient() {
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState<AuthTab>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const router = useRouter();
  const [nextPath, setNextPath] = useState('/sessions-dashboard');
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('next');
    if (target && target.startsWith('/')) setNextPath(target);
  }, []);

  const loginForm = useForm<LoginForm>({
    defaultValues: { email: '', password: '', remember: false },
  });
  const signupForm = useForm<SignupForm>({
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', terms: false },
  });

  const handleOAuth = async (provider: 'google' | 'github') => {
    if (!isSupabaseConfigured) {
      toast.error('Supabase is not configured. Set up your environment variables to enable OAuth.');
      return;
    }
    setOauthLoading(provider);
    try {
      const supabase = createClient();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'consent' } : undefined,
        },
      });
      if (error) throw error;
      // If no URL returned, the redirect didn't happen
      if (!data?.url) {
        throw new Error(`OAuth provider ${provider} did not return a redirect URL. Ensure it is enabled in your Supabase dashboard under Authentication > Providers.`);
      }
      // Redirect to OAuth provider
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err?.message || `Failed to sign in with ${provider}`);
      setOauthLoading(null);
    }
  };

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      toast.success('Welcome back to AICollab!');
      router.push(nextPath);
      router.refresh();
    } catch (err: any) {
      loginForm.setError('email', {
        message: err?.message || 'Could not sign in — check your email and password',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (data: SignupForm) => {
    setIsLoading(true);
    if (data.password !== data.confirmPassword) {
      signupForm.setError('confirmPassword', { message: 'Passwords do not match' });
      setIsLoading(false);
      return;
    }
    try {
      await signUp(data.email, data.password, { fullName: data.name });
      toast.success('Account created — check your email if confirmation is required.');
      router.push(nextPath);
      router.refresh();
    } catch (err: any) {
      signupForm.setError('email', {
        message: err?.message || 'Could not create the account',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden p-12"
        style={{ background: 'linear-gradient(135deg, #09090b 0%, #0d0b18 40%, #110e1f 70%, #0d1117 100%)' }}
      >
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 rounded-full opacity-8 blur-3xl"
          style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }} />

        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <AppLogo size={36} />
          <span className="text-xl font-semibold text-foreground tracking-tight">AICollab</span>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <AgentNetworkViz />

          <div className="mt-10 text-center max-w-sm">
            <h1 className="text-3xl font-bold text-foreground leading-tight">
              AI agents that <span className="text-gradient-primary">think, debate,</span> and build
              together
            </h1>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              Configure multi-agent teams, assign roles, and watch them collaborate on real problems
              — all in one session.
            </p>
          </div>

          {/* Feature pills */}
          <div className="mt-8 flex flex-wrap gap-2 justify-center">
            {['Brainstorm Mode', 'Code Collaboration', 'End-to-End Build', 'Open Debate'].map(
              (f) => (
                <span
                  key={`feature-${f}`}
                  className="px-3 py-1.5 rounded-full border border-border/60 bg-card/30 text-xs text-muted-foreground backdrop-blur-sm"
                >
                  {f}
                </span>
              )
            )}
          </div>
        </div>

        {/* Bottom stat row */}
        <div className="relative z-10 flex items-center gap-8">
          {[
            { value: '2.4K+', label: 'Sessions run' },
            { value: '18K+', label: 'Artifacts generated' },
            { value: '94%', label: 'Completion rate' },
          ].map((s) => (
            <div key={`stat-${s.label}`}>
              <p className="text-lg font-bold text-foreground tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-[460px] flex flex-col bg-card lg:border-l border-border relative overflow-hidden">
        {/* Subtle top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, #7c3aed60, #06b6d460, transparent)' }} />

        <div className="flex-1 flex flex-col justify-center px-8 py-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <AppLogo size={32} />
            <span className="font-semibold text-lg text-foreground">AICollab</span>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-muted/60 rounded-xl p-1 mb-8 border border-border/40">
            {(['login', 'signup'] as AuthTab[]).map((t) => (
              <button
                key={`tab-${t}`}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  tab === t
                    ? 'bg-card text-foreground shadow-sm border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {!isSupabaseConfigured && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 mb-4">
              <Icon name="ExclamationTriangleIcon" size={14} className="text-warning mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">No account backend configured.</span>{' '}
                AICollab is running as a single-user local app — every page is open and sessions
                stay in this browser. Set the Supabase variables in{' '}
                <code className="text-foreground">.env</code> to enable accounts.
              </p>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Sign in to your AICollab workspace
                </p>
              </div>

              {/* OAuth */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  disabled={oauthLoading !== null}
                  className="btn-secondary gap-2 text-xs relative overflow-hidden group disabled:opacity-60"
                >
                  {oauthLoading === 'google' ? (
                    <span className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth('github')}
                  disabled={oauthLoading !== null}
                  className="btn-secondary gap-2 text-xs disabled:opacity-60"
                >
                  {oauthLoading === 'github' ? (
                    <span className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                    </svg>
                  )}
                  GitHub
                </button>
              </div>

              <div className="flex items-center gap-3">
                <hr className="flex-1 border-border/60" />
                <span className="text-xs text-muted-foreground">or continue with email</span>
                <hr className="flex-1 border-border/60" />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="jamie@aicollab.dev"
                  className="input-base"
                  {...loginForm.register('email', { required: 'Email is required' })}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-xs text-negative mt-1">
                    {loginForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Password</label>
                  <span className="text-xs text-primary cursor-pointer hover:underline">
                    Forgot password?
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input-base pr-10"
                    {...loginForm.register('password', { required: 'Password is required' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={15} />
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-negative mt-1">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-2.5 text-sm font-medium disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #5b21b6, #7c3aed)' }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Create your account</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Join AICollab and start collaborating
                </p>
              </div>

              {/* OAuth */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  disabled={oauthLoading !== null}
                  className="btn-secondary gap-2 text-xs disabled:opacity-60"
                >
                  {oauthLoading === 'google' ? (
                    <span className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth('github')}
                  disabled={oauthLoading !== null}
                  className="btn-secondary gap-2 text-xs disabled:opacity-60"
                >
                  {oauthLoading === 'github' ? (
                    <span className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                    </svg>
                  )}
                  GitHub
                </button>
              </div>

              <div className="flex items-center gap-3">
                <hr className="flex-1 border-border/60" />
                <span className="text-xs text-muted-foreground">or continue with email</span>
                <hr className="flex-1 border-border/60" />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Full name</label>
                <input
                  type="text"
                  placeholder="Jamie Chen"
                  className="input-base"
                  {...signupForm.register('name', { required: 'Name is required' })}
                />
                {signupForm.formState.errors.name && (
                  <p className="text-xs text-negative mt-1">{signupForm.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Email address</label>
                <input
                  type="email"
                  placeholder="jamie@aicollab.dev"
                  className="input-base"
                  {...signupForm.register('email', { required: 'Email is required' })}
                />
                {signupForm.formState.errors.email && (
                  <p className="text-xs text-negative mt-1">{signupForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input-base pr-10"
                    {...signupForm.register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={15} />
                  </button>
                </div>
                {signupForm.formState.errors.password && (
                  <p className="text-xs text-negative mt-1">{signupForm.formState.errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Confirm password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input-base pr-10"
                    {...signupForm.register('confirmPassword', { required: 'Please confirm your password' })}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    <Icon name={showConfirmPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={15} />
                  </button>
                </div>
                {signupForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-negative mt-1">{signupForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-2.5 text-sm font-medium disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #5b21b6, #7c3aed)' }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}

          <p className="text-xs text-muted-foreground text-center mt-6">
            By continuing, you agree to our{' '}
            <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>
            {' '}and{' '}
            <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}