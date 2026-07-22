import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { agentMessages, agentThreads, db, users } from '@execute/db';
import { createClient } from '@/lib/supabase/server';
import { listAgentProposedActionsForThread } from '@/lib/agent-actions';
import { canAccessAgentFeature } from '@/lib/agent-feature-access';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Invalid thread ID' }, { status: 400 });
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

    const [thread] = await db.select({
      id: agentThreads.id,
      title: agentThreads.title,
    })
      .from(agentThreads)
      .where(and(
        eq(agentThreads.id, id),
        eq(agentThreads.userId, internalUser.id),
      ))
      .limit(1);

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const [messages, actions] = await Promise.all([
      db.select({
        id: agentMessages.id,
        role: agentMessages.role,
        content: agentMessages.content,
        createdAt: agentMessages.createdAt,
      })
        .from(agentMessages)
        .where(and(
          eq(agentMessages.threadId, thread.id),
          eq(agentMessages.userId, internalUser.id),
        ))
        .orderBy(asc(agentMessages.createdAt)),
      listAgentProposedActionsForThread(internalUser.id, thread.id),
    ]);

    return NextResponse.json({ thread, messages, actions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Agent thread messages error:', message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
