import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import {
  contacts,
  db,
  executionLogs,
  executions,
  forms,
  steps,
  userIntegrations,
  workflows,
} from '@execute/db';
import type { AgentToolCall, AgentToolDefinition } from '@execute/llm';
import { z } from 'zod';
import { INTEGRATION_OAUTH_GUIDES, sanitizeIntegration } from '@/lib/integration-metadata';

const MAX_TOOL_ARGUMENT_CHARS = 10_000;

const ListWorkflowsSchema = z.object({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  limit: z.number().int().min(1).max(25).default(10),
}).strict();

const GetWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
}).strict();

const ListExecutionsSchema = z.object({
  workflowId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'waiting']).optional(),
  limit: z.number().int().min(1).max(25).default(10),
}).strict();

const GetExecutionSchema = z.object({
  executionId: z.string().uuid(),
}).strict();

const GetExecutionLogsSchema = z.object({
  executionId: z.string().uuid(),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
}).strict();

const ListFormsSchema = z.object({
  isActive: z.boolean().optional(),
  limit: z.number().int().min(1).max(25).default(10),
}).strict();

const GetFormSchema = z.object({
  formId: z.string().uuid(),
}).strict();

const SearchContactsSchema = z.object({
  query: z.string().trim().min(1).max(200),
  isActive: z.boolean().optional(),
  limit: z.number().int().min(1).max(25).default(10),
}).strict();

const GetContactSchema = z.object({
  contactId: z.string().uuid(),
}).strict();

const ListIntegrationsSchema = z.object({
  type: z.enum(['slack', 'google-sheets', 'google-calendar', 'notion']).optional(),
  isActive: z.boolean().optional(),
  limit: z.number().int().min(1).max(25).default(10),
}).strict();

const GetIntegrationSchema = z.object({
  integrationId: z.string().uuid(),
}).strict();

const GetIntegrationOAuthGuideSchema = z.object({
  type: z.enum(['slack', 'google-sheets', 'google-calendar', 'notion']),
}).strict();

export const AGENT_READ_ONLY_TOOLS: AgentToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_integrations',
      description: 'List safe connection status for integrations in the current workspace. Credentials and raw configuration are never returned.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['slack', 'google-sheets', 'google-calendar', 'notion'] },
          isActive: { type: 'boolean' },
          limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_integration',
      description: 'Inspect safe status metadata for one integration owned by the current workspace. Secrets are never returned.',
      parameters: {
        type: 'object',
        properties: { integrationId: { type: 'string', format: 'uuid' } },
        required: ['integrationId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_integration_oauth_guide',
      description: 'Get safe, user-driven OAuth connection instructions and availability for a provider. This does not start OAuth or expose credentials.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['slack', 'google-sheets', 'google-calendar', 'notion'] },
        },
        required: ['type'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_contacts',
      description: 'Search owned contacts by name, email, company, department, or job title. This tool is read-only.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1, maxLength: 200 },
          isActive: { type: 'boolean' },
          limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contact',
      description: 'Get one contact from the current user workspace. This tool is read-only.',
      parameters: {
        type: 'object',
        properties: { contactId: { type: 'string', format: 'uuid' } },
        required: ['contactId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_forms',
      description: 'List forms in the current user workspace, optionally filtered by active state. This tool is read-only.',
      parameters: {
        type: 'object',
        properties: {
          isActive: { type: 'boolean' },
          limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_form',
      description: 'Get one form, its fields, status, and linked workflow from the current user workspace. This tool is read-only.',
      parameters: {
        type: 'object',
        properties: { formId: { type: 'string', format: 'uuid' } },
        required: ['formId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_workflows',
      description: 'List workflows in the current user workspace. This tool is read-only.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['draft', 'active', 'archived'] },
          limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_workflow',
      description: 'Get one workflow and its definition from the current user workspace. This tool is read-only.',
      parameters: {
        type: 'object',
        properties: { workflowId: { type: 'string', format: 'uuid' } },
        required: ['workflowId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_executions',
      description: 'List recent executions in the current user workspace, optionally filtered by workflow or status. This tool is read-only.',
      parameters: {
        type: 'object',
        properties: {
          workflowId: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'waiting'],
          },
          limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_execution',
      description: 'Get one execution and its step results from the current user workspace. This tool is read-only.',
      parameters: {
        type: 'object',
        properties: { executionId: { type: 'string', format: 'uuid' } },
        required: ['executionId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_execution_logs',
      description: 'Get logs for an execution owned by the current user, optionally filtered by level. This tool is read-only.',
      parameters: {
        type: 'object',
        properties: {
          executionId: { type: 'string', format: 'uuid' },
          level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        },
        required: ['executionId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'diagnose_failed_execution',
      description: 'Inspect an owned failed execution, its failed steps, and error logs to identify likely causes and next checks. This tool is read-only.',
      parameters: {
        type: 'object',
        properties: { executionId: { type: 'string', format: 'uuid' } },
        required: ['executionId'],
        additionalProperties: false,
      },
    },
  },
];

function toolError(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

function parseArguments<S extends z.ZodTypeAny>(
  toolCall: AgentToolCall,
  schema: S,
): z.output<S> | ReturnType<typeof toolError> {
  if (toolCall.arguments.length > MAX_TOOL_ARGUMENT_CHARS) {
    return toolError('INVALID_ARGUMENTS', 'Tool arguments are too large.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(toolCall.arguments || '{}');
  } catch {
    return toolError('INVALID_ARGUMENTS', 'Tool arguments must be valid JSON.');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return toolError('INVALID_ARGUMENTS', 'Tool arguments did not match the required schema.');
  }
  return result.data;
}

function isToolError(value: unknown): value is ReturnType<typeof toolError> {
  return Boolean(value && typeof value === 'object' && 'ok' in value && value.ok === false);
}

function classifyFailure(messages: string[]) {
  const combined = messages.join(' ').toLowerCase();
  if (/unauthori[sz]ed|forbidden|permission|credential|api key|token expired/.test(combined)) {
    return {
      category: 'authentication_or_permissions',
      checks: ['Verify the integration is connected.', 'Refresh expired credentials and confirm required permissions.'],
    };
  }
  if (/rate.?limit|too many requests|\b429\b|quota/.test(combined)) {
    return {
      category: 'rate_limit_or_quota',
      checks: ['Check provider quota and rate limits.', 'Retry later or reduce request frequency.'],
    };
  }
  if (/timeout|timed out|network|connection|dns|socket/.test(combined)) {
    return {
      category: 'network_or_timeout',
      checks: ['Check provider availability and network access.', 'Retry the execution after confirming timeout settings.'],
    };
  }
  if (/invalid|required|validation|malformed|bad request|\b400\b/.test(combined)) {
    return {
      category: 'invalid_input',
      checks: ['Review the failed step inputs and required fields.', 'Confirm mapped values match the provider format.'],
    };
  }
  if (/not found|missing|configuration|not configured|\b404\b/.test(combined)) {
    return {
      category: 'missing_resource_or_configuration',
      checks: ['Confirm referenced resources still exist.', 'Review the workflow and integration configuration.'],
    };
  }
  return {
    category: 'unknown',
    checks: ['Review the execution error and failed-step logs.', 'Retry once after validating the workflow configuration.'],
  };
}

async function listIntegrations(userId: string, args: z.infer<typeof ListIntegrationsSchema>) {
  const filters = [eq(userIntegrations.userId, userId)];
  if (args.type) filters.push(eq(userIntegrations.type, args.type));
  if (args.isActive !== undefined) filters.push(eq(userIntegrations.isActive, args.isActive));
  const rows = await db.select().from(userIntegrations)
    .where(and(...filters))
    .orderBy(desc(userIntegrations.updatedAt))
    .limit(args.limit);
  return { ok: true, integrations: rows.map(sanitizeIntegration) };
}

async function getIntegration(userId: string, integrationId: string) {
  const [integration] = await db.select().from(userIntegrations)
    .where(and(
      eq(userIntegrations.id, integrationId),
      eq(userIntegrations.userId, userId),
    ))
    .limit(1);
  return integration
    ? { ok: true, integration: sanitizeIntegration(integration) }
    : toolError('NOT_FOUND', 'Integration not found.');
}

async function getIntegrationOAuthGuide(userId: string, type: keyof typeof INTEGRATION_OAUTH_GUIDES) {
  const [integration] = await db.select().from(userIntegrations)
    .where(and(
      eq(userIntegrations.userId, userId),
      eq(userIntegrations.type, type),
    ))
    .orderBy(desc(userIntegrations.updatedAt))
    .limit(1);
  return {
    ok: true,
    guide: INTEGRATION_OAUTH_GUIDES[type],
    connection: integration ? sanitizeIntegration(integration) : null,
  };
}

async function listWorkflows(userId: string, args: z.infer<typeof ListWorkflowsSchema>) {
  const filters = [eq(workflows.userId, userId)];
  if (args.status) filters.push(eq(workflows.status, args.status));

  const rows = await db.select({
    id: workflows.id,
    name: workflows.name,
    description: workflows.description,
    status: workflows.status,
    triggerType: workflows.triggerType,
    lastExecutedAt: workflows.lastExecutedAt,
    totalExecutions: workflows.totalExecutions,
    successRate: workflows.successRate,
    createdAt: workflows.createdAt,
    updatedAt: workflows.updatedAt,
  }).from(workflows)
    .where(and(...filters))
    .orderBy(desc(workflows.updatedAt))
    .limit(args.limit);

  return { ok: true, workflows: rows };
}

async function listForms(userId: string, args: z.infer<typeof ListFormsSchema>) {
  const filters = [eq(forms.userId, userId)];
  if (args.isActive !== undefined) filters.push(eq(forms.isActive, args.isActive));

  const rows = await db.select({
    id: forms.id,
    name: forms.name,
    description: forms.description,
    publicSlug: forms.publicSlug,
    isActive: forms.isActive,
    workflowId: forms.workflowId,
    workflowName: workflows.name,
    fields: forms.fields,
    createdAt: forms.createdAt,
    updatedAt: forms.updatedAt,
  }).from(forms)
    .leftJoin(workflows, and(
      eq(forms.workflowId, workflows.id),
      eq(workflows.userId, userId),
    ))
    .where(and(...filters))
    .orderBy(desc(forms.updatedAt))
    .limit(args.limit);

  return {
    ok: true,
    forms: rows.map(({ fields, ...form }) => ({
      ...form,
      fieldCount: fields?.length || 0,
    })),
  };
}

async function searchContacts(userId: string, args: z.infer<typeof SearchContactsSchema>) {
  const pattern = `%${args.query}%`;
  const filters = [
    eq(contacts.userId, userId),
    or(
      ilike(contacts.name, pattern),
      ilike(contacts.email, pattern),
      ilike(contacts.company, pattern),
      ilike(contacts.department, pattern),
      ilike(contacts.jobTitle, pattern),
    )!,
  ];
  if (args.isActive !== undefined) filters.push(eq(contacts.isActive, args.isActive));

  const rows = await db.select({
    id: contacts.id,
    name: contacts.name,
    email: contacts.email,
    phone: contacts.phone,
    department: contacts.department,
    jobTitle: contacts.jobTitle,
    company: contacts.company,
    tags: contacts.tags,
    isActive: contacts.isActive,
    createdAt: contacts.createdAt,
    updatedAt: contacts.updatedAt,
  }).from(contacts)
    .where(and(...filters))
    .orderBy(desc(contacts.updatedAt))
    .limit(args.limit);

  return { ok: true, contacts: rows };
}

async function getContact(userId: string, contactId: string) {
  const [contact] = await db.select().from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
    .limit(1);
  return contact
    ? { ok: true, contact }
    : toolError('NOT_FOUND', 'Contact not found.');
}

async function getForm(userId: string, formId: string) {
  const [form] = await db.select({
    id: forms.id,
    name: forms.name,
    description: forms.description,
    fields: forms.fields,
    publicSlug: forms.publicSlug,
    isActive: forms.isActive,
    workflowId: forms.workflowId,
    workflowName: workflows.name,
    createdAt: forms.createdAt,
    updatedAt: forms.updatedAt,
  }).from(forms)
    .leftJoin(workflows, and(
      eq(forms.workflowId, workflows.id),
      eq(workflows.userId, userId),
    ))
    .where(and(eq(forms.id, formId), eq(forms.userId, userId)))
    .limit(1);

  return form
    ? { ok: true, form }
    : toolError('NOT_FOUND', 'Form not found.');
}

async function getWorkflow(userId: string, workflowId: string) {
  const [workflow] = await db.select().from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.userId, userId)))
    .limit(1);

  return workflow
    ? { ok: true, workflow }
    : toolError('NOT_FOUND', 'Workflow not found.');
}

async function listExecutions(userId: string, args: z.infer<typeof ListExecutionsSchema>) {
  const filters = [eq(executions.userId, userId)];
  if (args.workflowId) filters.push(eq(executions.workflowId, args.workflowId));
  if (args.status) filters.push(eq(executions.status, args.status));

  const rows = await db.select({
    id: executions.id,
    workflowId: executions.workflowId,
    workflowName: workflows.name,
    instruction: executions.instruction,
    status: executions.status,
    startedAt: executions.startedAt,
    completedAt: executions.completedAt,
    totalSteps: executions.totalSteps,
    completedSteps: executions.completedSteps,
    errorMessage: executions.errorMessage,
    createdAt: executions.createdAt,
  }).from(executions)
    .leftJoin(workflows, and(
      eq(executions.workflowId, workflows.id),
      eq(workflows.userId, userId),
    ))
    .where(and(...filters))
    .orderBy(desc(executions.createdAt))
    .limit(args.limit);

  return { ok: true, executions: rows };
}

async function getOwnedExecution(userId: string, executionId: string) {
  const [execution] = await db.select({
    id: executions.id,
    workflowId: executions.workflowId,
    workflowName: workflows.name,
    instruction: executions.instruction,
    triggerData: executions.triggerData,
    status: executions.status,
    cancelRequested: executions.cancelRequested,
    startedAt: executions.startedAt,
    completedAt: executions.completedAt,
    totalSteps: executions.totalSteps,
    completedSteps: executions.completedSteps,
    errorMessage: executions.errorMessage,
    metadata: executions.metadata,
    createdAt: executions.createdAt,
    updatedAt: executions.updatedAt,
  }).from(executions)
    .leftJoin(workflows, and(
      eq(executions.workflowId, workflows.id),
      eq(workflows.userId, userId),
    ))
    .where(and(eq(executions.id, executionId), eq(executions.userId, userId)))
    .limit(1);

  return execution;
}

async function getOwnedSteps(userId: string, executionId: string, failedOnly = false) {
  const filters = [eq(steps.executionId, executionId), eq(executions.userId, userId)];
  if (failedOnly) filters.push(eq(steps.status, 'failed'));

  return db.select({
    id: steps.id,
    stepOrder: steps.stepOrder,
    stepType: steps.stepType,
    description: steps.description,
    status: steps.status,
    startedAt: steps.startedAt,
    completedAt: steps.completedAt,
    errorMessage: steps.errorMessage,
    retryCount: steps.retryCount,
    outputResult: steps.outputResult,
  }).from(steps)
    .innerJoin(executions, eq(steps.executionId, executions.id))
    .where(and(...filters))
    .orderBy(asc(steps.stepOrder));
}

async function getOwnedLogs(
  userId: string,
  args: z.infer<typeof GetExecutionLogsSchema>,
) {
  const filters = [
    eq(executionLogs.executionId, args.executionId),
    eq(executions.userId, userId),
  ];
  if (args.level) filters.push(eq(executionLogs.level, args.level));

  return db.select({
    id: executionLogs.id,
    executionId: executionLogs.executionId,
    stepId: executionLogs.stepId,
    level: executionLogs.level,
    message: executionLogs.message,
    metadata: executionLogs.metadata,
    createdAt: executionLogs.createdAt,
  }).from(executionLogs)
    .innerJoin(executions, eq(executionLogs.executionId, executions.id))
    .where(and(...filters))
    .orderBy(desc(executionLogs.createdAt))
    .limit(args.limit);
}

async function getExecution(userId: string, executionId: string) {
  const execution = await getOwnedExecution(userId, executionId);
  if (!execution) return toolError('NOT_FOUND', 'Execution not found.');

  const executionSteps = await getOwnedSteps(userId, executionId);
  return { ok: true, execution: { ...execution, steps: executionSteps } };
}

async function getExecutionLogs(userId: string, args: z.infer<typeof GetExecutionLogsSchema>) {
  const execution = await getOwnedExecution(userId, args.executionId);
  if (!execution) return toolError('NOT_FOUND', 'Execution not found.');

  const logs = await getOwnedLogs(userId, args);
  return { ok: true, executionId: args.executionId, logs };
}

async function diagnoseFailedExecution(userId: string, executionId: string) {
  const execution = await getOwnedExecution(userId, executionId);
  if (!execution) return toolError('NOT_FOUND', 'Execution not found.');
  if (execution.status !== 'failed') {
    return toolError('NOT_FAILED', `Execution status is ${execution.status}, not failed.`);
  }

  const [failedSteps, errorLogs] = await Promise.all([
    getOwnedSteps(userId, executionId, true),
    getOwnedLogs(userId, { executionId, level: 'error', limit: 50 }),
  ]);
  const evidence = [
    execution.errorMessage,
    ...failedSteps.map((step) => step.errorMessage),
    ...errorLogs.map((log) => log.message),
  ].filter((message): message is string => Boolean(message));
  const classification = classifyFailure(evidence);

  return {
    ok: true,
    diagnosis: {
      execution: {
        id: execution.id,
        workflowId: execution.workflowId,
        workflowName: execution.workflowName,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        errorMessage: execution.errorMessage,
      },
      likelyCategory: classification.category,
      recommendedChecks: classification.checks,
      failedSteps,
      recentErrorLogs: errorLogs,
      evidenceCount: evidence.length,
    },
  };
}

export async function executeAgentReadOnlyTool(userId: string, toolCall: AgentToolCall) {
  switch (toolCall.name) {
    case 'list_integrations': {
      const args = parseArguments(toolCall, ListIntegrationsSchema);
      return isToolError(args) ? args : listIntegrations(userId, args);
    }
    case 'get_integration': {
      const args = parseArguments(toolCall, GetIntegrationSchema);
      return isToolError(args) ? args : getIntegration(userId, args.integrationId);
    }
    case 'get_integration_oauth_guide': {
      const args = parseArguments(toolCall, GetIntegrationOAuthGuideSchema);
      return isToolError(args) ? args : getIntegrationOAuthGuide(userId, args.type);
    }
    case 'search_contacts': {
      const args = parseArguments(toolCall, SearchContactsSchema);
      return isToolError(args) ? args : searchContacts(userId, args);
    }
    case 'get_contact': {
      const args = parseArguments(toolCall, GetContactSchema);
      return isToolError(args) ? args : getContact(userId, args.contactId);
    }
    case 'list_forms': {
      const args = parseArguments(toolCall, ListFormsSchema);
      return isToolError(args) ? args : listForms(userId, args);
    }
    case 'get_form': {
      const args = parseArguments(toolCall, GetFormSchema);
      return isToolError(args) ? args : getForm(userId, args.formId);
    }
    case 'list_workflows': {
      const args = parseArguments(toolCall, ListWorkflowsSchema);
      return isToolError(args) ? args : listWorkflows(userId, args);
    }
    case 'get_workflow': {
      const args = parseArguments(toolCall, GetWorkflowSchema);
      return isToolError(args) ? args : getWorkflow(userId, args.workflowId);
    }
    case 'list_executions': {
      const args = parseArguments(toolCall, ListExecutionsSchema);
      return isToolError(args) ? args : listExecutions(userId, args);
    }
    case 'get_execution': {
      const args = parseArguments(toolCall, GetExecutionSchema);
      return isToolError(args) ? args : getExecution(userId, args.executionId);
    }
    case 'get_execution_logs': {
      const args = parseArguments(toolCall, GetExecutionLogsSchema);
      return isToolError(args) ? args : getExecutionLogs(userId, args);
    }
    case 'diagnose_failed_execution': {
      const args = parseArguments(toolCall, GetExecutionSchema);
      return isToolError(args) ? args : diagnoseFailedExecution(userId, args.executionId);
    }
    default:
      return toolError('UNKNOWN_TOOL', 'The requested tool is not available.');
  }
}
