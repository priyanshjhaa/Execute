import { and, eq, ne, sql } from 'drizzle-orm';
import { contacts, db } from '@execute/db';
import type { AgentToolCall, AgentToolDefinition } from '@execute/llm';
import { z } from 'zod';
import { ContactDefinitionSchema } from '@/lib/contact-definition';

const CreateContactProposalSchema = ContactDefinitionSchema;

const UpdateContactProposalSchema = z.object({
  contactId: z.string().uuid(),
  changes: ContactDefinitionSchema.omit({ isActive: true }).partial().refine(
    (changes) => Object.keys(changes).length > 0,
    { message: 'At least one contact change is required.' },
  ),
}).strict();

const ContactStatusProposalSchema = z.object({
  contactId: z.string().uuid(),
  isActive: z.boolean(),
}).strict();

type ContactActionType = 'contact.create' | 'contact.update' | 'contact.activate' | 'contact.deactivate';

export interface AgentContactProposal {
  actionType: ContactActionType;
  title: string;
  description: string;
  payload: Record<string, unknown>;
}

interface ContactSnapshot {
  id?: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  company: string | null;
  tags: string[];
  notes: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  updatedAt?: string;
}

const nullableString = (maxLength: number) => ({
  type: ['string', 'null'],
  maxLength,
});

const contactProperties = {
  name: { type: 'string', minLength: 1, maxLength: 255 },
  email: { type: 'string', format: 'email', maxLength: 255 },
  phone: nullableString(50),
  department: nullableString(100),
  jobTitle: nullableString(150),
  company: nullableString(255),
  tags: {
    type: 'array',
    items: { type: 'string', minLength: 1, maxLength: 100 },
    maxItems: 50,
  },
  notes: nullableString(10_000),
  avatarUrl: { type: ['string', 'null'], format: 'uri', maxLength: 500 },
};

export const AGENT_CONTACT_PROPOSAL_TOOLS: AgentToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'propose_contact_create',
      description: 'Prepare a validated proposal to create a contact. This does not create the contact until the user approves it.',
      parameters: {
        type: 'object',
        properties: {
          ...contactProperties,
          isActive: { type: 'boolean', default: true },
        },
        required: ['name', 'email'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_contact_update',
      description: 'Prepare a validated proposal to edit an owned contact. Use the contact status tool for activation changes.',
      parameters: {
        type: 'object',
        properties: {
          contactId: { type: 'string', format: 'uuid' },
          changes: {
            type: 'object',
            properties: contactProperties,
            additionalProperties: false,
          },
        },
        required: ['contactId', 'changes'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_contact_status',
      description: 'Prepare a confirmation request to activate or deactivate an owned contact.',
      parameters: {
        type: 'object',
        properties: {
          contactId: { type: 'string', format: 'uuid' },
          isActive: { type: 'boolean' },
        },
        required: ['contactId', 'isActive'],
        additionalProperties: false,
      },
    },
  },
];

function parseArguments<S extends z.ZodTypeAny>(toolCall: AgentToolCall, schema: S) {
  if (toolCall.arguments.length > 24_000) {
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
    : { success: false as const, error: parsed.error.issues[0]?.message || 'Invalid contact proposal.' };
}

function errorResult(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

function snapshotFromStored(contact: typeof contacts.$inferSelect): ContactSnapshot {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    department: contact.department,
    jobTitle: contact.jobTitle,
    company: contact.company,
    tags: contact.tags || [],
    notes: contact.notes,
    avatarUrl: contact.avatarUrl,
    isActive: contact.isActive,
    updatedAt: contact.updatedAt.toISOString(),
  };
}

async function getOwnedContact(userId: string, contactId: string) {
  const [contact] = await db.select().from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
    .limit(1);
  return contact;
}

async function findDuplicateEmail(userId: string, email: string, excludeId?: string) {
  const filters = [
    eq(contacts.userId, userId),
    sql`lower(${contacts.email}) = ${email}`,
  ];
  if (excludeId) filters.push(ne(contacts.id, excludeId));
  const [duplicate] = await db.select({ id: contacts.id, name: contacts.name })
    .from(contacts)
    .where(and(...filters))
    .limit(1);
  return duplicate;
}

function completeProposal(proposal: AgentContactProposal, after: ContactSnapshot) {
  if (JSON.stringify(proposal.payload).length > 30_000) {
    return { result: errorResult('PROPOSAL_TOO_LARGE', 'This contact proposal is too large to review safely.') };
  }
  return {
    result: {
      ok: true,
      proposal: {
        actionType: proposal.actionType,
        title: proposal.title,
        email: after.email,
        requiresApproval: true,
      },
    },
    proposal,
  };
}

async function proposeCreate(userId: string, args: z.infer<typeof CreateContactProposalSchema>) {
  const duplicate = await findDuplicateEmail(userId, args.email);
  if (duplicate) {
    return { result: errorResult('DUPLICATE_EMAIL', `A contact named ${duplicate.name} already uses this email address.`) };
  }
  const after: ContactSnapshot = {
    name: args.name,
    email: args.email,
    phone: args.phone || null,
    department: args.department || null,
    jobTitle: args.jobTitle || null,
    company: args.company || null,
    tags: args.tags,
    notes: args.notes || null,
    avatarUrl: args.avatarUrl || null,
    isActive: args.isActive,
  };
  const proposal: AgentContactProposal = {
    actionType: 'contact.create',
    title: `Create contact: ${after.name}`,
    description: `Add ${after.email} as an ${after.isActive ? 'active' : 'inactive'} contact.`,
    payload: { version: 1, operation: 'create', after },
  };
  return completeProposal(proposal, after);
}

async function proposeUpdate(userId: string, args: z.infer<typeof UpdateContactProposalSchema>) {
  const stored = await getOwnedContact(userId, args.contactId);
  if (!stored) return { result: errorResult('NOT_FOUND', 'Contact not found.') };
  const before = snapshotFromStored(stored);
  const { id: _id, updatedAt: _updatedAt, ...currentDefinition } = before;
  const validated = ContactDefinitionSchema.safeParse({ ...currentDefinition, ...args.changes });
  if (!validated.success) return { result: errorResult('INVALID_CONTACT', validated.error.issues[0]?.message || 'Invalid contact.') };
  const after: ContactSnapshot = {
    ...before,
    ...validated.data,
    phone: validated.data.phone || null,
    department: validated.data.department || null,
    jobTitle: validated.data.jobTitle || null,
    company: validated.data.company || null,
    notes: validated.data.notes || null,
    avatarUrl: validated.data.avatarUrl || null,
  };
  if (after.email !== before.email) {
    const duplicate = await findDuplicateEmail(userId, after.email, stored.id);
    if (duplicate) return { result: errorResult('DUPLICATE_EMAIL', `A contact named ${duplicate.name} already uses this email address.`) };
  }
  const mutableFields: Array<keyof ContactSnapshot> = [
    'name', 'email', 'phone', 'department', 'jobTitle', 'company', 'tags', 'notes', 'avatarUrl',
  ];
  const changedFields = mutableFields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
  if (!changedFields.length) return { result: errorResult('NO_CHANGES', 'The proposal does not change this contact.') };
  const proposal: AgentContactProposal = {
    actionType: 'contact.update',
    title: `Update contact: ${before.name}`,
    description: `Review ${changedFields.length} contact change${changedFields.length === 1 ? '' : 's'}.`,
    payload: { version: 1, operation: 'update', contactId: before.id, expectedUpdatedAt: before.updatedAt, before, after, changedFields },
  };
  return completeProposal(proposal, after);
}

async function proposeStatus(userId: string, args: z.infer<typeof ContactStatusProposalSchema>) {
  const stored = await getOwnedContact(userId, args.contactId);
  if (!stored) return { result: errorResult('NOT_FOUND', 'Contact not found.') };
  const before = snapshotFromStored(stored);
  if (before.isActive === args.isActive) {
    return { result: errorResult('NO_CHANGES', `The contact is already ${args.isActive ? 'active' : 'inactive'}.`) };
  }
  const after = { ...before, isActive: args.isActive };
  const proposal: AgentContactProposal = {
    actionType: args.isActive ? 'contact.activate' : 'contact.deactivate',
    title: `${args.isActive ? 'Activate' : 'Deactivate'} contact: ${before.name}`,
    description: args.isActive ? 'Make this contact available for active use.' : 'Keep this contact record but mark it inactive.',
    payload: { version: 1, operation: 'set_status', contactId: before.id, expectedUpdatedAt: before.updatedAt, before, after },
  };
  return completeProposal(proposal, after);
}

export function createAgentContactProposalCollector(userId: string) {
  const proposals: AgentContactProposal[] = [];
  const cachedResults = new Map<string, unknown>();
  return {
    proposals,
    handles(name: string) {
      return ['propose_contact_create', 'propose_contact_update', 'propose_contact_status'].includes(name);
    },
    async execute(toolCall: AgentToolCall) {
      const cacheKey = `${toolCall.name}:${toolCall.arguments}`;
      if (cachedResults.has(cacheKey)) return cachedResults.get(cacheKey);
      let generated: { result: unknown; proposal?: AgentContactProposal };
      if (toolCall.name === 'propose_contact_create') {
        const args = parseArguments(toolCall, CreateContactProposalSchema);
        generated = args.success ? await proposeCreate(userId, args.data) : { result: errorResult('INVALID_ARGUMENTS', args.error) };
      } else if (toolCall.name === 'propose_contact_update') {
        const args = parseArguments(toolCall, UpdateContactProposalSchema);
        generated = args.success ? await proposeUpdate(userId, args.data) : { result: errorResult('INVALID_ARGUMENTS', args.error) };
      } else {
        const args = parseArguments(toolCall, ContactStatusProposalSchema);
        generated = args.success ? await proposeStatus(userId, args.data) : { result: errorResult('INVALID_ARGUMENTS', args.error) };
      }
      if (generated.proposal) proposals.push(generated.proposal);
      cachedResults.set(cacheKey, generated.result);
      return generated.result;
    },
  };
}
