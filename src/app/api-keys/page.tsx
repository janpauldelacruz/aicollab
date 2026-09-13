import AppLayout from '@/components/AppLayout';
import ApiKeysClient from './components/ApiKeysClient';

export const metadata = {
  title: 'API Keys — AICollab',
  description: 'Securely store and manage API keys for custom models and providers',
};

export default function ApiKeysPage() {
  return (
    <AppLayout>
      <ApiKeysClient />
    </AppLayout>
  );
}
