import AppLayout from '@/components/AppLayout';
import WebhooksClient from './components/WebhooksClient';

export const metadata = { title: 'Webhooks — AICollab' };

export default function WebhooksPage() {
  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-6">
        <WebhooksClient />
      </div>
    </AppLayout>
  );
}
