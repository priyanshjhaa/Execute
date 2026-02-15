import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, workflows, users } from '@execute/db';
import { eq, and } from 'drizzle-orm';

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 16 requires this)
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid workflow ID format' },
        { status: 400 }
      );
    }

    // 1. Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Find internal user
    const [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));

    if (!internalUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 3. Fetch workflow and verify ownership
    const [workflow] = await db.select()
      .from(workflows)
      .where(
        and(
          eq(workflows.id, id),
          eq(workflows.userId, internalUser.id)
        )
      );

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // 4. Return workflow with full details
    return NextResponse.json({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        triggerType: workflow.triggerType,
        triggerConfig: workflow.triggerConfig,
        status: workflow.status,
        webhookId: workflow.webhookId,
        scheduleExpression: workflow.scheduleExpression,
        totalExecutions: workflow.totalExecutions || 0,
        successRate: workflow.successRate || 0,
        lastExecutedAt: workflow.lastExecutedAt,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        definition: workflow.definition,
      },
    });

  } catch (error: any) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 16 requires this)
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid workflow ID format' },
        { status: 400 }
      );
    }

    // 1. Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Find internal user
    const [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));

    if (!internalUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { name, description, status, definition, triggerType: newTriggerType } = body;

    // 4. Verify ownership and get existing workflow
    const [existingWorkflow] = await db.select()
      .from(workflows)
      .where(
        and(
          eq(workflows.id, id),
          eq(workflows.userId, internalUser.id)
        )
      );

    if (!existingWorkflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // 5. Generate webhookId if triggerType is being set to webhook and none exists
    let webhookId = existingWorkflow.webhookId;
    if (newTriggerType === 'webhook' && !webhookId) {
      webhookId = crypto.randomUUID();
    }

    // 6. Update workflow
    const [updated] = await db.update(workflows)
      .set({
        name: name ?? existingWorkflow.name,
        description: description ?? existingWorkflow.description,
        status: status ?? existingWorkflow.status,
        definition: definition ?? existingWorkflow.definition,
        triggerType: newTriggerType ?? existingWorkflow.triggerType,
        webhookId: webhookId ?? existingWorkflow.webhookId,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, id))
      .returning();

    // 6. Return updated workflow
    return NextResponse.json({
      workflow: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        triggerType: updated.triggerType,
        status: updated.status,
        definition: updated.definition,
        updatedAt: updated.updatedAt,
      },
    });

  } catch (error: any) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
