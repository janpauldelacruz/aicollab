'use client';
import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for element to highlight
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  section: 'session-setup' | 'live-chatroom' | 'prompt-lab' | 'admin' | 'general';
}

interface OnboardingContextValue {
  isActive: boolean;
  currentStepIndex: number;
  steps: OnboardingStep[];
  start: () => void;
  skip: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  goTo: (idx: number) => void;
  finish: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}

// ─── Steps definition ─────────────────────────────────────────────────────────

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to AICollab 👋',
    description: 'This quick tour covers the key features to get you productive immediately. You can skip or resume at any time.',
    placement: 'center',
    section: 'general',
  },
  {
    id: 'session-setup',
    title: 'Session Setup',
    description: 'Start here to configure a new multi-agent session. Choose a mode (Brainstorm, Build, Code, Chat), set your topic and goal, then assemble your agent roster.',
    target: '[data-onboard="session-setup"]',
    placement: 'right',
    section: 'session-setup',
  },
  {
    id: 'agent-roster',
    title: 'Agent Roster',
    description: 'Add 2–6 AI agents with distinct roles — Architect, Coder, PM, Designer, Critic. Each agent has its own model, personality, and system prompt.',
    target: '[data-onboard="agent-roster"]',
    placement: 'right',
    section: 'session-setup',
  },
  {
    id: 'live-chatroom',
    title: 'Live Chatroom',
    description: 'Watch agents collaborate in real time. Use the Orchestration Panel to pause, inject messages, or adjust agent behavior mid-session.',
    target: '[data-onboard="live-chatroom"]',
    placement: 'right',
    section: 'live-chatroom',
  },
  {
    id: 'prompt-lab',
    title: 'Prompt Lab',
    description: 'Test prompts across multiple models simultaneously. Compare token usage, cost, speed, and output quality side-by-side with built-in charts.',
    target: '[data-onboard="prompt-lab"]',
    placement: 'right',
    section: 'prompt-lab',
  },
  {
    id: 'session-replay',
    title: 'Session Replay',
    description: 'Replay any completed session step-by-step. Use speed controls (0.5×–10×) and the agent timeline scrubber to audit decisions without re-running.',
    target: '[data-onboard="session-replay"]',
    placement: 'right',
    section: 'general',
  },
  {
    id: 'admin',
    title: 'Admin Dashboard',
    description: 'Track all users\' token spend, session activity, agent performance, and cost per model. Set real-time alerts when spending exceeds thresholds.',
    target: '[data-onboard="admin-dashboard"]',
    placement: 'right',
    section: 'admin',
  },
  {
    id: 'done',
    title: 'You\'re all set! 🚀',
    description: 'Start your first session, explore the Prompt Lab, or check out the Playbooks to repeat complex workflows in one click.',
    placement: 'center',
    section: 'general',
  },
];

const STORAGE_KEY = 'aicollab_onboarding_v1';

interface StoredState {
  completed: boolean;
  skipped: boolean;
  stepIndex: number;
}

function loadState(): StoredState {
  if (typeof window === 'undefined') return { completed: false, skipped: false, stepIndex: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { completed: false, skipped: false, stepIndex: 0 };
  } catch {
    return { completed: false, skipped: false, stepIndex: 0 };
  }
}

function saveState(state: StoredState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Tooltip positioning ──────────────────────────────────────────────────────

interface TooltipPos {
  top: number;
  left: number;
  arrowSide?: 'top' | 'bottom' | 'left' | 'right';
}

function getTooltipPosition(target: Element | null, placement: OnboardingStep['placement']): TooltipPos {
  if (!target || placement === 'center') {
    return { top: window.innerHeight / 2 - 120, left: window.innerWidth / 2 - 180 };
  }
  const rect = target.getBoundingClientRect();
  const TW = 360;
  const TH = 180;
  const GAP = 14;

  switch (placement) {
    case 'right':
      return { top: rect.top + rect.height / 2 - TH / 2, left: rect.right + GAP, arrowSide: 'left' };
    case 'left':
      return { top: rect.top + rect.height / 2 - TH / 2, left: rect.left - TW - GAP, arrowSide: 'right' };
    case 'bottom':
      return { top: rect.bottom + GAP, left: rect.left + rect.width / 2 - TW / 2, arrowSide: 'top' };
    case 'top':
    default:
      return { top: rect.top - TH - GAP, left: rect.left + rect.width / 2 - TW / 2, arrowSide: 'bottom' };
  }
}

// ─── Tooltip component ────────────────────────────────────────────────────────

function OnboardingTooltip({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onFinish,
}: {
  step: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const [pos, setPos] = useState<TooltipPos>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(false);
    const compute = () => {
      const target = step.target ? document.querySelector(step.target) : null;
      const p = getTooltipPosition(target, step.placement);
      // Clamp to viewport
      const TW = 360;
      const TH = 200;
      p.left = Math.max(12, Math.min(p.left, window.innerWidth - TW - 12));
      p.top = Math.max(12, Math.min(p.top, window.innerHeight - TH - 12));
      setPos(p);
      setMounted(true);
    };
    const raf = requestAnimationFrame(compute);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  const sectionColors: Record<string, string> = {
    'session-setup': '#6366f1',
    'live-chatroom': '#10b981',
    'prompt-lab': '#f59e0b',
    admin: '#ef4444',
    general: '#8b5cf6',
  };
  const accent = sectionColors[step.section] || '#6366f1';

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] w-[360px] pointer-events-auto"
      style={{ top: pos.top, left: pos.left, opacity: mounted ? 1 : 0, transition: 'opacity 0.2s ease, top 0.25s cubic-bezier(0.34,1.56,0.64,1), left 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      {/* Arrow */}
      {pos.arrowSide === 'left' && (
        <div className="absolute left-[-7px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-b-[7px] border-r-[7px] border-t-transparent border-b-transparent" style={{ borderRightColor: 'var(--card)' }} />
      )}
      {pos.arrowSide === 'right' && (
        <div className="absolute right-[-7px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-b-[7px] border-l-[7px] border-t-transparent border-b-transparent" style={{ borderLeftColor: 'var(--card)' }} />
      )}
      {pos.arrowSide === 'top' && (
        <div className="absolute top-[-7px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-l-transparent border-r-transparent" style={{ borderBottomColor: 'var(--card)' }} />
      )}
      {pos.arrowSide === 'bottom' && (
        <div className="absolute bottom-[-7px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-t-[7px] border-l-transparent border-r-transparent" style={{ borderTopColor: 'var(--card)' }} />
      )}

      <div
        className="bg-card border rounded-xl shadow-2xl overflow-hidden"
        style={{ borderColor: `${accent}44` }}
      >
        {/* Top accent bar */}
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />

        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground leading-snug">{step.title}</h3>
            <button
              onClick={onSkip}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-0.5"
              title="Skip tour"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>

          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={`dot-${i}`}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === stepIndex ? 16 : 6,
                  height: 6,
                  backgroundColor: i === stepIndex ? accent : i < stepIndex ? `${accent}66` : 'var(--muted)',
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={onPrev}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Back
                </button>
              )}
              {isLast ? (
                <button
                  onClick={onFinish}
                  className="btn-primary text-xs px-4 py-1.5"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
                >
                  Get Started
                </button>
              ) : (
                <button
                  onClick={onNext}
                  className="btn-primary text-xs px-4 py-1.5"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Spotlight overlay ────────────────────────────────────────────────────────

function SpotlightOverlay({ target }: { target: string | undefined }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!target) { setRect(null); return; }
    const el = document.querySelector(target);
    if (el) {
      setRect(el.getBoundingClientRect());
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      setRect(null);
    }
  }, [target]);

  if (!rect) {
    return <div className="fixed inset-0 z-[9998] bg-black/50 pointer-events-none" />;
  }

  const PAD = 8;
  const x = rect.left - PAD;
  const y = rect.top - PAD;
  const w = rect.width + PAD * 2;
  const h = rect.height + PAD * 2;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      <svg width="100%" height="100%" className="absolute inset-0">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={x} y={y} width={w} height={h} rx={10} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#spotlight-mask)" />
        <rect x={x} y={y} width={w} height={h} rx={10} fill="none" stroke="rgba(99,102,241,0.7)" strokeWidth="2" />
      </svg>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const state = loadState();
    if (!state.completed && !state.skipped) {
      // Auto-start for first-time users after a short delay
      const timer = setTimeout(() => {
        setCurrentStepIndex(state.stepIndex || 0);
        setIsActive(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const start = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
    saveState({ completed: false, skipped: false, stepIndex: 0 });
  }, []);

  const skip = useCallback(() => {
    setIsActive(false);
    saveState({ completed: false, skipped: true, stepIndex: currentStepIndex });
  }, [currentStepIndex]);

  const resume = useCallback(() => {
    const state = loadState();
    setCurrentStepIndex(state.stepIndex || 0);
    setIsActive(true);
  }, []);

  const next = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = Math.min(prev + 1, ONBOARDING_STEPS.length - 1);
      saveState({ completed: false, skipped: false, stepIndex: next });
      return next;
    });
  }, []);

  const prev = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goTo = useCallback((idx: number) => {
    setCurrentStepIndex(Math.max(0, Math.min(idx, ONBOARDING_STEPS.length - 1)));
  }, []);

  const finish = useCallback(() => {
    setIsActive(false);
    saveState({ completed: true, skipped: false, stepIndex: ONBOARDING_STEPS.length - 1 });
  }, []);

  const currentStep = ONBOARDING_STEPS[currentStepIndex];

  return (
    <OnboardingContext.Provider value={{ isActive, currentStepIndex, steps: ONBOARDING_STEPS, start, skip, resume, next, prev, goTo, finish }}>
      {children}
      {isMounted && isActive && createPortal(
        <>
          <SpotlightOverlay target={currentStep?.target} />
          <OnboardingTooltip
            step={currentStep}
            stepIndex={currentStepIndex}
            totalSteps={ONBOARDING_STEPS.length}
            onNext={next}
            onPrev={prev}
            onSkip={skip}
            onFinish={finish}
          />
        </>,
        document.body
      )}
    </OnboardingContext.Provider>
  );
}

// ─── Resume button (shown when tour was skipped) ──────────────────────────────

export function OnboardingResumeButton() {
  const { isActive, resume, start } = useOnboarding();
  const [showResume, setShowResume] = useState(false);

  useEffect(() => {
    const state = loadState();
    setShowResume(state.skipped && !state.completed);
  }, [isActive]);

  if (isActive || !showResume) return null;

  return (
    <button
      onClick={resume}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all duration-150"
      title="Resume onboarding tour"
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 4.5l3 2-3 2V4.5z" fill="currentColor" />
      </svg>
      Resume Tour
    </button>
  );
}
