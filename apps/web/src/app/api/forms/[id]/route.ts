import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, forms, users } from '@execute/db';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/forms/[id] - Get a single form
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const [form] = await db.select()
      .from(forms)
      .where(and(eq(forms.id, id), eq(forms.userId, internalUser.id)))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({
      form: {
        id: form.id,
        name: form.name,
        description: form.description,
        fields: form.fields,
        publicSlug: form.publicSlug,
        isActive: form.isActive,
        workflowId: form.workflowId,
        publicUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/f/${form.publicSlug}`,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error fetching form:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/forms/[id] - Update a form
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { name, description, fields, workflowId, isActive } = body;

    // Check if form exists and belongs to user
    const [existingForm] = await db.select()
      .from(forms)
      .where(and(eq(forms.id, id), eq(forms.userId, internalUser.id)))
      .limit(1);

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Validate fields if provided
    if (fields !== undefined) {
      const validTypes = ['text', 'email', 'number', 'textarea', 'select', 'checkbox'];

      for (const field of fields) {
        if (!field.id || !field.label) {
          return NextResponse.json({ error: 'Each field must have an id and label' }, { status: 400 });
        }

        if (!validTypes.includes(field.type)) {
          return NextResponse.json({ error: `Invalid field type: ${field.type}` }, { status: 400 });
        }

        if (field.type === 'select' && (!Array.isArray(field.options) || field.options.length === 0)) {
          return NextResponse.json({ error: `Select field "${field.id}" must have at least one option` }, { status: 400 });
        }
      }
    }

    // Update form
    await db.update(forms)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(fields !== undefined && { fields }),
        ...(workflowId !== undefined && { workflowId: workflowId || null }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(eq(forms.id, id));

    const [updatedForm] = await db.select().from(forms).where(eq(forms.id, id)).limit(1);

    return NextResponse.json({
      form: {
        id: updatedForm.id,
        name: updatedForm.name,
        description: updatedForm.description,
        fields: updatedForm.fields,
        publicSlug: updatedForm.publicSlug,
        isActive: updatedForm.isActive,
        workflowId: updatedForm.workflowId,
        publicUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/f/${updatedForm.publicSlug}`,
        createdAt: updatedForm.createdAt,
        updatedAt: updatedForm.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating form:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/forms/[id] - Delete a form
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Check if form exists and belongs to user
    const [existingForm] = await db.select()
      .from(forms)
      .where(and(eq(forms.id, id), eq(forms.userId, internalUser.id)))
      .limit(1);

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Delete form (cascade will delete submissions)
    await db.delete(forms).where(eq(forms.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting form:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
