import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, contactGroups, users } from '@execute/db';
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
    const { id } = await params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid group ID format' },
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

    // 3. Fetch group
    const [group] = await db.select()
      .from(contactGroups)
      .where(and(
        eq(contactGroups.id, id),
        eq(contactGroups.userId, internalUser.id)
      ))
      .limit(1);

    if (!group) {
      return NextResponse.json(
        { error: 'Contact group not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      group,
    });

  } catch (error: any) {
    console.error('Error fetching contact group:', error);
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
    const { id } = await params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid group ID format' },
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

    // 3. Check if group exists and belongs to user
    const [existing] = await db.select()
      .from(contactGroups)
      .where(and(
        eq(contactGroups.id, id),
        eq(contactGroups.userId, internalUser.id)
      ))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Contact group not found' },
        { status: 404 }
      );
    }

    // 4. Parse request body
    const body = await request.json();
    const { name, description, contactIds } = body;

    // 5. Update group
    const [updatedGroup] = await db.update(contactGroups)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(contactIds !== undefined && { contactIds }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(contactGroups.id, id),
        eq(contactGroups.userId, internalUser.id)
      ))
      .returning();

    return NextResponse.json({
      group: updatedGroup,
    });

  } catch (error: any) {
    console.error('Error updating contact group:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid group ID format' },
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

    // 3. Delete group
    const result = await db.delete(contactGroups)
      .where(and(
        eq(contactGroups.id, id),
        eq(contactGroups.userId, internalUser.id)
      ))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Contact group not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contact group deleted successfully',
    });

  } catch (error: any) {
    console.error('Error deleting contact group:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
