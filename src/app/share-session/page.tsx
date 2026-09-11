import AppLayout from '@/components/AppLayout';
import ShareSessionClient from './components/ShareSessionClient';

interface Props {
  searchParams: Promise<{ id?: string }>;
}

export default async function ShareSessionPage({ searchParams }: Props) {
  const params = await searchParams;
  const sessionId = params.id || null;

  return (
    <AppLayout>
      <ShareSessionClient sessionId={sessionId} />
    </AppLayout>
  );
}
