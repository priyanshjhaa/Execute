import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, contacts, users } from '@execute/db';
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
        { error: 'Invalid contact ID format' },
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

    // 3. Fetch contact
    const [contact] = await db.select()
      .from(contacts)
      .where(and(
        eq(contacts.id, id),
        eq(contacts.userId, internalUser.id)
      ))
      .limit(1);

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      contact,
    });

  } catch (error: any) {
    console.error('Error fetching contact:', error);
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
        { error: 'Invalid contact ID format' },
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

    // 3. Check if contact exists and belongs to user
    const [existing] = await db.select()
      .from(contacts)
      .where(and(
        eq(contacts.id, id),
        eq(contacts.userId, internalUser.id)
      ))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // 4. Parse request body
    const body = await request.json();
    const { name, email, phone, department, jobTitle, company, tags, isActive, notes, avatarUrl } = body;

    // 5. If email is being changed, check for duplicates
    if (email && email.toLowerCase() !== existing.email) {
      const [duplicate] = await db.select()
        .from(contacts)
        .where(and(
          eq(contacts.userId, internalUser.id),
          eq(contacts.email, email.toLowerCase())
        ))
        .limit(1);

      if (duplicate) {
        return NextResponse.json(
          { error: 'A contact with this email already exists' },
          { status: 409 }
        );
      }
    }

    // 6. Update contact
    const [updatedContact] = await db.update(contacts)
      .set({
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email: email.toLowerCase() }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(department !== undefined && { department: department || null }),
        ...(jobTitle !== undefined && { jobTitle: jobTitle || null }),
        ...(company !== undefined && { company: company || null }),
        ...(tags !== undefined && { tags }),
        ...(isActive !== undefined && { isActive }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(contacts.id, id),
        eq(contacts.userId, internalUser.id)
      ))
      .returning();

    return NextResponse.json({
      contact: updatedContact,
    });

  } catch (error: any) {
    console.error('Error updating contact:', error);
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
        { error: 'Invalid contact ID format' },
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

    // 3. Delete contact
    const result = await db.delete(contacts)
      .where(and(
        eq(contacts.id, id),
        eq(contacts.userId, internalUser.id)
      ))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contact deleted successfully',
    });

  } catch (error: any) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
