import { and, eq } from 'drizzle-orm';
import { db, userIntegrations } from '@execute/db';
import type { AgentToolCall, AgentToolDefinition } from '@execute/llm';
import { z } from 'zod';

const DisconnectIntegrationSchema = z.object({
  integrationId: z.string().uuid(),
}).strict();

export interface AgentIntegrationProposal {
  actionType: 'integration.disconnect';
  title: string;
  description: string;
  payload: Record<string, unknown>;
}

export const AGENT_INTEGRATION_PROPOSAL_TOOLS: AgentToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'propose_integration_disconnect',
      description: 'Prepare a confirmation request to disconnect an owned integration. Nothing is disconnected until the user approves. Credentials are never returned.',
      parameters: {
        type: 'object',
        properties: { integrationId: { type: 'string', format: 'uuid' } },
        required: ['integrationId'],
        additionalProperties: false,
      },
    },
  },
];

function errorResult(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

function parseArguments(toolCall: AgentToolCall) {
  if (toolCall.arguments.length > 10_000) return { success: false as const, error: 'Tool arguments are too large.' };
  try {
    const parsed = DisconnectIntegrationSchema.safeParse(JSON.parse(toolCall.arguments || '{}'));
    return parsed.success
      ? { success: true as const, data: parsed.data }
      : { success: false as const, error: 'Invalid integration disconnect proposal.' };
  } catch {
    return { success: false as const, error: 'Tool arguments must be valid JSON.' };
  }
}

export function createAgentIntegrationProposalCollector(userId: string) {
  const proposals: AgentIntegrationProposal[] = [];
  const cachedResults = new Map<string, unknown>();
  return {
    proposals,
    handles(name: string) {
      return name === 'propose_integration_disconnect';
    },
    async execute(toolCall: AgentToolCall) {
      const cacheKey = `${toolCall.name}:${toolCall.arguments}`;
      if (cachedResults.has(cacheKey)) return cachedResults.get(cacheKey);
      const parsed = parseArguments(toolCall);
      if (!parsed.success) {
        const result = errorResult('INVALID_ARGUMENTS', parsed.error);
        cachedResults.set(cacheKey, result);
        return result;
      }

      const [integration] = await db.select({
        id: userIntegrations.id,
        type: userIntegrations.type,
        name: userIntegrations.name,
        isActive: userIntegrations.isActive,
        updatedAt: userIntegrations.updatedAt,
      }).from(userIntegrations)
        .where(and(
          eq(userIntegrations.id, parsed.data.integrationId),
          eq(userIntegrations.userId, userId),
        ))
        .limit(1);

      if (!integration) {
        const result = errorResult('NOT_FOUND', 'Integration not found.');
        cachedResults.set(cacheKey, result);
        return result;
      }

      const proposal: AgentIntegrationProposal = {
        actionType: 'integration.disconnect',
        title: `Disconnect ${integration.name}`,
        description: `Remove the ${integration.name} connection from this workspace. Stored credentials will be deleted and workflows using it may stop working.`,
        payload: {
          version: 1,
          operation: 'disconnect',
          integrationId: integration.id,
          expectedUpdatedAt: integration.updatedAt.toISOString(),
          before: {
            id: integration.id,
            type: integration.type,
            name: integration.name,
            isActive: integration.isActive === true,
            updatedAt: integration.updatedAt.toISOString(),
          },
        },
      };
      proposals.push(proposal);
      const result = {
        ok: true,
        proposal: {
          actionType: proposal.actionType,
          title: proposal.title,
          provider: integration.type,
          requiresApproval: true,
        },
      };
      cachedResults.set(cacheKey, result);
      return result;
    },
  };
}
