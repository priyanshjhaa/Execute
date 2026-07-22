import { and, eq } from 'drizzle-orm';
import { db, forms, workflows } from '@execute/db';
import type { AgentToolCall, AgentToolDefinition } from '@execute/llm';
import { z } from 'zod';
import { CreateFormInputSchema, FORM_FIELD_TYPES, FormFieldsSchema } from '@/lib/form-definition';

const ProposedFieldSchema = z.object({
  id: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/).optional(),
  label: z.string().trim().min(1).max(255),
  type: z.enum(FORM_FIELD_TYPES),
  required: z.boolean().default(false),
  placeholder: z.string().trim().max(500).optional(),
  options: z.array(z.string().trim().min(1).max(255)).min(1).max(50).optional(),
}).strict();

const CreateProposalSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(4_000).nullable().optional(),
  fields: z.array(ProposedFieldSchema).min(1).max(50),
  workflowId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
}).strict();

const UpdateProposalSchema = z.object({
  formId: z.string().uuid(),
  changes: z.object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(4_000).nullable().optional(),
    fields: z.array(ProposedFieldSchema).min(1).max(50).optional(),
  }).strict().refine((changes) => Object.keys(changes).length > 0),
}).strict();

const StatusProposalSchema = z.object({
  formId: z.string().uuid(),
  isActive: z.boolean(),
}).strict();

const LinkProposalSchema = z.object({
  formId: z.string().uuid(),
  workflowId: z.string().uuid().nullable(),
}).strict();

type FormActionType = 'form.create' | 'form.update' | 'form.activate' | 'form.deactivate' | 'form.link_workflow';

export interface AgentFormProposal {
  actionType: FormActionType;
  title: string;
  description: string;
  payload: Record<string, unknown>;
}

interface FormSnapshot {
  id?: string;
  name: string;
  description: string | null;
  fields: z.infer<typeof FormFieldsSchema>;
  isActive: boolean;
  workflowId: string | null;
  workflowName: string | null;
  publicSlug?: string | null;
  updatedAt?: string;
}

const fieldProperties = {
  id: { type: 'string', description: 'Optional stable field identifier using letters, numbers, underscores, or hyphens.' },
  label: { type: 'string', minLength: 1, maxLength: 255 },
  type: { type: 'string', enum: [...FORM_FIELD_TYPES] },
  required: { type: 'boolean', default: false },
  placeholder: { type: 'string', maxLength: 500 },
  options: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 50 },
};

const fieldsParameter = {
  type: 'array',
  minItems: 1,
  maxItems: 50,
  items: {
    type: 'object',
    properties: fieldProperties,
    required: ['label', 'type'],
    additionalProperties: false,
  },
};

export const AGENT_FORM_PROPOSAL_TOOLS: AgentToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'propose_form_create',
      description: 'Prepare a validated proposal to create a hosted form. This does not create the form until the user approves it.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: ['string', 'null'], maxLength: 4000 },
          fields: fieldsParameter,
          workflowId: { type: ['string', 'null'], format: 'uuid' },
          isActive: { type: 'boolean', default: true },
        },
        required: ['name', 'fields'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_form_update',
      description: 'Prepare a validated proposal to edit an owned form’s name, description, or fields.',
      parameters: {
        type: 'object',
        properties: {
          formId: { type: 'string', format: 'uuid' },
          changes: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 255 },
              description: { type: ['string', 'null'], maxLength: 4000 },
              fields: fieldsParameter,
            },
            additionalProperties: false,
          },
        },
        required: ['formId', 'changes'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_form_status',
      description: 'Prepare a confirmation request to activate or deactivate an owned form.',
      parameters: {
        type: 'object',
        properties: {
          formId: { type: 'string', format: 'uuid' },
          isActive: { type: 'boolean' },
        },
        required: ['formId', 'isActive'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_form_workflow_link',
      description: 'Prepare a confirmation request to link an owned form to an owned workflow, or unlink it by passing null.',
      parameters: {
        type: 'object',
        properties: {
          formId: { type: 'string', format: 'uuid' },
          workflowId: { type: ['string', 'null'], format: 'uuid' },
        },
        required: ['formId', 'workflowId'],
        additionalProperties: false,
      },
    },
  },
];

function parseArguments<S extends z.ZodTypeAny>(toolCall: AgentToolCall, schema: S) {
  if (toolCall.arguments.length > 32_000) {
    return { success: false as const, error: 'Tool arguments are too large.' };
  }
  let value: unknown;
  try {
    value = JSON.parse(toolCall.arguments || '{}');
  } catch {
    return { success: false as const, error: 'Tool arguments must be valid JSON.' };
  }
  const parsed = schema.safeParse(value);
  return parsed.success
    ? { success: true as const, data: parsed.data as z.output<S> }
    : { success: false as const, error: parsed.error.issues[0]?.message || 'Invalid form proposal.' };
}

function errorResult(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

function normalizeFields(fields: z.infer<typeof ProposedFieldSchema>[]) {
  const seen = new Set<string>();
  const normalized = fields.map((field, index) => {
    const base = field.id || `field_${index + 1}_${field.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'input'}`;
    let id = base;
    let suffix = 2;
    while (seen.has(id)) id = `${base}_${suffix++}`;
    seen.add(id);
    return {
      id,
      label: field.label,
      type: field.type,
      required: field.required,
      ...(field.placeholder ? { placeholder: field.placeholder } : {}),
      ...(field.type === 'select' ? { options: field.options } : {}),
    };
  });
  return FormFieldsSchema.safeParse(normalized);
}

async function ownedWorkflow(userId: string, workflowId: string | null | undefined) {
  if (!workflowId) return null;
  const [workflow] = await db.select({
    id: workflows.id,
    name: workflows.name,
    status: workflows.status,
  }).from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.userId, userId)))
    .limit(1);
  return workflow;
}

async function ownedFormSnapshot(userId: string, formId: string): Promise<FormSnapshot | null> {
  const [form] = await db.select({
    id: forms.id,
    name: forms.name,
    description: forms.description,
    fields: forms.fields,
    isActive: forms.isActive,
    workflowId: forms.workflowId,
    workflowName: workflows.name,
    publicSlug: forms.publicSlug,
    updatedAt: forms.updatedAt,
  }).from(forms)
    .leftJoin(workflows, and(eq(forms.workflowId, workflows.id), eq(workflows.userId, userId)))
    .where(and(eq(forms.id, formId), eq(forms.userId, userId)))
    .limit(1);
  if (!form) return null;
  const fields = FormFieldsSchema.safeParse(form.fields || []);
  if (!fields.success) return null;
  return { ...form, fields: fields.data, updatedAt: form.updatedAt.toISOString() };
}

function proposalResult(proposal: AgentFormProposal, after: FormSnapshot) {
  return {
    ok: true,
    proposal: {
      actionType: proposal.actionType,
      title: proposal.title,
      fieldCount: after.fields.length,
      requiresApproval: true,
    },
  };
}

function completeProposal(proposal: AgentFormProposal, after: FormSnapshot) {
  if (JSON.stringify(proposal.payload).length > 30_000) {
    return {
      result: errorResult(
        'PROPOSAL_TOO_LARGE',
        'This form is too large to review safely in one proposal.',
      ),
    };
  }
  return { result: proposalResult(proposal, after), proposal };
}

async function proposeCreate(userId: string, args: z.infer<typeof CreateProposalSchema>) {
  const fields = normalizeFields(args.fields);
  if (!fields.success) return { result: errorResult('INVALID_FIELDS', fields.error.issues[0]?.message || 'Invalid fields.') };
  const workflow = await ownedWorkflow(userId, args.workflowId);
  if (args.workflowId && !workflow) return { result: errorResult('WORKFLOW_NOT_FOUND', 'Workflow not found.') };
  const validated = CreateFormInputSchema.safeParse({ ...args, fields: fields.data });
  if (!validated.success) return { result: errorResult('INVALID_FORM', validated.error.issues[0]?.message || 'Invalid form.') };

  const after: FormSnapshot = {
    name: validated.data.name,
    description: validated.data.description || null,
    fields: validated.data.fields,
    isActive: validated.data.isActive,
    workflowId: validated.data.workflowId || null,
    workflowName: workflow?.name || null,
  };
  const proposal: AgentFormProposal = {
    actionType: 'form.create',
    title: `Create form: ${after.name}`,
    description: `Create a ${after.isActive ? 'live' : 'inactive'} form with ${after.fields.length} field${after.fields.length === 1 ? '' : 's'}.`,
    payload: { version: 1, operation: 'create', after },
  };
  return completeProposal(proposal, after);
}

async function proposeUpdate(userId: string, args: z.infer<typeof UpdateProposalSchema>) {
  const before = await ownedFormSnapshot(userId, args.formId);
  if (!before) return { result: errorResult('NOT_FOUND', 'Form not found or its field definition is invalid.') };
  let fields = before.fields;
  if (args.changes.fields) {
    const normalized = normalizeFields(args.changes.fields);
    if (!normalized.success) return { result: errorResult('INVALID_FIELDS', normalized.error.issues[0]?.message || 'Invalid fields.') };
    fields = normalized.data;
  }
  const after: FormSnapshot = {
    ...before,
    name: args.changes.name ?? before.name,
    description: args.changes.description === undefined ? before.description : args.changes.description,
    fields,
  };
  const changedFields = (['name', 'description', 'fields'] as const)
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
  if (!changedFields.length) return { result: errorResult('NO_CHANGES', 'The proposal does not change this form.') };
  const proposal: AgentFormProposal = {
    actionType: 'form.update',
    title: `Update form: ${before.name}`,
    description: `Review ${changedFields.length} form definition change${changedFields.length === 1 ? '' : 's'}.`,
    payload: { version: 1, operation: 'update', formId: before.id, expectedUpdatedAt: before.updatedAt, before, after, changedFields },
  };
  return completeProposal(proposal, after);
}

async function proposeStatus(userId: string, args: z.infer<typeof StatusProposalSchema>) {
  const before = await ownedFormSnapshot(userId, args.formId);
  if (!before) return { result: errorResult('NOT_FOUND', 'Form not found.') };
  if (before.isActive === args.isActive) return { result: errorResult('NO_CHANGES', `The form is already ${args.isActive ? 'active' : 'inactive'}.`) };
  const after = { ...before, isActive: args.isActive };
  const proposal: AgentFormProposal = {
    actionType: args.isActive ? 'form.activate' : 'form.deactivate',
    title: `${args.isActive ? 'Activate' : 'Deactivate'} form: ${before.name}`,
    description: args.isActive ? 'Allow new public submissions.' : 'Stop accepting new public submissions.',
    payload: { version: 1, operation: 'set_status', formId: before.id, expectedUpdatedAt: before.updatedAt, before, after },
  };
  return completeProposal(proposal, after);
}

async function proposeLink(userId: string, args: z.infer<typeof LinkProposalSchema>) {
  const before = await ownedFormSnapshot(userId, args.formId);
  if (!before) return { result: errorResult('NOT_FOUND', 'Form not found.') };
  const workflow = await ownedWorkflow(userId, args.workflowId);
  if (args.workflowId && !workflow) return { result: errorResult('WORKFLOW_NOT_FOUND', 'Workflow not found.') };
  if (before.workflowId === args.workflowId) return { result: errorResult('NO_CHANGES', args.workflowId ? 'The form is already linked to this workflow.' : 'The form is already unlinked.') };
  const after = { ...before, workflowId: args.workflowId, workflowName: workflow?.name || null };
  const proposal: AgentFormProposal = {
    actionType: 'form.link_workflow',
    title: `${args.workflowId ? 'Link workflow to' : 'Unlink workflow from'} form: ${before.name}`,
    description: args.workflowId ? `Send new submissions to ${workflow?.name}.` : 'Keep submissions without triggering a workflow.',
    payload: { version: 1, operation: 'link_workflow', formId: before.id, expectedUpdatedAt: before.updatedAt, before, after },
  };
  return completeProposal(proposal, after);
}

export function createAgentFormProposalCollector(userId: string) {
  const proposals: AgentFormProposal[] = [];
  const cachedResults = new Map<string, unknown>();
  return {
    proposals,
    handles(name: string) {
      return ['propose_form_create', 'propose_form_update', 'propose_form_status', 'propose_form_workflow_link'].includes(name);
    },
    async execute(toolCall: AgentToolCall) {
      const cacheKey = `${toolCall.name}:${toolCall.arguments}`;
      if (cachedResults.has(cacheKey)) return cachedResults.get(cacheKey);
      let generated: { result: unknown; proposal?: AgentFormProposal };
      if (toolCall.name === 'propose_form_create') {
        const args = parseArguments(toolCall, CreateProposalSchema);
        generated = args.success ? await proposeCreate(userId, args.data) : { result: errorResult('INVALID_ARGUMENTS', args.error) };
      } else if (toolCall.name === 'propose_form_update') {
        const args = parseArguments(toolCall, UpdateProposalSchema);
        generated = args.success ? await proposeUpdate(userId, args.data) : { result: errorResult('INVALID_ARGUMENTS', args.error) };
      } else if (toolCall.name === 'propose_form_status') {
        const args = parseArguments(toolCall, StatusProposalSchema);
        generated = args.success ? await proposeStatus(userId, args.data) : { result: errorResult('INVALID_ARGUMENTS', args.error) };
      } else {
        const args = parseArguments(toolCall, LinkProposalSchema);
        generated = args.success ? await proposeLink(userId, args.data) : { result: errorResult('INVALID_ARGUMENTS', args.error) };
      }
      if (generated.proposal) proposals.push(generated.proposal);
      cachedResults.set(cacheKey, generated.result);
      return generated.result;
    },
  };
}
