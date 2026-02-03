import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, userIntegrations, users } from '@execute/db';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));

    if (!internalUser) {
      return NextResponse.json({ integrations: [] }, { status: 200 });
    }

    const userIntegrationsList = await db.select()
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, internalUser.id))
      .orderBy(desc(userIntegrations.createdAt));

    return NextResponse.json({ integrations: userIntegrationsList });
  } catch (error: any) {
    console.error('Error fetching integrations:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));

    if (!internalUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { type, name, config, notes } = body;

    if (!type || !name || !config) {
      return NextResponse.json(
        { error: 'Type, name, and config are required' },
        { status: 400 }
      );
    }

    const [newIntegration] = await db.insert(userIntegrations)
      .values({
        userId: internalUser.id,
        type,
        name,
        config,
        notes: notes || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ integration: newIntegration }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating integration:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
