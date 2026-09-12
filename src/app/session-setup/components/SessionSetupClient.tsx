'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import Step1SessionConfig from './Step1SessionConfig';
import Step2AgentRoster from './Step2AgentRoster';
import Step3ReviewLaunch from './Step3ReviewLaunch';
import {
  clearSetupDraft,
  loadSetupDraft,
  savePendingSession,
  saveSetupDraft,
} from '@/lib/session/pendingSession';
import { drainTemplateQueue } from '@/lib/session/templateStore';
import type { StoredTemplate } from '@/lib/session/templateStore';

export type SessionMode = 'brainstorm' | 'code' | 'build' | 'chat';
export type AgentRole =
  'brainstormer' | 'coder' | 'pm' | 'designer' | 'critic' | 'researcher' | 'architect';
/** Any Ollama model tag installed on the host, e.g. "qwen2.5:14b". */
export type AgentModel = string;

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  model: AgentModel;
  personality: string;
  creativity: number;
  verbosity: number;
  assertiveness: number;
  systemPrompt: string;
}

export interface SessionConfig {
  name: string;
  mode: SessionMode;
  topic: string;
  goal: string;
  maxTurns: number;
  turnTimeout: number;
  agents: AgentConfig[];
}

const STEPS = [
  { id: 'step-1', label: 'Session Config', icon: 'Cog6ToothIcon' },
  { id: 'step-2', label: 'Agent Roster', icon: 'UsersIcon' },
  { id: 'step-3', label: 'Review & Launch', icon: 'RocketLaunchIcon' },
];

const DEFAULT_CONFIG: SessionConfig = {
  name: '',
  mode: 'build',
  topic: '',
  goal: '',
  maxTurns: 50,
  turnTimeout: 30,
  agents: [],
};

export default function SessionSetupClient() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<SessionConfig>(DEFAULT_CONFIG);
  const [isLaunching, setIsLaunching] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const router = useRouter();

  // Restore whatever was configured last time, including per-agent AI settings.
  useEffect(() => {
    const draft = loadSetupDraft<SessionConfig>();
    if (draft) {
      setConfig(draft);
      if (draft.name || draft.topic || draft.agents?.length) {
        toast.info('Restored your last session setup');
      }
    }
    setDraftLoaded(true);
  }, []);

  // Templates sent here with "Use" on the templates page join the roster.
  useEffect(() => {
    if (!draftLoaded) return;
    const queued = drainTemplateQueue();
    if (queued.length === 0) return;

    setConfig((prev) => {
      const existing = new Set(prev.agents.map((a) => a.name));
      const added = queued
        .filter((t: StoredTemplate) => !existing.has(t.name))
        .map((t: StoredTemplate, i: number) => ({
          id: `agent-tpl-${Date.now()}-${i}`,
          name: t.name,
          role: t.role as AgentRole,
          model: t.model,
          personality: t.personality,
          systemPrompt: t.systemPrompt,
          creativity: t.creativity,
          verbosity: t.verbosity,
          assertiveness: t.assertiveness,
        }));

      if (added.length === 0) return prev;
      toast.success(`Added ${added.length} agent${added.length === 1 ? '' : 's'} from templates`);
      return { ...prev, agents: [...prev.agents, ...added] };
    });
    setStep(1);
  }, [draftLoaded]);

  // Autosave so a reload never wipes the roster or the sliders.
  useEffect(() => {
    if (!draftLoaded) return;
    saveSetupDraft(config);
  }, [config, draftLoaded]);

  const handleLaunch = async () => {
    setIsLaunching(true);

    // Hand the whole config to the chatroom — the topic and roster configured
    // here are what the session must actually run with.
    savePendingSession({
      name: config.name,
      mode: config.mode,
      topic: config.topic,
      goal: config.goal,
      maxTurns: config.maxTurns,
      agents: config.agents.map((a) => ({
        name: a.name,
        role: a.role,
        model: a.model,
        personality: a.personality,
        systemPrompt: a.systemPrompt,
        creativity: a.creativity,
        verbosity: a.verbosity,
        assertiveness: a.assertiveness,
      })),
      createdAt: new Date().toISOString(),
    });

    clearSetupDraft();
    await new Promise((r) => setTimeout(r, 600));
    toast.success(`Session "${config.name}" launched! Agents are initializing…`);
    router.push('/live-chatroom');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New Session</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your AI agent team and define the collaboration task
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl transition-all duration-200 ${
                i === step
                  ? 'bg-primary/10 border border-primary/30 text-primary'
                  : i < step
                    ? 'text-foreground hover:bg-muted cursor-pointer'
                    : 'text-muted-foreground cursor-default'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                  i < step
                    ? 'bg-positive text-white'
                    : i === step
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < step ? <Icon name="CheckIcon" size={12} /> : i + 1}
              </div>
              <span className="text-sm font-medium hidden sm:block">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-positive/40' : 'bg-border'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="card-base p-6">
        {step === 0 && (
          <Step1SessionConfig
            config={config}
            onChange={(c) => setConfig({ ...config, ...c })}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <Step2AgentRoster
            agents={config.agents}
            mode={config.mode}
            onChange={(agents) => setConfig({ ...config, agents })}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step3ReviewLaunch
            config={config}
            onBack={() => setStep(1)}
            onLaunch={handleLaunch}
            isLaunching={isLaunching}
          />
        )}
      </div>
    </div>
  );
}
