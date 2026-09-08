'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import type { AgentConfig, AgentRole, AgentModel, SessionMode } from './SessionSetupClient';

interface Props {
  agents: AgentConfig[];
  mode: SessionMode;
  onChange: (agents: AgentConfig[]) => void;
  onBack: () => void;
  onNext: () => void;
}

const ROLE_OPTIONS: { value: AgentRole; label: string; description: string; color: string }[] = [
  { value: 'pm', label: 'Project Manager', description: 'Coordinates agents, tracks progress, keeps focus', color: 'text-violet-400' },
  { value: 'brainstormer', label: 'Brainstormer', description: 'Generates creative ideas and lateral thinking', color: 'text-amber-400' },
  { value: 'coder', label: 'Coder', description: 'Writes, reviews, and refactors code', color: 'text-cyan-400' },
  { value: 'designer', label: 'Designer', description: 'Handles UX, visual design, and system design', color: 'text-pink-400' },
  { value: 'critic', label: 'Critic', description: 'Challenges assumptions, identifies flaws', color: 'text-red-400' },
  { value: 'researcher', label: 'Researcher', description: 'Gathers context, cites best practices', color: 'text-green-400' },
  { value: 'architect', label: 'Architect', description: 'Designs technical systems and structures', color: 'text-blue-400' },
];

const MODEL_OPTIONS: { value: AgentModel; label: string; badge: string }[] = [
  { value: 'gpt-4o', label: 'GPT-4o', badge: 'OpenAI' },
  { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', badge: 'Anthropic' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', badge: 'Google' },
  { value: 'llama-3.1-70b', label: 'Llama 3.1 70B', badge: 'Meta' },
  { value: 'mistral-large', label: 'Mistral Large', badge: 'Mistral' },
];

const SUGGESTED_TEAMS: { mode: SessionMode; agents: Omit<AgentConfig, 'id'>[] }[] = [
  {
    mode: 'build',
    agents: [
      { name: 'Mira', role: 'pm', model: 'claude-3.5-sonnet', personality: 'Organized, decisive, keeps the team on track', creativity: 60, verbosity: 50, assertiveness: 75, systemPrompt: 'You are a senior product manager who keeps the team focused and on schedule.' },
      { name: 'Orion', role: 'architect', model: 'gpt-4o', personality: 'Systematic, thorough, loves clean abstractions', creativity: 65, verbosity: 70, assertiveness: 65, systemPrompt: 'You are a solutions architect who designs robust, scalable systems.' },
      { name: 'Zara', role: 'coder', model: 'gpt-4o', personality: 'Detail-oriented, pragmatic, writes clean code', creativity: 55, verbosity: 60, assertiveness: 55, systemPrompt: 'You are a senior full-stack engineer who writes production-quality code.' },
      { name: 'Lena', role: 'designer', model: 'claude-3.5-sonnet', personality: 'Empathetic, visual, user-obsessed', creativity: 85, verbosity: 65, assertiveness: 60, systemPrompt: 'You are a UX/UI designer focused on user experience and visual clarity.' },
      { name: 'Rex', role: 'critic', model: 'gemini-1.5-pro', personality: 'Skeptical, rigorous, finds edge cases', creativity: 50, verbosity: 55, assertiveness: 85, systemPrompt: 'You are a critical reviewer who challenges every assumption and finds potential issues.' },
    ],
  },
];

interface AgentFormData {
  name: string;
  role: AgentRole;
  model: AgentModel;
  personality: string;
  systemPrompt: string;
  creativity: number;
  verbosity: number;
  assertiveness: number;
}

const ROLE_COLORS: Record<AgentRole, string> = {
  pm: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  brainstormer: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  coder: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  designer: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  critic: 'bg-red-500/20 text-red-400 border-red-500/30',
  researcher: 'bg-green-500/20 text-green-400 border-green-500/30',
  architect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export default function Step2AgentRoster({ agents, mode, onChange, onBack, onNext }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<AgentFormData>({
    defaultValues: { name: '', role: 'coder', model: 'gpt-4o', personality: '', systemPrompt: '', creativity: 70, verbosity: 60, assertiveness: 65 },
  });

  const openAddModal = () => {
    reset({ name: '', role: 'coder', model: 'gpt-4o', personality: '', systemPrompt: '', creativity: 70, verbosity: 60, assertiveness: 65 });
    setEditingAgent(null);
    setModalOpen(true);
  };

  const openEditModal = (agent: AgentConfig) => {
    reset({ name: agent.name, role: agent.role, model: agent.model, personality: agent.personality, systemPrompt: agent.systemPrompt, creativity: agent.creativity, verbosity: agent.verbosity, assertiveness: agent.assertiveness });
    setEditingAgent(agent);
    setModalOpen(true);
  };

  const onSubmitAgent = (data: AgentFormData) => {
    if (editingAgent) {
      onChange(agents.map((a) => a.id === editingAgent.id ? { ...editingAgent, ...data } : a));
      toast.success(`Agent "${data.name}" updated`);
    } else {
      const newAgent: AgentConfig = { id: `agent-${Date.now()}`, ...data };
      onChange([...agents, newAgent]);
      toast.success(`Agent "${data.name}" added to roster`);
    }
    setModalOpen(false);
  };

  const removeAgent = (id: string) => {
    onChange(agents.filter((a) => a.id !== id));
    toast.info('Agent removed from roster');
  };

  const loadSuggested = () => {
    const team = SUGGESTED_TEAMS.find((t) => t.mode === mode) || SUGGESTED_TEAMS[0];
    const withIds = team.agents.map((a, i) => ({ ...a, id: `agent-suggested-${i}` }));
    onChange(withIds);
    toast.success(`Loaded suggested ${mode} team — ${withIds.length} agents`);
  };

  const SliderField = ({ name, label, description }: { name: 'creativity' | 'verbosity' | 'assertiveness'; label: string; description: string }) => {
    const val = watch(name);
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-foreground">{label}</label>
          <span className="text-xs font-mono text-muted-foreground tabular-nums">{val}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">{description}</p>
        <input type="range" min={0} max={100} className="w-full accent-primary" {...register(name, { valueAsNumber: true })} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Agent Roster</h2>
          <p className="text-sm text-muted-foreground mt-1">Add agents and assign their roles, models, and personalities</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button type="button" onClick={loadSuggested} className="btn-secondary text-xs gap-1.5">
            <Icon name="SparklesIcon" size={14} />
            Suggest Team
          </button>
          <button type="button" onClick={openAddModal} className="btn-primary text-xs gap-1.5">
            <Icon name="PlusIcon" size={14} />
            Add Agent
          </button>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border rounded-xl">
          <Icon name="UsersIcon" size={40} className="text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">No agents yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Add agents manually or load a suggested team for this mode</p>
          <div className="flex gap-3">
            <button type="button" onClick={loadSuggested} className="btn-secondary text-xs">
              <Icon name="SparklesIcon" size={14} />
              Load Suggested Team
            </button>
            <button type="button" onClick={openAddModal} className="btn-primary text-xs">
              <Icon name="PlusIcon" size={14} />
              Add First Agent
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent) => (
            <div key={agent.id} className="card-base group relative hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-semibold ${ROLE_COLORS[agent.role]}`}>
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{agent.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{agent.model}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(agent)} className="btn-ghost p-1" title="Edit agent">
                    <Icon name="PencilIcon" size={13} />
                  </button>
                  <button onClick={() => removeAgent(agent.id)} className="btn-ghost p-1 text-negative hover:bg-negative/10" title="Remove agent">
                    <Icon name="TrashIcon" size={13} />
                  </button>
                </div>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${ROLE_COLORS[agent.role]}`}>
                {ROLE_OPTIONS.find(r => r.value === agent.role)?.label}
              </span>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{agent.personality}</p>
              <div className="mt-3 grid grid-cols-3 gap-1">
                {[
                  { label: 'Creativity', val: agent.creativity },
                  { label: 'Verbosity', val: agent.verbosity },
                  { label: 'Assertive', val: agent.assertiveness },
                ].map((stat) => (
                  <div key={`stat-${agent.id}-${stat.label}`} className="text-center">
                    <div className="h-1 rounded-full bg-muted overflow-hidden mb-1">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${stat.val}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground/60">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add more */}
          <button type="button" onClick={openAddModal} className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary">
            <Icon name="PlusCircleIcon" size={24} />
            <span className="text-xs font-medium">Add Agent</span>
          </button>
        </div>
      )}

      {agents.length > 0 && agents.length < 2 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <Icon name="ExclamationTriangleIcon" size={16} className="text-warning flex-shrink-0" />
          <p className="text-xs text-warning">Add at least 2 agents for a meaningful collaboration session</p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-secondary gap-1.5">
          <Icon name="ArrowLeftIcon" size={16} />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={agents.length < 2}
          className="btn-primary px-6 gap-1.5"
        >
          Review & Launch
          <Icon name="ArrowRightIcon" size={16} />
        </button>
      </div>

      {/* Agent config modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingAgent ? `Edit ${editingAgent.name}` : 'Add New Agent'} size="lg">
        <form onSubmit={handleSubmit(onSubmitAgent)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Agent Name</label>
              <input type="text" placeholder="e.g. Mira" className="input-base" {...register('name', { required: 'Name is required' })} />
              {errors.name && <p className="text-xs text-negative mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Model</label>
              <select className="input-base" {...register('model')}>
                {MODEL_OPTIONS.map((m) => (
                  <option key={`model-${m.value}`} value={m.value}>{m.label} — {m.badge}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((r) => (
                <label key={`role-opt-${r.value}`} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${watch('role') === r.value ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-border/80'}`}>
                  <input type="radio" value={r.value} className="mt-0.5 accent-primary" {...register('role')} />
                  <div>
                    <p className={`text-xs font-medium ${r.color}`}>{r.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Personality</label>
            <p className="text-xs text-muted-foreground mb-1.5">Describe this agent's communication style and character</p>
            <input type="text" placeholder="e.g. Pragmatic, detail-oriented, writes clean code and asks clarifying questions" className="input-base" {...register('personality')} />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">System Prompt</label>
            <p className="text-xs text-muted-foreground mb-1.5">Optional custom instructions prepended to this agent's context</p>
            <textarea rows={3} placeholder="You are a senior engineer who…" className="input-base resize-none" {...register('systemPrompt')} />
          </div>

          <div className="space-y-4 pt-1">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Behavior Parameters</p>
            <SliderField name="creativity" label="Creativity" description="How novel and unconventional the agent's responses are" />
            <SliderField name="verbosity" label="Verbosity" description="How detailed and lengthy the agent's messages are" />
            <SliderField name="assertiveness" label="Assertiveness" description="How strongly the agent defends its positions" />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">
              {editingAgent ? 'Save Changes' : 'Add Agent'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}