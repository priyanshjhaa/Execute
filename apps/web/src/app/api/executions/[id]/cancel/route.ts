import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, executions, users } from '@execute/db';
import { eq, and } from 'drizzle-orm';

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
        { error: 'Invalid execution ID format' },
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

    // Find the execution and ensure it belongs to the user
    const [execution] = await db.select()
      .from(executions)
      .where(and(eq(executions.id, id), eq(executions.userId, internalUser.id)))
      .limit(1);

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    // Check if execution can be cancelled (only running executions)
    if (execution.status !== 'running') {
      return NextResponse.json(
        { error: `Cannot cancel execution with status: ${execution.status}` },
        { status: 400 }
      );
    }

    // Set the cancel_requested flag
    const [updated] = await db.update(executions)
      .set({
        cancelRequested: true,
        updatedAt: new Date(),
      })
      .where(and(eq(executions.id, id), eq(executions.userId, internalUser.id)))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Cancellation requested. Execution will stop at the next step.',
      execution: updated,
    });
  } catch (error: any) {
    console.error('Error cancelling execution:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
