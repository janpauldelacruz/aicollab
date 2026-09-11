'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ModeBadge, SessionStatusBadge } from '@/components/ui/StatusBadge';
import ResultsSummaryTab from './ResultsSummaryTab';
import ResultsTranscriptTab from './ResultsTranscriptTab';
import ResultsArtifactsTab from './ResultsArtifactsTab';
import ResultsAnalyticsTab from './ResultsAnalyticsTab';
import ExportModal from './ExportModal';

const TABS = [
  { id: 'tab-summary', label: 'Summary', icon: 'DocumentTextIcon' },
  { id: 'tab-transcript', label: 'Transcript', icon: 'ChatBubbleLeftRightIcon' },
  { id: 'tab-artifacts', label: 'Artifacts', icon: 'DocumentDuplicateIcon', badge: 5 },
  { id: 'tab-analytics', label: 'Analytics', icon: 'ChartBarIcon' },
];

export default function SessionResultsClient() {
  const [activeTab, setActiveTab] = useState('tab-summary');
  const [exportModalOpen, setExportModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Link href="/sessions-dashboard" className="btn-ghost p-2 mt-0.5">
            <Icon name="ArrowLeftIcon" size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-foreground">SaaS MVP Architecture</h1>
              <SessionStatusBadge status="completed" />
              <ModeBadge mode="build" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              5 agents · 142 messages · 8 artifacts · 1h 23m · Completed 2026-09-07 01:33
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/share-session" className="btn-secondary text-xs gap-1.5">
            <Icon name="ShareIcon" size={14} />
            Share
          </Link>
          <button onClick={() => setExportModalOpen(true)} className="btn-primary text-xs gap-1.5">
            <Icon name="ArrowDownTrayIcon" size={14} />
            Export Transcript
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as any} size={15} />
            {tab.label}
            {tab.badge && (
              <span className="bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded-full font-mono">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'tab-summary' && <ResultsSummaryTab />}
      {activeTab === 'tab-transcript' && <ResultsTranscriptTab />}
      {activeTab === 'tab-artifacts' && <ResultsArtifactsTab />}
      {activeTab === 'tab-analytics' && <ResultsAnalyticsTab />}

      {/* Export modal */}
      {exportModalOpen && (
        <ExportModal
          sessionName="SaaS MVP Architecture"
          onClose={() => setExportModalOpen(false)}
        />
      )}
    </div>
  );
}