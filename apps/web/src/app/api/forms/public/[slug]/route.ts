import { NextRequest, NextResponse } from 'next/server';
import { db, forms, formSubmissions, workflows } from '@execute/db';
import { eq } from 'drizzle-orm';

/**
 * Generate a unique ID
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * GET /api/forms/[slug] - Return form data as JSON
 * This allows the frontend to render the form directly without a redirect
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Look up form by public slug
    const [form] = await db.select()
      .from(forms)
      .where(eq(forms.publicSlug, slug))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (!form.isActive) {
      return NextResponse.json({ error: 'Form is not active' }, { status: 400 });
    }

    // Return form data as JSON
    return NextResponse.json({
      form: {
        name: form.name,
        description: form.description,
        fields: form.fields,
      },
    });
  } catch (error: any) {
    console.error('Error fetching form:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/forms/[slug] - Handle public form submission
 * No auth required - this is the public submission endpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Look up form by public slug
    const [form] = await db.select()
      .from(forms)
      .where(eq(forms.publicSlug, slug))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (!form.isActive) {
      return NextResponse.json({ error: 'Form is not active' }, { status: 400 });
    }

    // Parse submission body
    const body = await request.json();
    const payload = body;

    // Validate required fields based on form definition
    const formFields = form.fields || [];
    const errors: string[] = [];

    for (const field of formFields) {
      if (field.required) {
        const value = payload[field.id];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          errors.push(`Field "${field.label}" is required`);
        }
      }

      // Email validation
      if (field.type === 'email' && payload[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(payload[field.id])) {
          errors.push(`Field "${field.label}" must be a valid email`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // Store submission
    const submissionId = generateId();

    await db.insert(formSubmissions).values({
      id: submissionId,
      formId: form.id,
      payload,
    });

    // If form has a linked workflow, trigger it
    if (form.workflowId) {
      // Fetch the workflow to get its webhookId
      const [workflow] = await db.select()
        .from(workflows)
        .where(eq(workflows.id, form.workflowId))
        .limit(1);

      if (workflow?.webhookId) {
        const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/webhooks/${workflow.webhookId}`;

        // Fire and forget - don't wait for response
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'form_submission',
            source: `form:${slug}`,
            data: payload,
          }),
        }).catch((err) => {
          console.error('Error triggering workflow:', err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: form.workflowId
        ? 'Form submitted successfully'
        : 'Form submitted successfully',
      submissionId,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error submitting form:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
