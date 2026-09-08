'use client';
import React from 'react';
import { useForm } from 'react-hook-form';
import Icon from '@/components/ui/AppIcon';
import type { SessionConfig, SessionMode } from './SessionSetupClient';

interface Props {
  config: SessionConfig;
  onChange: (partial: Partial<SessionConfig>) => void;
  onNext: () => void;
}

const MODES: { value: SessionMode; label: string; description: string; icon: string; color: string }[] = [
  { value: 'build', label: 'Build', description: 'Agents take roles and produce real deliverables end-to-end', icon: 'WrenchScrewdriverIcon', color: 'border-violet-500/40 bg-violet-500/5 text-violet-400' },
  { value: 'brainstorm', label: 'Brainstorm', description: 'Agents debate and generate creative ideas on a topic', icon: 'LightBulbIcon', color: 'border-amber-500/40 bg-amber-500/5 text-amber-400' },
  { value: 'code', label: 'Code', description: 'Agents collaborate to plan, write, and review code', icon: 'CodeBracketIcon', color: 'border-cyan-500/40 bg-cyan-500/5 text-cyan-400' },
  { value: 'chat', label: 'Open Chat', description: 'Agents have free-form conversation on any topic', icon: 'ChatBubbleOvalLeftEllipsisIcon', color: 'border-green-500/40 bg-green-500/5 text-green-400' },
];

interface FormData {
  name: string;
  topic: string;
  goal: string;
  maxTurns: number;
  turnTimeout: number;
}

export default function Step1SessionConfig({ config, onChange, onNext }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: config.name,
      topic: config.topic,
      goal: config.goal,
      maxTurns: config.maxTurns,
      turnTimeout: config.turnTimeout,
    },
  });

  const onSubmit = (data: FormData) => {
    onChange(data);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Session Configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">Define the task, mode, and parameters for this collaboration session</p>
      </div>

      {/* Session name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Session Name</label>
        <p className="text-xs text-muted-foreground mb-2">A short, descriptive name to identify this session</p>
        <input
          type="text"
          placeholder="e.g. SaaS MVP Architecture Review"
          className="input-base"
          {...register('name', { required: 'Session name is required' })}
        />
        {errors.name && <p className="text-xs text-negative mt-1">{errors.name.message}</p>}
      </div>

      {/* Collaboration mode */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Collaboration Mode</label>
        <p className="text-xs text-muted-foreground mb-3">Sets the agents' shared objective and conversation style</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODES.map((m) => (
            <button
              key={`mode-${m.value}`}
              type="button"
              onClick={() => onChange({ mode: m.value })}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 ${
                config.mode === m.value ? m.color : 'border-border bg-muted/20 hover:border-border/80'
              }`}
            >
              <Icon name={m.icon as any} size={20} className={config.mode === m.value ? '' : 'text-muted-foreground'} />
              <div>
                <p className="text-sm font-medium text-foreground">{m.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Topic / task */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Topic / Task</label>
        <p className="text-xs text-muted-foreground mb-2">The specific subject or problem the agents will work on</p>
        <textarea
          rows={3}
          placeholder="e.g. Design and implement a multi-tenant SaaS platform with authentication, billing via Stripe, and an onboarding flow"
          className="input-base resize-none"
          {...register('topic', { required: 'Topic is required' })}
        />
        {errors.topic && <p className="text-xs text-negative mt-1">{errors.topic.message}</p>}
      </div>

      {/* Goal */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Session Goal</label>
        <p className="text-xs text-muted-foreground mb-2">What should the agents have produced or decided by the end?</p>
        <textarea
          rows={2}
          placeholder="e.g. A complete architecture document, database schema, and initial codebase structure"
          className="input-base resize-none"
          {...register('goal')}
        />
      </div>

      {/* Advanced params */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Max Turns</label>
          <p className="text-xs text-muted-foreground mb-2">Maximum number of agent messages before the session ends</p>
          <input
            type="number"
            min={10}
            max={200}
            className="input-base"
            {...register('maxTurns', { required: true, min: 10, max: 200, valueAsNumber: true })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Turn Timeout (s)</label>
          <p className="text-xs text-muted-foreground mb-2">Seconds an agent has to respond before being skipped</p>
          <input
            type="number"
            min={10}
            max={120}
            className="input-base"
            {...register('turnTimeout', { required: true, min: 10, max: 120, valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary px-6">
          Configure Agents
          <Icon name="ArrowRightIcon" size={16} />
        </button>
      </div>
    </form>
  );
}