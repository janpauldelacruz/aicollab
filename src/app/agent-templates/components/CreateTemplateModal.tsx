'use client';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import type { AgentTemplate, AgentRole, AgentModel } from './AgentTemplatesClient';
import { useAvailableModels, modelBadge, FALLBACK_MODELS } from '@/lib/ai/models';
import { isRoleDefaultText, roleDefault } from '@/lib/ai/roleDefaults';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (t: Omit<AgentTemplate, 'id' | 'usageCount' | 'lastUsed' | 'isBuiltIn'>) => void;
}

const ROLE_OPTIONS: { value: AgentRole; label: string }[] = [
  { value: 'pm', label: 'Project Manager' },
  { value: 'coder', label: 'Coder' },
  { value: 'architect', label: 'Architect' },
  { value: 'designer', label: 'Designer' },
  { value: 'critic', label: 'Critic' },
  { value: 'brainstormer', label: 'Brainstormer' },
  { value: 'researcher', label: 'Researcher' },
];

const DEFAULT_MODEL: AgentModel = FALLBACK_MODELS[0].id;

interface FormData {
  name: string;
  role: AgentRole;
  model: AgentModel;
  personality: string;
  traitsRaw: string;
  systemPrompt: string;
  creativity: number;
  verbosity: number;
  assertiveness: number;
}

export default function CreateTemplateModal({ open, onClose, onCreate }: Props) {
  const {
    models: availableModels,
    loading: modelsLoading,
    error: modelsError,
  } = useAvailableModels();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      role: 'coder',
      model: DEFAULT_MODEL,
      personality: roleDefault('coder').personality,
      traitsRaw: '',
      systemPrompt: roleDefault('coder').systemPrompt,
      creativity: roleDefault('coder').creativity,
      verbosity: roleDefault('coder').verbosity,
      assertiveness: roleDefault('coder').assertiveness,
    },
  });

  // Picking a role fills in that role's personality, prompt, and dials — unless
  // the user has already written their own.
  const selectedRole = watch('role');
  useEffect(() => {
    if (!open || !selectedRole) return;
    const preset = roleDefault(selectedRole);

    if (isRoleDefaultText(watch('personality') || '', 'personality')) {
      setValue('personality', preset.personality);
    }
    if (isRoleDefaultText(watch('systemPrompt') || '', 'systemPrompt')) {
      setValue('systemPrompt', preset.systemPrompt);
      setValue('creativity', preset.creativity);
      setValue('verbosity', preset.verbosity);
      setValue('assertiveness', preset.assertiveness);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole, open, setValue]);

  const onSubmit = (data: FormData) => {
    const traits = data.traitsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);

    onCreate({
      name: data.name,
      role: data.role,
      model: data.model,
      personality: data.personality,
      traits: traits.length > 0 ? traits : ['Custom'],
      systemPrompt: data.systemPrompt,
      creativity: data.creativity,
      verbosity: data.verbosity,
      assertiveness: data.assertiveness,
    });
    reset();
  };

  const SliderRow = ({
    name,
    label,
  }: {
    name: 'creativity' | 'verbosity' | 'assertiveness';
    label: string;
  }) => {
    const val = watch(name);
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{label}</span>
        <input
          type="range"
          min={0}
          max={100}
          className="flex-1 accent-primary"
          {...register(name, { valueAsNumber: true })}
        />
        <span className="text-xs font-mono text-foreground tabular-nums w-6 text-right">{val}</span>
      </div>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Agent Template" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Agent Name</label>
            <input
              type="text"
              placeholder="e.g. Nova"
              className="input-base"
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && <p className="text-xs text-negative mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Model</label>
            <select className="input-base" {...register('model')} disabled={modelsLoading}>
              {availableModels.map((m) => (
                <option key={`create-model-${m.id}`} value={m.id}>
                  {m.label} — {modelBadge(m)}
                </option>
              ))}
            </select>
            {modelsError && (
              <p className="text-xs text-warning mt-1">Ollama unreachable — showing defaults.</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Role</label>
          <select className="input-base" {...register('role')}>
            {ROLE_OPTIONS.map((r) => (
              <option key={`create-role-${r.value}`} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Personality</label>
          <p className="text-xs text-muted-foreground mb-1.5">
            One-line description of this agent&apos;s communication style
          </p>
          <input
            type="text"
            placeholder="e.g. Methodical, evidence-based, cites best practices"
            className="input-base"
            {...register('personality', { required: 'Personality is required' })}
          />
          {errors.personality && (
            <p className="text-xs text-negative mt-1">{errors.personality.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Trait Tags</label>
          <p className="text-xs text-muted-foreground mb-1.5">
            Comma-separated list of up to 6 traits (e.g. Creative, Lateral, Energetic)
          </p>
          <input
            type="text"
            placeholder="Creative, Lateral, Bold, Fast"
            className="input-base"
            {...register('traitsRaw')}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">System Prompt</label>
          <p className="text-xs text-muted-foreground mb-1.5">
            Custom instructions prepended to this agent&apos;s context in every session
          </p>
          <textarea
            rows={3}
            placeholder="You are a…"
            className="input-base resize-none"
            {...register('systemPrompt')}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Behavior Parameters
          </p>
          <SliderRow name="creativity" label="Creativity" />
          <SliderRow name="verbosity" label="Verbosity" />
          <SliderRow name="assertiveness" label="Assertiveness" />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            <Icon name="PlusIcon" size={15} />
            Create Template
          </button>
        </div>
      </form>
    </Modal>
  );
}
