import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, executions, users, workflows } from '@execute/db';
import { eq, desc, and } from 'drizzle-orm';

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));

    if (!internalUser) {
      return NextResponse.json({ executions: [] }, { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Validate workflowId if provided
    if (workflowId && !isValidUUID(workflowId)) {
      return NextResponse.json({ executions: [] }, { status: 200 });
    }

    const userExecutions = await db.select({
      id: executions.id,
      workflowId: executions.workflowId,
      status: executions.status,
      startedAt: executions.startedAt,
      completedAt: executions.completedAt,
      errorMessage: executions.errorMessage,
      triggerData: executions.triggerData,
      workflow: {
        id: workflows.id,
        name: workflows.name,
      },
    })
      .from(executions)
      .innerJoin(workflows, eq(executions.workflowId, workflows.id))
      .where(workflowId ? and(eq(executions.userId, internalUser.id), eq(executions.workflowId, workflowId)) : eq(executions.userId, internalUser.id))
      .orderBy(desc(executions.createdAt))
      .limit(limit)
      .offset(offset);

    // Transform to match frontend expectations
    const transformed = userExecutions.map((e: any) => ({
      id: e.id,
      workflowId: e.workflowId,
      status: e.status,
      triggerType: e.triggerData?.type || 'manual',
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      duration: e.completedAt && e.startedAt
        ? new Date(e.completedAt).getTime() - new Date(e.startedAt).getTime()
        : undefined,
      error: e.errorMessage,
      workflow: e.workflow,
    }));

    return NextResponse.json({ executions: transformed });
  } catch (error: any) {
    console.error('Error fetching executions:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
