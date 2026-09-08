import React from 'react';
import AppLayout from '@/components/AppLayout';
import AgentTemplatesClient from './components/AgentTemplatesClient';

export default function AgentTemplatesPage() {
  return (
    <AppLayout activeRoute="/agent-templates">
      <AgentTemplatesClient />
    </AppLayout>
  );
}