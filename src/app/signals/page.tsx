import AppLayout from '@/components/AppLayout';
import SignalsClient from './components/SignalsClient';

export const metadata = {
  title: 'Signals — AICollab',
  description: 'XAUUSD and BTCUSD buy and sell signals by timeframe',
};

export default function SignalsPage() {
  return (
    <AppLayout>
      <SignalsClient />
    </AppLayout>
  );
}
