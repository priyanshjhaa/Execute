import { NextResponse } from 'next/server';
import { getCurrentAgentAccess } from '@/lib/agent-feature-access';

export async function GET() {
  const access = await getCurrentAgentAccess();
  if (!access.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!access.user) {
    return NextResponse.json({ agent: false, monitor: false, releaseMode: 'disabled' });
  }
  return NextResponse.json({
    agent: access.agent,
    monitor: access.monitor,
    releaseMode: access.releaseMode,
  });
}
