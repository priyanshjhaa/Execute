import { notFound, redirect } from 'next/navigation';
import { getCurrentAgentAccess } from '@/lib/agent-feature-access';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentAgentAccess();
  if (!access.authenticated) redirect('/login');
  if (!access.user || !access.agent) notFound();
  return children;
}
