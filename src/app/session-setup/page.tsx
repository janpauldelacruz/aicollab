import React from 'react';
import AppLayout from '@/components/AppLayout';
import SessionSetupClient from './components/SessionSetupClient';

export default function SessionSetupPage() {
  return (
    <AppLayout activeRoute="/session-setup">
      <SessionSetupClient />
    </AppLayout>
  );
}
