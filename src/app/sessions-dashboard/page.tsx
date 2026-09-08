import React from 'react';
import AppLayout from '@/components/AppLayout';
import SessionsDashboardClient from './components/SessionsDashboardClient';

export default function SessionsDashboardPage() {
  return (
    <AppLayout activeRoute="/sessions-dashboard">
      <SessionsDashboardClient />
    </AppLayout>
  );
}