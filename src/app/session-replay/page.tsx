import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import SessionReplayClient from './components/SessionReplayClient';

export default function SessionReplayPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading replay…</div>}>
        <SessionReplayClient />
      </Suspense>
    </AppLayout>
  );
}
