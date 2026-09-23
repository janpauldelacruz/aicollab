'use client';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import AgentNetworkViz from './AgentNetworkViz';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase/client';

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
  const router = useRouter();
  // Middleware appends ?next= when it bounces an unauthenticated request.
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
      // Supabase may require email confirmation before a session exists.
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
      <div className="hidden lg:flex flex-col flex-1 gradient-auth-left relative overflow-hidden p-12">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-5"
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
                  className="px-3 py-1.5 rounded-full border border-border bg-card/40 text-xs text-muted-foreground backdrop-blur-sm"
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
      <div className="w-full lg:w-[440px] flex flex-col bg-card lg:border-l border-border">
        <div className="flex-1 flex flex-col justify-center px-8 py-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <AppLogo size={32} />
            <span className="font-semibold text-lg text-foreground">AICollab</span>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-muted rounded-xl p-1 mb-8">
            {(['login', 'signup'] as AuthTab[]).map((t) => (
              <button
                key={`tab-${t}`}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  tab === t
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Only true when there is no auth backend; with Supabase set up the
              app has real accounts, so showing this would be misleading. */}
          {!isSupabaseConfigured && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
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
                <button type="button" className="btn-secondary gap-2 text-xs">
                  <Icon name="GlobeAltIcon" size={15} className="text-muted-foreground" />
                  Google
                </button>
                <button type="button" className="btn-secondary gap-2 text-xs">
                  <Icon name="CodeBracketIcon" size={15} className="text-muted-foreground" />
                  GitHub
                </button>
              </div>

              <div className="flex items-center gap-3">
                <hr className="flex-1 border-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <hr className="flex-1 border-border" />
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
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-negative mt-1">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-3.5 h-3.5 rounded border-border bg-input accent-primary"
                  {...loginForm.register('remember')}
                />
                <label htmlFor="remember" className="text-xs text-muted-foreground cursor-pointer">
                  Remember me for 30 days
                </label>
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 mt-2">
                {isLoading ? (
                  <>
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    Signing in…
                  </>
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
                  Start collaborating with AI agents today
                </p>
              </div>

              {/* OAuth */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" className="btn-secondary gap-2 text-xs">
                  <Icon name="GlobeAltIcon" size={15} className="text-muted-foreground" />
                  Google
                </button>
                <button type="button" className="btn-secondary gap-2 text-xs">
                  <Icon name="CodeBracketIcon" size={15} className="text-muted-foreground" />
                  GitHub
                </button>
              </div>

              <div className="flex items-center gap-3">
                <hr className="flex-1 border-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <hr className="flex-1 border-border" />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  placeholder="Jamie Lin"
                  className="input-base"
                  {...signupForm.register('name', { required: 'Name is required' })}
                />
                {signupForm.formState.errors.name && (
                  <p className="text-xs text-negative mt-1">
                    {signupForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="input-base"
                  {...signupForm.register('email', { required: 'Email is required' })}
                />
                {signupForm.formState.errors.email && (
                  <p className="text-xs text-negative mt-1">
                    {signupForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    className="input-base pr-10"
                    {...signupForm.register('password', {
                      required: 'Password is required',
                      minLength: { value: 8, message: 'Minimum 8 characters' },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
                {signupForm.formState.errors.password && (
                  <p className="text-xs text-negative mt-1">
                    {signupForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input-base pr-10"
                    {...signupForm.register('confirmPassword', {
                      required: 'Please confirm your password',
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name={showConfirmPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
                {signupForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-negative mt-1">
                    {signupForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  className="w-3.5 h-3.5 rounded border-border bg-input accent-primary mt-0.5"
                  {...signupForm.register('terms', { required: 'You must accept the terms' })}
                />
                <label
                  htmlFor="terms"
                  className="text-xs text-muted-foreground cursor-pointer leading-relaxed"
                >
                  I agree to the{' '}
                  <span className="text-primary hover:underline cursor-pointer">
                    Terms of Service
                  </span>{' '}
                  and{' '}
                  <span className="text-primary hover:underline cursor-pointer">
                    Privacy Policy
                  </span>
                </label>
              </div>
              {signupForm.formState.errors.terms && (
                <p className="text-xs text-negative">{signupForm.formState.errors.terms.message}</p>
              )}

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5">
                {isLoading ? (
                  <>
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" /> Creating
                    account…
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
