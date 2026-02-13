import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, forms, users } from '@execute/db';
import { eq } from 'drizzle-orm';

/**
 * Generate a unique public slug for a form
 */
function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 12; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Validate form fields configuration
 */
function validateFormFields(fields: any[]): { valid: boolean; error: string } {
  if (!Array.isArray(fields) || fields.length === 0) {
    return { valid: false, error: 'Form must have at least one field' };
  }

  const validTypes = ['text', 'email', 'number', 'textarea', 'select', 'checkbox'];

  for (const field of fields) {
    if (!field.id || !field.label) {
      return { valid: false, error: 'Each field must have an id and label' };
    }

    if (!validTypes.includes(field.type)) {
      return { valid: false, error: `Invalid field type: ${field.type}. Must be one of: ${validTypes.join(', ')}` };
    }

    if (field.type === 'select' && (!Array.isArray(field.options) || field.options.length === 0)) {
      return { valid: false, error: `Select field "${field.id}" must have at least one option` };
    }
  }

  return { valid: true, error: '' };
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

    const body = await request.json();
    const { name, description, fields, workflowId, isActive = true } = body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Form name is required' }, { status: 400 });
    }

    // Validate fields configuration
    const fieldValidation = validateFormFields(fields || []);

    if (!fieldValidation.valid) {
      return NextResponse.json({ error: fieldValidation.error }, { status: 400 });
    }

    // Generate unique public slug
    const publicSlug = generateSlug();

    const formId = generateId();

    await db.insert(forms).values({
      id: formId,
      userId: internalUser.id,
      workflowId: workflowId || null,
      name: name.trim(),
      description: description?.trim() || null,
      fields: fields || [],
      publicSlug,
      isActive: isActive !== false,
    });

    const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);

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
