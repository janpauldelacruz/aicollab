'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import Step1SessionConfig from './Step1SessionConfig';
import Step2AgentRoster from './Step2AgentRoster';
import Step3ReviewLaunch from './Step3ReviewLaunch';
import { useAuth } from '@/contexts/AuthContext';
import { createSession } from '@/lib/supabase/sessionService';
import { trackEvent } from '@/lib/supabase/sessionService';

export type SessionMode = 'brainstorm' | 'code' | 'build' | 'chat';
export type AgentRole = 'brainstormer' | 'coder' | 'pm' | 'designer' | 'critic' | 'researcher' | 'architect';
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
  const router = useRouter();
  const { user } = useAuth();

  const handleLaunch = async () => {
    setIsLaunching(true);
    try {
      // Save agents to sessionStorage so LiveChatroomClient can pick them up
      if (typeof window !== 'undefined' && config.agents.length >= 2) {
        window.sessionStorage.setItem('sessionAgents', JSON.stringify(config.agents));
      }

      // Persist session to Supabase if user is logged in
      let sessionId: string | null = null;
      if (user) {
        const dbSession = await createSession(config, user.id);
        if (dbSession) {
          sessionId = dbSession.id;
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('currentSessionId', dbSession.id);
          }
          await trackEvent('session_start', user.id, dbSession.id, {
            mode: config.mode,
            agentCount: config.agents.length,
            topic: config.topic,
            models: config.agents.map((a) => a.model),
          });
        }
      }

      toast.success(`Session "${config.name}" launched! Agents are initializing…`);
      router.push('/live-chatroom');
    } catch (err: any) {
      toast.error(`Failed to launch session: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New Session</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your AI agent team and define the collaboration task</p>
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
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                i < step ? 'bg-positive text-white' : i === step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}>
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