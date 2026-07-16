import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { agentRuns, db, users } from '@execute/db';
import { abortAgentRun } from '@/lib/agent-run-registry';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [internalUser] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.supabaseId, user.id))
      .limit(1);
    if (!internalUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [run] = await db.select({ id: agentRuns.id, status: agentRuns.status })
      .from(agentRuns)
      .where(and(
        eq(agentRuns.id, id),
        eq(agentRuns.userId, internalUser.id),
      ))
      .limit(1);

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    if (run.status !== 'running') {
      return NextResponse.json({ success: true, status: run.status });
    }

    const cancelledAt = new Date();
    const [cancelledRun] = await db.update(agentRuns)
      .set({ status: 'cancelled', cancelledAt, completedAt: cancelledAt })
      .where(and(
        eq(agentRuns.id, id),
        eq(agentRuns.userId, internalUser.id),
        eq(agentRuns.status, 'running'),
      ))
      .returning({ id: agentRuns.id });

    if (cancelledRun) {
      abortAgentRun(id, internalUser.id);
      return NextResponse.json({ success: true, status: 'cancelled' });
    }

    const [currentRun] = await db.select({ status: agentRuns.status })
      .from(agentRuns)
      .where(and(
        eq(agentRuns.id, id),
        eq(agentRuns.userId, internalUser.id),
      ))
      .limit(1);

    return NextResponse.json({ success: true, status: currentRun?.status || 'cancelled' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Agent cancellation error:', message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
