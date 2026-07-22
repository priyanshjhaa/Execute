import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users } from '@execute/db';
import type { AgentActionDecision } from '@execute/llm';
import { z } from 'zod';
import { decideAgentProposedAction } from '@/lib/agent-actions';
import { executeApprovedAgentAction } from '@/lib/agent-action-executor';
import { createClient } from '@/lib/supabase/server';
import { canAccessAgentFeature } from '@/lib/agent-feature-access';

interface AgentActionRouteContext {
  params: Promise<{ id: string }>;
}

const ActionIdSchema = z.string().uuid();

export async function handleAgentActionDecision(
  _request: NextRequest,
  context: AgentActionRouteContext,
  decision: AgentActionDecision,
) {
  try {
    const { id } = await context.params;
    if (!ActionIdSchema.safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid action ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [internalUser] = await db.select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.supabaseId, user.id))
      .limit(1);
    if (!internalUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!canAccessAgentFeature(internalUser, 'agent')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const result = await decideAgentProposedAction({
      actionId: id,
      userId: internalUser.id,
      decision,
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Proposed action not found' }, { status: 404 });
    }
    if (result.kind === 'conflict') {
      return NextResponse.json({
        error: 'Proposed action has already been decided',
        status: result.status,
      }, { status: 409 });
    }

    const execution = decision === 'approve'
      ? await executeApprovedAgentAction(internalUser.id, result.action.id)
      : null;

    return NextResponse.json({
      action: execution?.action || result.action,
      idempotent: result.kind === 'already_applied',
      executionHandled: execution?.handled || false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Agent action ${decision} error:`, message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
