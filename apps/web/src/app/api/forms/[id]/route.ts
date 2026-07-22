import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, forms, users, workflows } from '@execute/db';
import { eq, and } from 'drizzle-orm';
import { formValidationMessage, UpdateFormInputSchema } from '@/lib/form-definition';

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
    const body = await request.json().catch(() => null);
    const parsed = UpdateFormInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formValidationMessage(parsed.error) }, { status: 400 });
    }
    const { name, description, fields, workflowId, isActive } = parsed.data;

    // Check if form exists and belongs to user
    const [existingForm] = await db.select()
      .from(forms)
      .where(and(eq(forms.id, id), eq(forms.userId, internalUser.id)))
      .limit(1);

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (workflowId) {
      const [ownedWorkflow] = await db.select({ id: workflows.id }).from(workflows)
        .where(and(eq(workflows.id, workflowId), eq(workflows.userId, internalUser.id)))
        .limit(1);
      if (!ownedWorkflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }
    }

    // Update form
    await db.update(forms)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(fields !== undefined && { fields }),
        ...(workflowId !== undefined && { workflowId: workflowId || null }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(and(eq(forms.id, id), eq(forms.userId, internalUser.id)));

    const [updatedForm] = await db.select().from(forms)
      .where(and(eq(forms.id, id), eq(forms.userId, internalUser.id)))
      .limit(1);

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
    await db.delete(forms).where(and(eq(forms.id, id), eq(forms.userId, internalUser.id)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting form:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
