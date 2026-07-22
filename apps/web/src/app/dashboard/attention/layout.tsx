import { notFound, redirect } from 'next/navigation';
import { getCurrentAgentAccess } from '@/lib/agent-feature-access';

export default async function AttentionLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentAgentAccess();
  if (!access.authenticated) redirect('/login');
  if (!access.user || !access.monitor) notFound();
  return children;
}
