import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, contactGroups, users } from '@execute/db';
import { eq, desc, and } from 'drizzle-orm';

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
        { groups: [] },
        { status: 200 }
      );
    }

    // 3. Fetch contact groups
    const userGroups = await db.select()
      .from(contactGroups)
      .where(eq(contactGroups.userId, internalUser.id))
      .orderBy(desc(contactGroups.createdAt));

    return NextResponse.json({
      groups: userGroups,
    });

  } catch (error: any) {
    console.error('Error fetching contact groups:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { name, description, contactIds } = body;

    // 4. Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // 5. Create contact group
    const [newGroup] = await db.insert(contactGroups)
      .values({
        userId: internalUser.id,
        name,
        description: description || null,
        contactIds: contactIds || [],
      })
      .returning();

    return NextResponse.json({
      group: newGroup,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating contact group:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
