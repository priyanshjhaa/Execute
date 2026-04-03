import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, workflows, users } from '@execute/db';
import { eq, and } from 'drizzle-orm';
import { executeWorkflow, hasActiveExecution } from '@/lib/workflow-execution';

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid workflow ID format' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));

    if (!internalUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [workflow] = await db.select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, internalUser.id)));

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Removed status check to allow running workflows in draft mode for testing
    if (await hasActiveExecution(workflow.id)) {
      return NextResponse.json({ error: 'Workflow is already running' }, { status: 409 });
    }

    // Parse request body for optional test data
    let testData = {};
    try {
      const body = await request.json();
      if (body && typeof body === 'object' && body.data) {
        testData = body.data;
      }
    } catch {
      // If no body or invalid JSON, use empty object
    }

    const result = await executeWorkflow({
      workflow: workflow as any,
      internalUser: {
        id: internalUser.id,
        email: internalUser.email,
        name: internalUser.name || undefined,
      },
      triggerType: 'manual',
      triggerSource: 'api',
      triggerPayload: testData,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error executing workflow:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
