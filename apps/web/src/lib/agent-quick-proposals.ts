import type { AgentToolCall, AgentToolDefinition } from '@execute/llm';
import { z } from 'zod';

const EventLogSchema = z.object({
  eventType: z.enum(['expense', 'client', 'task', 'note', 'other']),
  title: z.string().trim().min(1).max(255),
  data: z.record(z.string(), z.unknown()).default({}),
}).strict();

const EmailSendSchema = z.object({
  recipient: z.string().trim().email().max(320),
  subject: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(10_000),
}).strict();

export interface AgentQuickProposal {
  actionType: 'event.log' | 'email.send';
  title: string;
  description: string;
  payload: Record<string, unknown>;
}

export const AGENT_QUICK_PROPOSAL_TOOLS: AgentToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'propose_event_log',
      description: 'Prepare a confirmation request to log an expense, client, task, note, or other event. Nothing is written until approval.',
      parameters: {
        type: 'object',
        properties: {
          eventType: { type: 'string', enum: ['expense', 'client', 'task', 'note', 'other'] },
          title: { type: 'string', minLength: 1, maxLength: 255 },
          data: { type: 'object', additionalProperties: true },
        },
        required: ['eventType', 'title'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_email_send',
      description: 'Prepare a confirmation request to send one email. Require an exact email recipient, subject, and body. Nothing is sent until approval.',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string', format: 'email', maxLength: 320 },
          subject: { type: 'string', minLength: 1, maxLength: 255 },
          body: { type: 'string', minLength: 1, maxLength: 10000 },
        },
        required: ['recipient', 'subject', 'body'],
        additionalProperties: false,
      },
    },
  },
];

function parseArguments<S extends z.ZodTypeAny>(toolCall: AgentToolCall, schema: S) {
  if (toolCall.arguments.length > 20_000) return null;
  try {
    const result = schema.safeParse(JSON.parse(toolCall.arguments || '{}'));
    return result.success ? result.data as z.output<S> : null;
  } catch {
    return null;
  }
}

export function createAgentQuickProposalCollector() {
  const proposals: AgentQuickProposal[] = [];
  const cachedResults = new Map<string, unknown>();
  return {
    proposals,
    handles(name: string) {
      return name === 'propose_event_log' || name === 'propose_email_send';
    },
    async execute(toolCall: AgentToolCall) {
      const cacheKey = `${toolCall.name}:${toolCall.arguments}`;
      if (cachedResults.has(cacheKey)) return cachedResults.get(cacheKey);
      let proposal: AgentQuickProposal | null = null;
      if (toolCall.name === 'propose_event_log') {
        const args = parseArguments(toolCall, EventLogSchema);
        if (args && JSON.stringify(args.data).length <= 8_000) {
          proposal = {
            actionType: 'event.log',
            title: `Log ${args.eventType}: ${args.title}`,
            description: 'Add this event to the workspace after approval.',
            payload: { version: 1, operation: 'log', ...args },
          };
        }
      } else {
        const args = parseArguments(toolCall, EmailSendSchema);
        if (args) {
          proposal = {
            actionType: 'email.send',
            title: `Send email: ${args.subject}`,
            description: `Send one email to ${args.recipient} after approval.`,
            payload: { version: 1, operation: 'send', ...args },
          };
        }
      }
      const result = proposal
        ? { ok: true, proposal: { actionType: proposal.actionType, title: proposal.title, requiresApproval: true } }
        : { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'The proposed quick action is invalid or too large.' } };
      if (proposal) proposals.push(proposal);
      cachedResults.set(cacheKey, result);
      return result;
    },
  };
}
