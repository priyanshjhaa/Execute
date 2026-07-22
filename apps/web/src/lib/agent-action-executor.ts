import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { agentProposedActions, contacts, db, executions, forms, userIntegrations, users, workflows } from '@execute/db';
import { getAgentActionExecutionDisposition, isAgentContactActionType, isAgentExecutionActionType, isAgentFormActionType, isAgentIntegrationActionType } from '@execute/llm';
import { z } from 'zod';
import { ContactDefinitionSchema, isContactEmailConflict } from '@/lib/contact-definition';
import { CreateFormInputSchema } from '@/lib/form-definition';
import { executeWorkflow, hasActiveExecution } from '@/lib/workflow-execution';

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

class AgentActionExecutionError extends Error {}

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

async function runAction(userId: string, actionType: string, payload: Record<string, unknown>) {
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
    !isAgentExecutionActionType(currentAction.actionType)
    && !isAgentFormActionType(currentAction.actionType)
    && !isAgentContactActionType(currentAction.actionType)
    && !isAgentIntegrationActionType(currentAction.actionType)
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
