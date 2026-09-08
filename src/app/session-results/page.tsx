import React from 'react';
import AppLayout from '@/components/AppLayout';
import SessionResultsClient from './components/SessionResultsClient';

export default function SessionResultsPage() {
  return (
    <AppLayout activeRoute="/session-results">
      <SessionResultsClient />
    </AppLayout>
  );
}