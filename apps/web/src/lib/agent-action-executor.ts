import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { agentProposedActions, contacts, db, executions, forms, loggedEvents, userIntegrations, users, workflows } from '@execute/db';
import {
  getAgentActionExecutionDisposition,
  isAgentContactActionType,
  isAgentExecutionActionType,
  isAgentFormActionType,
  isAgentIntegrationActionType,
  isAgentQuickActionType,
  isAgentWorkflowActionType,
  WorkflowSchema,
} from '@execute/llm';
import { createDefaultContext, WorkflowValidator } from '@execute/validation';
import { z } from 'zod';
import { ContactDefinitionSchema, isContactEmailConflict } from '@/lib/contact-definition';
import { CreateFormInputSchema } from '@/lib/form-definition';
import { executeWorkflow, hasActiveExecution } from '@/lib/workflow-execution';
import { buildScheduleExpression } from '@/lib/schedule';
import { Resend } from 'resend';

const RunPayloadSchema = z.object({
  workflowId: z.string().uuid(),
  inputData: z.record(z.string(), z.unknown()).default({}),
}).passthrough();

const ExecutionPayloadSchema = z.object({
  executionId: z.string().uuid(),
}).passthrough();

const FormActionPayloadSchema = z.object({
  formId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
  after: z.object({
    name: z.string(),
    description: z.string().nullable(),
    fields: z.array(z.unknown()),
    isActive: z.boolean(),
    workflowId: z.string().uuid().nullable(),
  }).passthrough(),
}).passthrough();

const ContactActionPayloadSchema = z.object({
  contactId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
  after: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    department: z.string().nullable(),
    jobTitle: z.string().nullable(),
    company: z.string().nullable(),
    tags: z.array(z.string()),
    notes: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    isActive: z.boolean(),
  }).passthrough(),
}).passthrough();

const IntegrationDisconnectPayloadSchema = z.object({
  integrationId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
}).passthrough();

const WorkflowSnapshotSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(255),
  description: z.string().max(4_000).optional().nullable(),
  status: z.enum(['draft', 'active', 'archived']),
  triggerType: z.string().trim().min(1).max(50),
  triggerConfig: z.record(z.string(), z.unknown()),
  scheduleExpression: z.string().max(255).nullable(),
  definition: z.object({
    steps: WorkflowSchema.shape.steps,
    triggerStepId: z.string().uuid(),
  }).strict(),
  updatedAt: z.string().datetime().optional(),
}).passthrough();

const WorkflowActionPayloadSchema = z.object({
  operation: z.enum(['create', 'update']),
  workflowId: z.string().uuid().optional(),
  before: WorkflowSnapshotSchema.optional(),
  after: WorkflowSnapshotSchema,
}).passthrough();

const ScheduleTriggerSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  day: z.string().trim().min(1).max(20).optional(),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().trim().min(1).max(100),
}).passthrough();

const EventLogPayloadSchema = z.object({
  operation: z.literal('log'),
  eventType: z.enum(['expense', 'client', 'task', 'note', 'other']),
  title: z.string().trim().min(1).max(255),
  data: z.record(z.string(), z.unknown()).default({}),
}).passthrough();

const EmailSendPayloadSchema = z.object({
  operation: z.literal('send'),
  recipient: z.string().trim().email().max(320),
  subject: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(10_000),
}).passthrough();

class AgentActionExecutionError extends Error {}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

async function validateWorkflowForExecution(userId: string, snapshot: z.output<typeof WorkflowSnapshotSchema>) {
  const workflow = WorkflowSchema.parse({
    name: snapshot.name,
    description: snapshot.description || undefined,
    steps: snapshot.definition.steps,
    triggerStepId: snapshot.definition.triggerStepId,
  });
  const triggerStep = workflow.steps.find((step) => step.id === workflow.triggerStepId);
  if (!triggerStep || triggerStep.type !== snapshot.triggerType) {
    throw new AgentActionExecutionError('The workflow trigger metadata does not match its definition.');
  }
  if (snapshot.status === 'archived') {
    return { workflow, scheduleExpression: snapshot.scheduleExpression };
  }

  let scheduleExpression: string | null = null;
  if (snapshot.triggerType === 'schedule') {
    const schedule = ScheduleTriggerSchema.safeParse(snapshot.triggerConfig);
    if (!schedule.success || !isValidTimeZone(schedule.data.timezone)) {
      throw new AgentActionExecutionError('The scheduled workflow requires a valid time and IANA timezone.');
    }
    scheduleExpression = buildScheduleExpression(schedule.data);
  }

  const integrations = await db.select({
    id: userIntegrations.id,
    type: userIntegrations.type,
    isActive: userIntegrations.isActive,
  }).from(userIntegrations).where(eq(userIntegrations.userId, userId));
  const activeIntegrations = integrations.filter((integration) => integration.isActive);
  const context = createDefaultContext();
  context.integrations = {
    ...context.integrations,
    ...Object.fromEntries(activeIntegrations.map((integration) => [integration.type, true])),
  };
  context.availableVariables = {
    ...context.availableVariables,
    workflow: { id: snapshot.id || 'proposed', name: workflow.name },
    timestamp: new Date().toISOString(),
  };
  const validation = await new WorkflowValidator().validateWorkflow(workflow, context);
  if (!validation.valid) {
    throw new AgentActionExecutionError(`The workflow is no longer valid: ${validation.errors.slice(0, 3).join(' ')}`);
  }

  for (const step of workflow.steps) {
    if (step.type === 'send_email' && !process.env.RESEND_API_KEY && !context.integrations.resend) {
      throw new AgentActionExecutionError('Email delivery is not configured for this workspace.');
    }
    if (step.type === 'send_slack') {
      const integrationId = typeof step.config.integrationId === 'string' ? step.config.integrationId : null;
      const hasSlack = activeIntegrations.some((integration) => integration.type === 'slack'
        && (!integrationId || integration.id === integrationId));
      if (!hasSlack) throw new AgentActionExecutionError('The required Slack integration is not connected.');
    }
  }

  return { workflow, scheduleExpression };
}

async function executeWorkflowDefinitionAction(
  userId: string,
  actionType: string,
  payload: Record<string, unknown>,
) {
  const args = WorkflowActionPayloadSchema.safeParse(payload);
  if (!args.success) throw new AgentActionExecutionError('The workflow proposal is invalid.');
  const expectedOperation = actionType === 'workflow.create' ? 'create' : 'update';
  if (args.data.operation !== expectedOperation) {
    throw new AgentActionExecutionError('The workflow proposal operation does not match the approved action.');
  }
  const { workflow, scheduleExpression } = await validateWorkflowForExecution(userId, args.data.after);

  if (actionType === 'workflow.create') {
    if (args.data.after.status !== 'active') {
      throw new AgentActionExecutionError('Approved agent-created workflows must be active.');
    }
    const webhookId = args.data.after.triggerType === 'webhook' ? crypto.randomUUID() : null;
    const [created] = await db.insert(workflows).values({
      userId,
      name: workflow.name,
      description: workflow.description || null,
      definition: { steps: workflow.steps, triggerStepId: workflow.triggerStepId },
      triggerType: args.data.after.triggerType,
      triggerConfig: args.data.after.triggerConfig,
      scheduleExpression,
      status: 'active',
      webhookId,
      totalExecutions: 0,
      successRate: 0,
    }).returning({ id: workflows.id, name: workflows.name, status: workflows.status });
    if (!created) throw new AgentActionExecutionError('The approved workflow could not be created.');
    return {
      kind: 'workflow_create',
      workflowId: created.id,
      name: created.name,
      status: created.status,
      scheduleExpression,
      href: `/dashboard/workflows/${created.id}`,
    };
  }

  const workflowId = args.data.workflowId || args.data.after.id;
  const expectedUpdatedAt = args.data.before?.updatedAt;
  if (!workflowId || !expectedUpdatedAt) {
    throw new AgentActionExecutionError('The workflow update proposal is missing its edit version.');
  }
  const [current] = await db.select({
    id: workflows.id,
    triggerType: workflows.triggerType,
    webhookId: workflows.webhookId,
    updatedAt: workflows.updatedAt,
  })
    .from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.userId, userId)))
    .limit(1);
  if (!current) throw new AgentActionExecutionError('Workflow not found.');
  if (current.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new AgentActionExecutionError('This workflow changed after the proposal was prepared. Review it and try again.');
  }
  const [updated] = await db.update(workflows).set({
    name: workflow.name,
    description: workflow.description || null,
    definition: { steps: workflow.steps, triggerStepId: workflow.triggerStepId },
    triggerType: args.data.after.triggerType,
    triggerConfig: args.data.after.triggerConfig,
    scheduleExpression,
    status: args.data.after.status,
    webhookId: args.data.after.triggerType === 'webhook'
      ? current.triggerType === 'webhook' && current.webhookId ? current.webhookId : crypto.randomUUID()
      : null,
    updatedAt: new Date(),
  }).where(and(
    eq(workflows.id, workflowId),
    eq(workflows.userId, userId),
    eq(workflows.updatedAt, current.updatedAt),
  )).returning({ id: workflows.id, name: workflows.name, status: workflows.status });
  if (!updated) throw new AgentActionExecutionError('The workflow changed while the approved update was being applied.');
  return {
    kind: 'workflow_update',
    workflowId: updated.id,
    name: updated.name,
    status: updated.status,
    scheduleExpression,
    href: `/dashboard/workflows/${updated.id}`,
  };
}

async function executeIntegrationDisconnect(userId: string, payload: Record<string, unknown>) {
  const args = IntegrationDisconnectPayloadSchema.safeParse(payload);
  if (!args.success) throw new AgentActionExecutionError('The integration disconnect proposal is invalid.');

  const [integration] = await db.select({
    id: userIntegrations.id,
    type: userIntegrations.type,
    name: userIntegrations.name,
    updatedAt: userIntegrations.updatedAt,
  }).from(userIntegrations)
    .where(and(
      eq(userIntegrations.id, args.data.integrationId),
      eq(userIntegrations.userId, userId),
    ))
    .limit(1);
  if (!integration) throw new AgentActionExecutionError('Integration not found.');
  if (integration.updatedAt.toISOString() !== args.data.expectedUpdatedAt) {
    throw new AgentActionExecutionError('The integration changed after this proposal was prepared. Review its current status and try again.');
  }

  const [deleted] = await db.delete(userIntegrations)
    .where(and(
      eq(userIntegrations.id, integration.id),
      eq(userIntegrations.userId, userId),
      eq(userIntegrations.updatedAt, integration.updatedAt),
    ))
    .returning({ id: userIntegrations.id });
  if (!deleted) throw new AgentActionExecutionError('The integration changed while the approved action was being applied.');

  return {
    kind: 'integration_disconnect',
    integrationId: integration.id,
    type: integration.type,
    name: integration.name,
    status: 'disconnected',
    href: '/dashboard/integrations',
  };
}

async function getInternalUser(userId: string) {
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
  }).from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AgentActionExecutionError('User not found.');
  return user;
}

async function executeWorkflowRun(userId: string, payload: Record<string, unknown>) {
  const args = RunPayloadSchema.safeParse(payload);
  if (!args.success) throw new AgentActionExecutionError('The workflow run proposal is invalid.');

  const [workflow] = await db.select().from(workflows)
    .where(and(eq(workflows.id, args.data.workflowId), eq(workflows.userId, userId)))
    .limit(1);
  if (!workflow) throw new AgentActionExecutionError('Workflow not found.');
  if (workflow.status === 'archived') {
    throw new AgentActionExecutionError('Archived workflows cannot be run.');
  }
  if (await hasActiveExecution(workflow.id, userId)) {
    throw new AgentActionExecutionError('This workflow already has an active execution.');
  }

  const internalUser = await getInternalUser(userId);
  const result = await executeWorkflow({
    workflow: workflow as any,
    internalUser,
    triggerType: 'manual',
    triggerSource: 'agent_approval',
    triggerPayload: args.data.inputData,
  });
  return {
    kind: 'workflow_run',
    ...result,
    href: `/dashboard/executions/${result.executionId}`,
  };
}

async function executeCancellation(userId: string, payload: Record<string, unknown>) {
  const args = ExecutionPayloadSchema.safeParse(payload);
  if (!args.success) throw new AgentActionExecutionError('The cancellation proposal is invalid.');

  const [updated] = await db.update(executions)
    .set({ cancelRequested: true, updatedAt: new Date() })
    .where(and(
      eq(executions.id, args.data.executionId),
      eq(executions.userId, userId),
      inArray(executions.status, ['running', 'waiting']),
    ))
    .returning({ id: executions.id, status: executions.status });

  if (!updated) {
    const [execution] = await db.select({
      id: executions.id,
      status: executions.status,
      cancelRequested: executions.cancelRequested,
    }).from(executions)
      .where(and(eq(executions.id, args.data.executionId), eq(executions.userId, userId)))
      .limit(1);
    if (!execution) throw new AgentActionExecutionError('Execution not found.');
    if (!execution.cancelRequested && execution.status !== 'cancelled') {
      throw new AgentActionExecutionError(`Execution cannot be cancelled with status ${execution.status}.`);
    }
  }

  return {
    kind: 'execution_cancel',
    executionId: args.data.executionId,
    status: 'cancellation_requested',
    href: `/dashboard/executions/${args.data.executionId}`,
  };
}

async function executeRetry(userId: string, payload: Record<string, unknown>) {
  const args = ExecutionPayloadSchema.safeParse(payload);
  if (!args.success) throw new AgentActionExecutionError('The retry proposal is invalid.');

  const [originalExecution] = await db.select().from(executions)
    .where(and(eq(executions.id, args.data.executionId), eq(executions.userId, userId)))
    .limit(1);
  if (!originalExecution) throw new AgentActionExecutionError('Execution not found.');
  if (originalExecution.status !== 'failed') {
    throw new AgentActionExecutionError('Only failed executions can be retried.');
  }
  if (!originalExecution.workflowId) {
    throw new AgentActionExecutionError('The failed execution has no workflow to retry.');
  }

  const [workflow] = await db.select().from(workflows)
    .where(and(
      eq(workflows.id, originalExecution.workflowId),
      eq(workflows.userId, userId),
    ))
    .limit(1);
  if (!workflow) throw new AgentActionExecutionError('Workflow not found.');
  if (workflow.status !== 'active') {
    throw new AgentActionExecutionError('Only active workflows can be retried.');
  }
  if (await hasActiveExecution(workflow.id, userId)) {
    throw new AgentActionExecutionError('This workflow already has an active execution.');
  }

  const internalUser = await getInternalUser(userId);
  const result = await executeWorkflow({
    workflow: workflow as any,
    internalUser,
    triggerType: 'manual',
    triggerSource: 'agent_retry',
    triggerPayload: originalExecution.triggerData?.data || {},
  });
  return {
    kind: 'execution_retry',
    ...result,
    retriedFrom: originalExecution.id,
    href: `/dashboard/executions/${result.executionId}`,
  };
}

function generateFormSlug(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

async function assertOwnedWorkflow(userId: string, workflowId: string | null) {
  if (!workflowId) return;
  const [workflow] = await db.select({ id: workflows.id }).from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.userId, userId)))
    .limit(1);
  if (!workflow) throw new AgentActionExecutionError('Linked workflow not found.');
}

async function executeFormAction(
  userId: string,
  actionType: string,
  payload: Record<string, unknown>,
) {
  const args = FormActionPayloadSchema.safeParse(payload);
  if (!args.success) throw new AgentActionExecutionError('The form proposal is invalid.');
  const validatedAfter = CreateFormInputSchema.safeParse({
    name: args.data.after.name,
    description: args.data.after.description,
    fields: args.data.after.fields,
    isActive: args.data.after.isActive,
    workflowId: args.data.after.workflowId,
  });
  if (!validatedAfter.success) throw new AgentActionExecutionError('The proposed form definition is invalid.');
  const after = validatedAfter.data;
  await assertOwnedWorkflow(userId, after.workflowId || null);

  if (actionType === 'form.create') {
    const [created] = await db.insert(forms).values({
      userId,
      name: after.name,
      description: after.description || null,
      fields: after.fields,
      workflowId: after.workflowId || null,
      isActive: after.isActive,
      publicSlug: generateFormSlug(),
    }).returning({ id: forms.id, publicSlug: forms.publicSlug, isActive: forms.isActive });
    if (!created) throw new AgentActionExecutionError('The form could not be created.');
    return {
      kind: 'form_create',
      formId: created.id,
      isActive: created.isActive,
      href: `/dashboard/forms/${created.id}/edit`,
      publicHref: created.publicSlug ? `/f/${created.publicSlug}` : null,
    };
  }

  if (!args.data.formId || !args.data.expectedUpdatedAt) {
    throw new AgentActionExecutionError('The form proposal is missing its edit version.');
  }
  const [current] = await db.select({
    id: forms.id,
    updatedAt: forms.updatedAt,
  }).from(forms)
    .where(and(eq(forms.id, args.data.formId), eq(forms.userId, userId)))
    .limit(1);
  if (!current) throw new AgentActionExecutionError('Form not found.');
  if (current.updatedAt.toISOString() !== args.data.expectedUpdatedAt) {
    throw new AgentActionExecutionError('This form changed after the proposal was created. Review it and propose the change again.');
  }

  let updates: Partial<typeof forms.$inferInsert>;
  if (actionType === 'form.update') {
    updates = {
      name: after.name,
      description: after.description || null,
      fields: after.fields,
    };
  } else if (actionType === 'form.activate' || actionType === 'form.deactivate') {
    const expectedState = actionType === 'form.activate';
    if (after.isActive !== expectedState) throw new AgentActionExecutionError('The proposed form status is invalid.');
    updates = { isActive: expectedState };
  } else if (actionType === 'form.link_workflow') {
    updates = { workflowId: after.workflowId || null };
  } else {
    throw new AgentActionExecutionError('This form action is not supported.');
  }

  const [updated] = await db.update(forms)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(
      eq(forms.id, current.id),
      eq(forms.userId, userId),
      eq(forms.updatedAt, current.updatedAt),
    ))
    .returning({ id: forms.id, publicSlug: forms.publicSlug, isActive: forms.isActive, workflowId: forms.workflowId });
  if (!updated) throw new AgentActionExecutionError('The form changed while the approved action was being applied.');
  return {
    kind: actionType.replace('.', '_'),
    formId: updated.id,
    isActive: updated.isActive,
    workflowId: updated.workflowId,
    href: `/dashboard/forms/${updated.id}/edit`,
    publicHref: updated.publicSlug ? `/f/${updated.publicSlug}` : null,
  };
}

async function assertUniqueContactEmail(userId: string, email: string, excludeId?: string) {
  const filters = [
    eq(contacts.userId, userId),
    sql`lower(${contacts.email}) = ${email}`,
  ];
  if (excludeId) filters.push(ne(contacts.id, excludeId));
  const [duplicate] = await db.select({ id: contacts.id }).from(contacts)
    .where(and(...filters))
    .limit(1);
  if (duplicate) throw new AgentActionExecutionError('A contact with this email already exists.');
}

async function executeContactAction(
  userId: string,
  actionType: string,
  payload: Record<string, unknown>,
) {
  const args = ContactActionPayloadSchema.safeParse(payload);
  if (!args.success) throw new AgentActionExecutionError('The contact proposal is invalid.');
  const validatedAfter = ContactDefinitionSchema.safeParse({
    name: args.data.after.name,
    email: args.data.after.email,
    phone: args.data.after.phone,
    department: args.data.after.department,
    jobTitle: args.data.after.jobTitle,
    company: args.data.after.company,
    tags: args.data.after.tags,
    notes: args.data.after.notes,
    avatarUrl: args.data.after.avatarUrl,
    isActive: args.data.after.isActive,
  });
  if (!validatedAfter.success) throw new AgentActionExecutionError('The proposed contact is invalid.');
  const after = validatedAfter.data;

  if (actionType === 'contact.create') {
    await assertUniqueContactEmail(userId, after.email);
    try {
      const [created] = await db.insert(contacts).values({
        userId,
        name: after.name,
        email: after.email,
        phone: after.phone || null,
        department: after.department || null,
        jobTitle: after.jobTitle || null,
        company: after.company || null,
        tags: after.tags,
        notes: after.notes || null,
        avatarUrl: after.avatarUrl || null,
        isActive: after.isActive,
      }).returning({ id: contacts.id, email: contacts.email, isActive: contacts.isActive });
      if (!created) throw new AgentActionExecutionError('The contact could not be created.');
      return {
        kind: 'contact_create',
        contactId: created.id,
        email: created.email,
        isActive: created.isActive,
        href: `/dashboard/contacts/${created.id}/edit`,
      };
    } catch (error) {
      if (isContactEmailConflict(error)) {
        throw new AgentActionExecutionError('A contact with this email already exists.');
      }
      throw error;
    }
  }

  if (!args.data.contactId || !args.data.expectedUpdatedAt) {
    throw new AgentActionExecutionError('The contact proposal is missing its edit version.');
  }
  const [current] = await db.select({ id: contacts.id, updatedAt: contacts.updatedAt })
    .from(contacts)
    .where(and(eq(contacts.id, args.data.contactId), eq(contacts.userId, userId)))
    .limit(1);
  if (!current) throw new AgentActionExecutionError('Contact not found.');
  if (current.updatedAt.toISOString() !== args.data.expectedUpdatedAt) {
    throw new AgentActionExecutionError('This contact changed after the proposal was created. Review it and propose the change again.');
  }

  let updates: Partial<typeof contacts.$inferInsert>;
  if (actionType === 'contact.update') {
    await assertUniqueContactEmail(userId, after.email, current.id);
    updates = {
      name: after.name,
      email: after.email,
      phone: after.phone || null,
      department: after.department || null,
      jobTitle: after.jobTitle || null,
      company: after.company || null,
      tags: after.tags,
      notes: after.notes || null,
      avatarUrl: after.avatarUrl || null,
    };
  } else if (actionType === 'contact.activate' || actionType === 'contact.deactivate') {
    const expectedState = actionType === 'contact.activate';
    if (after.isActive !== expectedState) throw new AgentActionExecutionError('The proposed contact status is invalid.');
    updates = { isActive: expectedState };
  } else {
    throw new AgentActionExecutionError('This contact action is not supported.');
  }

  try {
    const [updated] = await db.update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(contacts.id, current.id),
        eq(contacts.userId, userId),
        eq(contacts.updatedAt, current.updatedAt),
      ))
      .returning({ id: contacts.id, email: contacts.email, isActive: contacts.isActive });
    if (!updated) throw new AgentActionExecutionError('The contact changed while the approved action was being applied.');
    return {
      kind: actionType.replace('.', '_'),
      contactId: updated.id,
      email: updated.email,
      isActive: updated.isActive,
      href: `/dashboard/contacts/${updated.id}/edit`,
    };
  } catch (error) {
    if (isContactEmailConflict(error)) {
      throw new AgentActionExecutionError('A contact with this email already exists.');
    }
    throw error;
  }
}

async function executeQuickAction(userId: string, actionType: string, payload: Record<string, unknown>) {
  if (actionType === 'event.log') {
    const args = EventLogPayloadSchema.safeParse(payload);
    if (!args.success || JSON.stringify(args.data.data).length > 8_000) {
      throw new AgentActionExecutionError('The event proposal is invalid or too large.');
    }
    const [event] = await db.insert(loggedEvents).values({
      userId,
      eventType: args.data.eventType,
      title: args.data.title,
      data: args.data.data,
    }).returning({ id: loggedEvents.id, eventType: loggedEvents.eventType, title: loggedEvents.title });
    if (!event) throw new AgentActionExecutionError('The event could not be logged.');
    return { kind: 'event_log', eventId: event.id, eventType: event.eventType, title: event.title };
  }

  const args = EmailSendPayloadSchema.safeParse(payload);
  if (!args.success) throw new AgentActionExecutionError('The email proposal is invalid.');
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new AgentActionExecutionError('Email delivery is not configured.');
  }
  const response = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: args.data.recipient,
    subject: args.data.subject,
    text: args.data.body,
  });
  if (response.error) throw new AgentActionExecutionError('The email provider rejected the message.');
  const [event] = await db.insert(loggedEvents).values({
    userId,
    eventType: 'email',
    title: `Email: ${args.data.subject}`,
    data: {
      recipient: args.data.recipient,
      subject: args.data.subject,
      status: 'sent',
      providerMessageId: response.data?.id || null,
      sentAt: new Date().toISOString(),
    },
  }).returning({ id: loggedEvents.id });
  return {
    kind: 'email_send',
    eventId: event?.id || null,
    recipient: args.data.recipient,
    subject: args.data.subject,
    status: 'sent',
  };
}

async function runAction(userId: string, actionType: string, payload: Record<string, unknown>) {
  if (isAgentQuickActionType(actionType)) {
    return executeQuickAction(userId, actionType, payload);
  }
  if (isAgentWorkflowActionType(actionType)) {
    return executeWorkflowDefinitionAction(userId, actionType, payload);
  }
  if (isAgentIntegrationActionType(actionType)) {
    return executeIntegrationDisconnect(userId, payload);
  }
  if (isAgentContactActionType(actionType)) {
    return executeContactAction(userId, actionType, payload);
  }
  if (isAgentFormActionType(actionType)) {
    return executeFormAction(userId, actionType, payload);
  }
  switch (actionType) {
    case 'workflow.run':
      return executeWorkflowRun(userId, payload);
    case 'execution.cancel':
      return executeCancellation(userId, payload);
    case 'execution.retry':
      return executeRetry(userId, payload);
    default:
      throw new AgentActionExecutionError('This approved action is not executable yet.');
  }
}

export async function executeApprovedAgentAction(userId: string, actionId: string) {
  const [currentAction] = await db.select().from(agentProposedActions)
    .where(and(
      eq(agentProposedActions.id, actionId),
      eq(agentProposedActions.userId, userId),
    ))
    .limit(1);
  if (!currentAction) return { handled: false as const, action: null };
  if (
    !isAgentWorkflowActionType(currentAction.actionType)
    && !isAgentExecutionActionType(currentAction.actionType)
    && !isAgentFormActionType(currentAction.actionType)
    && !isAgentContactActionType(currentAction.actionType)
    && !isAgentIntegrationActionType(currentAction.actionType)
    && !isAgentQuickActionType(currentAction.actionType)
  ) {
    return { handled: false as const, action: currentAction };
  }
  if (getAgentActionExecutionDisposition(currentAction.status) !== 'claim') {
    return { handled: true as const, action: currentAction };
  }

  const startedAt = new Date();
  const [claimedAction] = await db.update(agentProposedActions)
    .set({
      status: 'executing',
      executionStartedAt: startedAt,
      updatedAt: startedAt,
      errorMessage: null,
    })
    .where(and(
      eq(agentProposedActions.id, actionId),
      eq(agentProposedActions.userId, userId),
      eq(agentProposedActions.status, 'approved'),
    ))
    .returning();

  if (!claimedAction) {
    const [action] = await db.select().from(agentProposedActions)
      .where(and(
        eq(agentProposedActions.id, actionId),
        eq(agentProposedActions.userId, userId),
      ))
      .limit(1);
    return { handled: true as const, action: action || currentAction };
  }

  try {
    const result = await runAction(userId, claimedAction.actionType, claimedAction.payload);
    const completedAt = new Date();
    const [completedAction] = await db.update(agentProposedActions)
      .set({
        status: 'completed',
        result,
        executionCompletedAt: completedAt,
        updatedAt: completedAt,
      })
      .where(and(
        eq(agentProposedActions.id, actionId),
        eq(agentProposedActions.userId, userId),
        eq(agentProposedActions.status, 'executing'),
      ))
      .returning();
    return { handled: true as const, action: completedAction || claimedAction };
  } catch (error) {
    const completedAt = new Date();
    const errorMessage = error instanceof AgentActionExecutionError
      ? error.message
      : 'The approved action could not be completed.';
    const [failedAction] = await db.update(agentProposedActions)
      .set({
        status: 'failed',
        errorMessage,
        executionCompletedAt: completedAt,
        updatedAt: completedAt,
      })
      .where(and(
        eq(agentProposedActions.id, actionId),
        eq(agentProposedActions.userId, userId),
        eq(agentProposedActions.status, 'executing'),
      ))
      .returning();
    return { handled: true as const, action: failedAction || claimedAction };
  }
}
