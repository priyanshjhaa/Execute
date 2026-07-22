import { redirect } from 'next/navigation';
import { getCurrentAgentAccess } from '@/lib/agent-feature-access';

export default async function QuickCommandsLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentAgentAccess();
  if (access.authenticated && access.user && access.agent && access.releaseMode === 'general') {
    redirect('/dashboard/agent');
  }
  return children;
}
