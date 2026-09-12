import SharedSessionViewer from './components/SharedSessionViewer';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharedSessionPage({ params }: Props) {
  const { token } = await params;
  return <SharedSessionViewer token={token} />;
}
