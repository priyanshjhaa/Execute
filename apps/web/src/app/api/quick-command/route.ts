import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, quickCommands, loggedEvents, users, contacts } from '@execute/db';
import { eq, and } from 'drizzle-orm';
import { createQuickCommandParser } from '@execute/llm';

export async function POST(request: NextRequest) {
  try {
    // Get user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get internal user
    const [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));

    if (!internalUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get input
    const body = await request.json();
    const { input } = body;

    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 });
    }

    // Parse intent using LLM
    const parser = createQuickCommandParser();
    const classification = await parser.parse(input.trim());

    // Perform action based on intent
    const actionTaken = await performAction(internalUser.id, classification);

    // Save quick command record
    const [quickCommand] = await db.insert(quickCommands).values({
      userId: internalUser.id,
      input: input.trim(),
      classifiedIntent: classification,
      actionTaken,
      status: 'completed',
    }).returning();

    return NextResponse.json({
      success: true,
      classification,
      actionTaken,
      quickCommand,
    });

  } catch (error: any) {
    console.error('Quick command error:', error);

    // Try to save error record if we have a user
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));
        if (internalUser) {
          await db.insert(quickCommands).values({
            userId: internalUser.id,
            input: await request.json().then((b: any) => b.input || 'unknown'),
            classifiedIntent: {},
            actionTaken: {},
            status: 'failed',
            errorMessage: error.message,
          });
        }
      }
    } catch (e) {
      // Ignore save error
    }

    return NextResponse.json(
      { error: error.message || 'Failed to process command' },
      { status: 500 }
    );
  }
}

async function performAction(userId: string, classification: any): Promise<any> {
  const { intent, entity, title, data, delay_days, delay_hours } = classification;

  // Handle log_event - save to logged_events
  if (intent === 'log_event') {
    const [loggedEvent] = await db.insert(loggedEvents).values({
      userId,
      eventType: entity,
      title,
      data: data || {},
    }).returning();

    return {
      type: 'logged',
      message: `✓ ${title}`,
      loggedEvent,
    };
  }

  // Handle execute_now - perform action immediately
  if (intent === 'execute_now') {
    if (entity === 'contact') {
      // Add contact
      const [contact] = await db.insert(contacts).values({
        userId,
        name: data?.name || title,
        email: data?.email,
        phone: data?.phone,
        tags: data?.tags || [],
      }).returning();

      return {
        type: 'contact_created',
        message: `✓ Contact "${data?.name || title}" added`,
        contact,
      };
    }

    if (entity === 'email') {
      // For now, just log it - actual email sending would require Resend integration
      const [loggedEvent] = await db.insert(loggedEvents).values({
        userId,
        eventType: 'email',
        title: `Email: ${title}`,
        data: { ...data, status: 'queued' },
      }).returning();

      return {
        type: 'email_queued',
        message: `✓ Email "${title}" queued`,
        loggedEvent,
      };
    }

    // Default to logging
    const [loggedEvent] = await db.insert(loggedEvents).values({
      userId,
      eventType: entity,
      title,
      data: data || {},
    }).returning();

    return {
      type: 'logged',
      message: `✓ ${title}`,
      loggedEvent,
    };
  }

  // Handle schedule_followup - save + create reminder
  if (intent === 'schedule_followup') {
    const [loggedEvent] = await db.insert(loggedEvents).values({
      userId,
      eventType: 'reminder',
      title,
      data: {
        ...data,
        scheduled_for: delay_days
          ? new Date(Date.now() + delay_days * 24 * 60 * 60 * 1000).toISOString()
          : delay_hours
          ? new Date(Date.now() + delay_hours * 60 * 60 * 1000).toISOString()
          : null,
      },
    }).returning();

    return {
      type: 'reminder_set',
      message: `✓ ${title}`,
      reminderInfo: delay_days ? `Following up in ${delay_days} days` : delay_hours ? `Following up in ${delay_hours} hours` : null,
      loggedEvent,
    };
  }

  // Handle query_only - return summary
  if (intent === 'query_only') {
    if (entity === 'expense') {
      const userExpenses = await db.select()
        .from(loggedEvents)
        .where(and(eq(loggedEvents.userId, userId), eq(loggedEvents.eventType, 'expense')));

      const total = userExpenses.reduce((sum: number, e: any) => {
        const amount = e.data?.amount || 0;
        return sum + Number(amount);
      }, 0);

      return {
        type: 'query_result',
        message: `Total expenses: ₹${total.toLocaleString()}`,
        count: userExpenses.length,
      };
    }
  }

  return {
    type: 'unknown',
    message: `Command processed: ${title}`,
  };
}

// GET endpoint for history
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const history = await db.select()
      .from(quickCommands)
      .where(eq(quickCommands.userId, internalUser.id))
      .orderBy(quickCommands.createdAt)
      .limit(limit + 1);

    const hasMore = history.length > limit;
    const items = hasMore ? history.slice(0, limit) : history;

    return NextResponse.json({
      history: items,
      hasMore,
    });

  } catch (error: any) {
    console.error('Quick command history error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
