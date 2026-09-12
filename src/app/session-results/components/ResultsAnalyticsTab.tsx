'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import type { StoredSession } from '@/lib/session/sessionStore';

interface Props {
  session: StoredSession;
}

const ContributionChart = dynamic(() => import('./charts/ContributionChart'), { ssr: false });
const MessageTimelineChart = dynamic(() => import('./charts/MessageTimelineChart'), { ssr: false });
const ArtifactsByTypeChart = dynamic(() => import('./charts/ArtifactsByTypeChart'), { ssr: false });

export default function ResultsAnalyticsTab({ session }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contribution radial */}
        <div className="card-base">
          <h3 className="text-sm font-semibold text-foreground mb-1">Agent Contribution</h3>
          <p className="text-xs text-muted-foreground mb-4">Share of total messages by agent</p>
          <ContributionChart session={session} />
        </div>

        {/* Artifacts by type */}
        <div className="card-base">
          <h3 className="text-sm font-semibold text-foreground mb-1">Artifacts by Type</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribution of produced artifacts</p>
          <ArtifactsByTypeChart session={session} />
        </div>
      </div>

      {/* Message timeline */}
      <div className="card-base">
        <h3 className="text-sm font-semibold text-foreground mb-1">Message Activity Timeline</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Messages exchanged per minute across the session
        </p>
        <MessageTimelineChart session={session} />
      </div>
    </div>
  );
}
