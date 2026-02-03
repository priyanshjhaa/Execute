import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, contacts, users } from '@execute/db';
import { eq, desc, like, or, and, sql } from 'drizzle-orm';

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
        { contacts: [] },
        { status: 200 }
      );
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const isActive = searchParams.get('isActive');

    // 4. Build query conditions
    const conditions = [eq(contacts.userId, internalUser.id)];

    if (isActive !== null) {
      conditions.push(eq(contacts.isActive, isActive === 'true'));
    }

    if (search) {
      conditions.push(
        or(
          like(contacts.name, `%${search}%`),
          like(contacts.email, `%${search}%`)
        )!
      );
    }

    if (department) {
      conditions.push(eq(contacts.department, department));
    }

    // 5. Fetch contacts
    const userContacts = await db.select()
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.createdAt));

    // 6. Filter by tags if specified
    let filteredContacts = userContacts;
    if (tags && tags.length > 0) {
      filteredContacts = userContacts.filter(contact => {
        const contactTags = (contact.tags as string[]) || [];
        return tags.some(tag => contactTags.includes(tag));
      });
    }

    return NextResponse.json({
      contacts: filteredContacts,
    });

  } catch (error: any) {
    console.error('Error fetching contacts:', error);
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
    const { name, email, phone, department, jobTitle, company, tags, notes, avatarUrl } = body;

    // 4. Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // 5. Check for duplicate email
    const [existing] = await db.select()
      .from(contacts)
      .where(and(
        eq(contacts.userId, internalUser.id),
        eq(contacts.email, email.toLowerCase())
      ))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'A contact with this email already exists' },
        { status: 409 }
      );
    }

    // 6. Create contact
    const [newContact] = await db.insert(contacts)
      .values({
        userId: internalUser.id,
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        department: department || null,
        jobTitle: jobTitle || null,
        company: company || null,
        tags: tags || [],
        notes: notes || null,
        avatarUrl: avatarUrl || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      contact: newContact,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating contact:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
