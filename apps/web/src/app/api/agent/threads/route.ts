import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { agentThreads, db, users } from '@execute/db';
import { createClient } from '@/lib/supabase/server';
import { canAccessAgentFeature } from '@/lib/agent-feature-access';

export async function GET() {
  try {
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

    const threads = await db.select({
      id: agentThreads.id,
      title: agentThreads.title,
      lastMessageAt: agentThreads.lastMessageAt,
      createdAt: agentThreads.createdAt,
      updatedAt: agentThreads.updatedAt,
    })
      .from(agentThreads)
      .where(eq(agentThreads.userId, internalUser.id))
      .orderBy(desc(agentThreads.lastMessageAt))
      .limit(100);

    return NextResponse.json({ threads });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Agent threads error:', message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
