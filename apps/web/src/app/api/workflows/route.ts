import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, workflows, users } from '@execute/db';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
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
        { workflows: [] },
        { status: 200 }
      );
    }

    // 3. Fetch workflows
    const userWorkflows = await db.select()
      .from(workflows)
      .where(eq(workflows.userId, internalUser.id))
      .orderBy(workflows.createdAt, 'desc');

    return NextResponse.json({
      workflows: userWorkflows,
    });

  } catch (error: any) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
