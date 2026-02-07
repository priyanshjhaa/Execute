import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, quickCommands, loggedEvents, users, contacts } from '@execute/db';
import { eq, and, desc, count, or, like, sql } from 'drizzle-orm';
import { createQuickCommandParser } from '@execute/llm';
import { Resend } from 'resend';

// Initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
      // Try to send actual email using Resend
      const recipient = data?.recipient || data?.email;
      const subject = data?.subject || title;
      const message = data?.message || data?.body || '';

      let emailSent = false;
      let emailError = null;

      if (resend && recipient && process.env.RESEND_FROM_EMAIL) {
        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: recipient,
            subject: subject,
            text: message,
          });
          emailSent = true;
        } catch (error: any) {
          console.error('Resend error:', error);
          emailError = error.message;
        }
      }

      const [loggedEvent] = await db.insert(loggedEvents).values({
        userId,
        eventType: 'email',
        title: `Email: ${title}`,
        data: {
          ...data,
          status: emailSent ? 'sent' : 'logged',
          sentAt: emailSent ? new Date().toISOString() : null,
          error: emailError,
        },
      }).returning();

      return {
        type: emailSent ? 'email_sent' : 'email_queued',
        message: emailSent
          ? `✓ Email sent to ${recipient}`
          : resend
            ? `✓ Email logged (recipient email required to send)`
            : `✓ Email "${title}" logged`,
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
    // Expense query - total spending
    if (entity === 'expense') {
      const userExpenses = await db.select()
        .from(loggedEvents)
        .where(and(eq(loggedEvents.userId, userId), eq(loggedEvents.eventType, 'expense')));

      const total = userExpenses.reduce((sum: number, e: any) => {
        const amount = e.data?.amount || 0;
        return sum + Number(amount);
      }, 0);

      // Group by category
      const byCategory = userExpenses.reduce((acc: Record<string, number>, e: any) => {
        const cat = e.data?.category || 'other';
        acc[cat] = (acc[cat] || 0) + Number(e.data?.amount || 0);
        return acc;
      }, {});

      const categoryBreakdown = Object.entries(byCategory)
        .map(([cat, amount]) => `${cat}: ₹${amount.toLocaleString()}`)
        .join(', ');

      return {
        type: 'query_result',
        message: `Total expenses: ₹${total.toLocaleString()} (${userExpenses.length} transactions)${categoryBreakdown ? ' - ' + categoryBreakdown : ''}`,
        count: userExpenses.length,
        total,
        breakdown: byCategory,
      };
    }

    // Client query - list clients
    if (entity === 'client') {
      const userClients = await db.select()
        .from(loggedEvents)
        .where(and(eq(loggedEvents.userId, userId), eq(loggedEvents.eventType, 'client')))
        .orderBy(desc(loggedEvents.createdAt))
        .limit(10);

      const clientNames = userClients.map((c: any) => c.data?.company || c.title).filter(Boolean);

      return {
        type: 'query_result',
        message: `You have ${userClients.length} client(s) logged${clientNames.length > 0 ? ': ' + clientNames.slice(0, 5).join(', ') + (clientNames.length > 5 ? '...' : '') : ''}`,
        count: userClients.length,
        recent: clientNames,
      };
    }

    // Contact query - count contacts
    if (entity === 'contact') {
      const [result] = await db.select({ count: count() })
        .from(contacts)
        .where(eq(contacts.userId, userId));

      const recentContacts = await db.select()
        .from(contacts)
        .where(eq(contacts.userId, userId))
        .orderBy(desc(contacts.createdAt))
        .limit(5);

      const contactNames = recentContacts.map((c: any) => c.name).filter(Boolean);

      return {
        type: 'query_result',
        message: `You have ${result.count} contact(s)${contactNames.length > 0 ? '. Recent: ' + contactNames.join(', ') : ''}`,
        count: result.count,
        recent: contactNames,
      };
    }

    // Task query - list pending tasks
    if (entity === 'task') {
      const userTasks = await db.select()
        .from(loggedEvents)
        .where(and(eq(loggedEvents.userId, userId), eq(loggedEvents.eventType, 'task')))
        .orderBy(desc(loggedEvents.createdAt))
        .limit(10);

      const taskTitles = userTasks.map((t: any) => t.title).filter(Boolean);

      return {
        type: 'query_result',
        message: `You have ${userTasks.length} task(s) logged${taskTitles.length > 0 ? ': ' + taskTitles.slice(0, 5).join(', ') + (taskTitles.length > 5 ? '...' : '') : ''}`,
        count: userTasks.length,
        recent: taskTitles,
      };
    }

    // Note query - list notes
    if (entity === 'note') {
      const userNotes = await db.select()
        .from(loggedEvents)
        .where(and(eq(loggedEvents.userId, userId), eq(loggedEvents.eventType, 'note')))
        .orderBy(desc(loggedEvents.createdAt))
        .limit(5);

      const noteTitles = userNotes.map((n: any) => n.title).filter(Boolean);

      return {
        type: 'query_result',
        message: `You have ${userNotes.length} note(s)${noteTitles.length > 0 ? '. Recent: ' + noteTitles.join(', ') : ''}`,
        count: userNotes.length,
        recent: noteTitles,
      };
    }

    // Generic summary
    const [allEvents] = await db.select({ count: count() })
      .from(loggedEvents)
      .where(eq(loggedEvents.userId, userId));

    return {
      type: 'query_result',
      message: `You have ${allEvents.count} total logged events`,
      count: allEvents.count,
    };
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
    const limit = parseInt(searchParams.get('limit') || '20');
    const filter = searchParams.get('filter') || 'all';
    const searchQuery = searchParams.get('search') || '';

    // Build where conditions
    const conditions = [eq(quickCommands.userId, internalUser.id)];

    // Add filter by entity type
    if (filter !== 'all') {
      conditions.push(
        sql`${quickCommands.classifiedIntent}->>'entity' = ${filter}`
      );
    }

    // Add search condition (search in input text)
    if (searchQuery) {
      conditions.push(
        like(quickCommands.input, `%${searchQuery}%`)
      );
    }

    const history = await db.select()
      .from(quickCommands)
      .where(and(...conditions))
      .orderBy(desc(quickCommands.createdAt))
      .limit(limit + 1);

    const hasMore = history.length > limit;
    const items = hasMore ? history.slice(0, limit) : history;

    // Get counts for each filter type
    const [counts] = await db.select({
      all: count(),
      expense: count(sql`${quickCommands.classifiedIntent}->>'entity' = 'expense'`),
      client: count(sql`${quickCommands.classifiedIntent}->>'entity' = 'client'`),
      task: count(sql`${quickCommands.classifiedIntent}->>'entity' = 'task'`),
      email: count(sql`${quickCommands.classifiedIntent}->>'entity' = 'email'`),
      note: count(sql`${quickCommands.classifiedIntent}->>'entity' = 'note'`),
      contact: count(sql`${quickCommands.classifiedIntent}->>'entity' = 'contact'`),
      reminder: count(sql`${quickCommands.classifiedIntent}->>'entity' = 'reminder'`),
    }).from(quickCommands).where(eq(quickCommands.userId, internalUser.id));

    return NextResponse.json({
      history: items,
      hasMore,
      counts: {
        all: counts.all,
        expense: counts.expense,
        client: counts.client,
        task: counts.task,
        email: counts.email,
        note: counts.note,
        contact: counts.contact,
        reminder: counts.reminder,
      },
    });

  } catch (error: any) {
    console.error('Quick command history error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
