import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, forms, users, workflows } from '@execute/db';
import { and, eq } from 'drizzle-orm';
import { CreateFormInputSchema, formValidationMessage } from '@/lib/form-definition';

function generateSlug(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

/**
 * GET /api/forms - List all forms for authenticated user
 */
export async function GET(request: NextRequest) {
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

    const userForms = await db.select()
      .from(forms)
      .where(eq(forms.userId, internalUser.id))
      .orderBy(forms.createdAt);

    return NextResponse.json({
      forms: userForms.map((form) => ({
        id: form.id,
        name: form.name,
        description: form.description,
        publicSlug: form.publicSlug,
        isActive: form.isActive,
        fieldCount: form.fields?.length || 0,
        hasWorkflow: !!form.workflowId,
        workflowId: form.workflowId,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error listing forms:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

/**
 * POST /api/forms - Create a new form
 */
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

    const body = await request.json().catch(() => null);
    const parsed = CreateFormInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formValidationMessage(parsed.error) }, { status: 400 });
    }
    const { name, description, fields, workflowId, isActive } = parsed.data;

    if (workflowId) {
      const [ownedWorkflow] = await db.select({ id: workflows.id }).from(workflows)
        .where(and(eq(workflows.id, workflowId), eq(workflows.userId, internalUser.id)))
        .limit(1);
      if (!ownedWorkflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }
    }

    // Generate unique public slug
    const publicSlug = generateSlug();

    const formId = crypto.randomUUID();

    await db.insert(forms).values({
      id: formId,
      userId: internalUser.id,
      workflowId: workflowId || null,
      name,
      description: description || null,
      fields,
      publicSlug,
      isActive,
    });

    const [form] = await db.select().from(forms)
      .where(and(eq(forms.id, formId), eq(forms.userId, internalUser.id)))
      .limit(1);

    return NextResponse.json({
      form: {
        id: form.id,
        name: form.name,
        description: form.description,
        publicSlug: form.publicSlug,
        isActive: form.isActive,
        fields: form.fields,
        workflowId: form.workflowId,
        publicUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/f/${publicSlug}`,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating form:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
