'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/AppIcon';
import type { Session } from './SessionsDashboardClient';

const SessionSparkline = dynamic(() => import('./SessionSparkline'), { ssr: false });

interface KPIProps {
  sessions: Session[];
}

export default function SessionsKPIGrid({ sessions }: KPIProps) {
  const running = sessions.filter((s) => s.status === 'running').length;
  const totalArtifacts = sessions.reduce((a, s) => a + s.artifactCount, 0);
  const completed = sessions.filter((s) => s.status === 'completed');
  const completionRate = sessions.length > 0 ? Math.round((completed.length / sessions.filter(s => s.status !== 'draft').length) * 100) : 0;
  const totalMessages = sessions.reduce((a, s) => a + s.messageCount, 0);

  // 4 cards → 2×2 grid
  const cards = [
    {
      id: 'kpi-active',
      label: 'Active Sessions',
      value: running.toString(),
      change: '+2 from yesterday',
      changeType: 'positive' as const,
      icon: 'PlayCircleIcon',
      iconColor: 'text-positive',
      bgColor: 'bg-positive/5 border-positive/20',
      sparkData: [1, 2, 1, 3, 2, 4, running],
      sparkColor: '#22c55e',
    },
    {
      id: 'kpi-artifacts',
      label: 'Artifacts Generated',
      value: totalArtifacts.toString(),
      change: '+14 this session',
      changeType: 'positive' as const,
      icon: 'DocumentTextIcon',
      iconColor: 'text-accent',
      bgColor: 'bg-accent/5 border-accent/20',
      sparkData: [8, 12, 9, 15, 11, 18, totalArtifacts],
      sparkColor: '#06b6d4',
    },
    {
      id: 'kpi-completion',
      label: 'Completion Rate',
      value: `${completionRate}%`,
      change: '-3% vs last week',
      changeType: 'negative' as const,
      icon: 'CheckCircleIcon',
      iconColor: 'text-warning',
      bgColor: 'bg-warning/5 border-warning/20',
      sparkData: [92, 95, 88, 94, 91, 89, completionRate],
      sparkColor: '#f59e0b',
    },
    {
      id: 'kpi-messages',
      label: 'Messages Exchanged',
      value: totalMessages.toLocaleString(),
      change: '+312 today',
      changeType: 'positive' as const,
      icon: 'ChatBubbleLeftRightIcon',
      iconColor: 'text-primary',
      bgColor: 'bg-primary/5 border-primary/20',
      sparkData: [420, 580, 390, 710, 640, 820, totalMessages],
      sparkColor: '#7c3aed',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.id} className={`card-base border ${card.bgColor} relative overflow-hidden`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
              <p className="text-3xl font-bold text-foreground tabular-nums mt-1">{card.value}</p>
            </div>
            <div className={`w-9 h-9 rounded-lg bg-card flex items-center justify-center flex-shrink-0`}>
              <Icon name={card.icon as any} size={18} className={card.iconColor} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className={`text-xs flex items-center gap-1 ${card.changeType === 'positive' ? 'text-positive' : 'text-negative'}`}>
              <Icon name={card.changeType === 'positive' ? 'ArrowTrendingUpIcon' : 'ArrowTrendingDownIcon'} size={12} />
              {card.change}
            </p>
          </div>
          <div className="mt-2 h-10">
            <SessionSparkline data={card.sparkData} color={card.sparkColor} />
          </div>
        </div>
      ))}
    </div>
  );
}