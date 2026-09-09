import React from 'react';
import AppLayout from '@/components/AppLayout';
import PastCollaborationsClient from './components/PastCollaborationsClient';

export default function PastCollaborationsPage() {
  return (
    <AppLayout activeRoute="/past-collaborations">
      <PastCollaborationsClient />
    </AppLayout>
  );
}
