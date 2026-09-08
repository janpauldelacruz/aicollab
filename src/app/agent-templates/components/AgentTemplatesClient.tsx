'use client';
import React, { useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import TemplateCard from './TemplateCard';
import CreateTemplateModal from './CreateTemplateModal';

export type AgentRole = 'brainstormer' | 'coder' | 'pm' | 'designer' | 'critic' | 'researcher' | 'architect';
export type AgentModel = 'gpt-4o' | 'claude-3.5-sonnet' | 'gemini-1.5-pro' | 'llama-3.1-70b' | 'mistral-large';

export interface AgentTemplate {
  id: string;
  name: string;
  role: AgentRole;
  model: AgentModel;
  personality: string;
  traits: string[];
  creativity: number;
  verbosity: number;
  assertiveness: number;
  usageCount: number;
  lastUsed: string;
  isBuiltIn: boolean;
  systemPrompt: string;
}

const MOCK_TEMPLATES: AgentTemplate[] = [
  { id: 'tpl-001', name: 'Mira', role: 'pm', model: 'claude-3.5-sonnet', personality: 'Organized, decisive, keeps teams on track', traits: ['Decisive', 'Organized', 'Empathetic', 'Strategic'], creativity: 60, verbosity: 50, assertiveness: 75, usageCount: 34, lastUsed: '2026-09-07', isBuiltIn: true, systemPrompt: 'You are a senior product manager. Keep the team focused, track decisions, and ensure progress toward the goal.' },
  { id: 'tpl-002', name: 'Orion', role: 'architect', model: 'gpt-4o', personality: 'Systematic, thorough, loves clean abstractions', traits: ['Systematic', 'Thorough', 'Abstract', 'Rigorous'], creativity: 65, verbosity: 70, assertiveness: 65, usageCount: 28, lastUsed: '2026-09-07', isBuiltIn: true, systemPrompt: 'You are a solutions architect. Design scalable, maintainable systems. Always explain your architectural decisions.' },
  { id: 'tpl-003', name: 'Zara', role: 'coder', model: 'gpt-4o', personality: 'Detail-oriented, pragmatic, writes clean code', traits: ['Pragmatic', 'Detail-oriented', 'Clean code', 'Test-driven'], creativity: 55, verbosity: 60, assertiveness: 55, usageCount: 41, lastUsed: '2026-09-07', isBuiltIn: true, systemPrompt: 'You are a senior full-stack engineer. Write production-quality, well-documented code. Always consider edge cases.' },
  { id: 'tpl-004', name: 'Lena', role: 'designer', model: 'claude-3.5-sonnet', personality: 'Empathetic, visual, user-obsessed', traits: ['User-focused', 'Visual', 'Empathetic', 'Iterative'], creativity: 85, verbosity: 65, assertiveness: 60, usageCount: 19, lastUsed: '2026-09-06', isBuiltIn: true, systemPrompt: 'You are a UX/UI designer. Always advocate for the user. Think in flows, not just screens.' },
  { id: 'tpl-005', name: 'Rex', role: 'critic', model: 'gemini-1.5-pro', personality: 'Skeptical, rigorous, finds edge cases', traits: ['Skeptical', 'Rigorous', 'Devil\'s advocate', 'Precise'], creativity: 50, verbosity: 55, assertiveness: 85, usageCount: 31, lastUsed: '2026-09-07', isBuiltIn: true, systemPrompt: 'You are a critical reviewer. Challenge every assumption. Find the flaws before they become problems.' },
  { id: 'tpl-006', name: 'Nova', role: 'brainstormer', model: 'claude-3.5-sonnet', personality: 'Creative, lateral thinker, generates novel ideas', traits: ['Creative', 'Lateral', 'Divergent', 'Energetic'], creativity: 95, verbosity: 75, assertiveness: 50, usageCount: 22, lastUsed: '2026-09-05', isBuiltIn: true, systemPrompt: 'You are a creative brainstormer. Generate bold, unconventional ideas. Think laterally. Quantity over quality in early rounds.' },
  { id: 'tpl-007', name: 'Atlas', role: 'researcher', model: 'gemini-1.5-pro', personality: 'Methodical, evidence-based, cites best practices', traits: ['Evidence-based', 'Methodical', 'Thorough', 'Objective'], creativity: 45, verbosity: 80, assertiveness: 45, usageCount: 15, lastUsed: '2026-09-04', isBuiltIn: true, systemPrompt: 'You are a research specialist. Gather context, cite best practices, and provide data-backed recommendations.' },
  { id: 'tpl-008', name: 'Sage', role: 'pm', model: 'gpt-4o', personality: 'Calm, data-driven, prioritizes ruthlessly', traits: ['Data-driven', 'Calm', 'Prioritizer', 'Outcome-focused'], creativity: 55, verbosity: 45, assertiveness: 70, usageCount: 12, lastUsed: '2026-09-03', isBuiltIn: false, systemPrompt: 'You are a data-driven PM. Make decisions based on evidence. Ruthlessly prioritize. Say no often.' },
  { id: 'tpl-009', name: 'Pixel', role: 'designer', model: 'llama-3.1-70b', personality: 'Bold, trendy, pushes visual boundaries', traits: ['Bold', 'Trendy', 'Experimental', 'Visual'], creativity: 92, verbosity: 60, assertiveness: 65, usageCount: 8, lastUsed: '2026-09-02', isBuiltIn: false, systemPrompt: 'You are an experimental designer. Push visual boundaries. Challenge conservative design choices.' },
  { id: 'tpl-010', name: 'Echo', role: 'coder', model: 'mistral-large', personality: 'Security-focused, defensive programming advocate', traits: ['Security-first', 'Defensive', 'Careful', 'Audit-minded'], creativity: 40, verbosity: 65, assertiveness: 70, usageCount: 9, lastUsed: '2026-09-01', isBuiltIn: false, systemPrompt: 'You are a security-focused engineer. Always think about attack vectors. Write defensive code. Audit everything.' },
  { id: 'tpl-011', name: 'Flux', role: 'architect', model: 'gpt-4o', personality: 'Event-driven systems specialist, async thinker', traits: ['Event-driven', 'Async', 'Scalable', 'Distributed'], creativity: 70, verbosity: 75, assertiveness: 60, usageCount: 6, lastUsed: '2026-08-30', isBuiltIn: false, systemPrompt: 'You are an event-driven systems architect. Think in queues, streams, and async patterns.' },
  { id: 'tpl-012', name: 'Vex', role: 'critic', model: 'claude-3.5-sonnet', personality: 'Performance obsessed, benchmarks everything', traits: ['Performance', 'Benchmarks', 'Profiling', 'Optimization'], creativity: 50, verbosity: 60, assertiveness: 80, usageCount: 11, lastUsed: '2026-09-06', isBuiltIn: false, systemPrompt: 'You are a performance critic. Challenge every design decision from a performance perspective. Measure first.' },
];

const ROLE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Roles' },
  { value: 'pm', label: 'Project Manager' },
  { value: 'coder', label: 'Coder' },
  { value: 'architect', label: 'Architect' },
  { value: 'designer', label: 'Designer' },
  { value: 'critic', label: 'Critic' },
  { value: 'brainstormer', label: 'Brainstormer' },
  { value: 'researcher', label: 'Researcher' },
];

export default function AgentTemplatesClient() {
  const [templates, setTemplates] = useState<AgentTemplate[]>(MOCK_TEMPLATES);
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showBuiltInOnly, setShowBuiltInOnly] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgentTemplate | null>(null);
  const [sortBy, setSortBy] = useState<'usage' | 'lastUsed' | 'name'>('usage');

  const filtered = templates
    .filter((t) => {
      const matchRole = roleFilter === 'all' || t.role === roleFilter;
      const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.traits.some(tr => tr.toLowerCase().includes(search.toLowerCase()));
      const matchBuiltIn = !showBuiltInOnly || t.isBuiltIn;
      return matchRole && matchSearch && matchBuiltIn;
    })
    .sort((a, b) => {
      if (sortBy === 'usage') return b.usageCount - a.usageCount;
      if (sortBy === 'lastUsed') return b.lastUsed.localeCompare(a.lastUsed);
      return a.name.localeCompare(b.name);
    });

  const handleDelete = (template: AgentTemplate) => {
    setTemplates(templates.filter((t) => t.id !== template.id));
    toast.success(`Template "${template.name}" deleted`);
    setDeleteTarget(null);
  };

  const handleDuplicate = (template: AgentTemplate) => {
    const copy: AgentTemplate = {
      ...template,
      id: `tpl-copy-${Date.now()}`,
      name: `${template.name} (copy)`,
      isBuiltIn: false,
      usageCount: 0,
      lastUsed: '—',
    };
    setTemplates([copy, ...templates]);
    toast.success(`Template "${template.name}" duplicated`);
  };

  const handleCreate = (newTemplate: Omit<AgentTemplate, 'id' | 'usageCount' | 'lastUsed' | 'isBuiltIn'>) => {
    const template: AgentTemplate = {
      ...newTemplate,
      id: `tpl-new-${Date.now()}`,
      usageCount: 0,
      lastUsed: '—',
      isBuiltIn: false,
    };
    setTemplates([template, ...templates]);
    toast.success(`Template "${template.name}" created`);
    setCreateModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agent Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reusable agent configurations — add them to any session in one click
          </p>
        </div>
        <button onClick={() => setCreateModalOpen(true)} className="btn-primary flex-shrink-0">
          <Icon name="PlusIcon" size={16} />
          New Template
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'tpl-stat-total', label: 'Total Templates', value: templates.length.toString(), icon: 'CpuIcon', color: 'text-primary' },
          { id: 'tpl-stat-builtin', label: 'Built-in', value: templates.filter(t => t.isBuiltIn).length.toString(), icon: 'SparklesIcon', color: 'text-accent' },
          { id: 'tpl-stat-custom', label: 'Custom', value: templates.filter(t => !t.isBuiltIn).length.toString(), icon: 'PencilSquareIcon', color: 'text-warning' },
          { id: 'tpl-stat-uses', label: 'Total Uses', value: templates.reduce((a, t) => a + t.usageCount, 0).toString(), icon: 'PlayCircleIcon', color: 'text-positive' },
        ].map((s) => (
          <div key={s.id} className="card-base">
            <div className="flex items-center gap-2 mb-1">
              <Icon name={s.icon as any} size={14} className={s.color} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className="text-xl font-bold text-foreground tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="relative">
          <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search templates or traits…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-sm w-56"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {ROLE_FILTERS.map((f) => (
            <button
              key={`role-filter-chip-${f.value}`}
              onClick={() => setRoleFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                roleFilter === f.value
                  ? 'bg-primary/15 text-primary border-primary/30' :'bg-muted/30 text-muted-foreground border-transparent hover:border-border hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setShowBuiltInOnly(!showBuiltInOnly)}
              className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${showBuiltInOnly ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showBuiltInOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-muted-foreground">Built-in only</span>
          </label>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="input-base text-xs py-1.5 w-auto">
            <option value="usage">Sort: Most Used</option>
            <option value="lastUsed">Sort: Recently Used</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {templates.length} templates
      </p>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl">
          <Icon name="CpuIcon" size={40} className="text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">No templates found</p>
          <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Try adjusting your filters or create a new template</p>
          <button onClick={() => setCreateModalOpen(true)} className="btn-primary text-xs">
            <Icon name="PlusIcon" size={14} />
            Create Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onDuplicate={handleDuplicate}
              onDelete={(t) => setDeleteTarget(t)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <CreateTemplateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreate}
      />

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Template" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Delete <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>? This template will be permanently removed and cannot be recovered.
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={() => deleteTarget && handleDelete(deleteTarget)} className="btn-danger text-sm">
              <Icon name="TrashIcon" size={14} />
              Delete Template
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}