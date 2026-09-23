import type { Metadata } from 'next';
import PromptLabClient from './components/PromptLabClient';

export const metadata: Metadata = {
  title: 'Prompt Lab — AICollab',
  description: 'Save, compare, and test agent prompts across parallel runs with token and cost tracking',
};

export default function PromptLabPage() {
  return <PromptLabClient />;
}
