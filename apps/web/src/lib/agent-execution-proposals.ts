import { and, eq, inArray } from 'drizzle-orm';
import { db, executions, workflows } from '@execute/db';
import type { AgentToolCall, AgentToolDefinition } from '@execute/llm';
import { z } from 'zod';

const RunWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
  inputData: z.record(z.string(), z.unknown()).optional(),
}).strict();

const ExecutionIdSchema = z.object({
  executionId: z.string().uuid(),
}).strict();

export interface AgentExecutionProposal {
  actionType: 'workflow.run' | 'execution.cancel' | 'execution.retry';
  title: string;
  description: string;
  payload: Record<string, unknown>;
}

export const AGENT_EXECUTION_PROPOSAL_TOOLS: AgentToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'propose_workflow_run',
      description: 'Prepare a confirmation request to run an owned workflow. This does not run the workflow until the user approves it.',
      parameters: {
        type: 'object',
        properties: {
          workflowId: { type: 'string', format: 'uuid' },
          inputData: {
            type: 'object',
            description: 'Optional manual trigger data requested by the user.',
            additionalProperties: true,
          },
        },
        required: ['workflowId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_execution_cancel',
      description: 'Prepare a confirmation request to cancel an owned running or waiting execution.',
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
      name: 'propose_execution_retry',
      description: 'Prepare a confirmation request to retry an owned failed execution.',
      parameters: {
        type: 'object',
        properties: { executionId: { type: 'string', format: 'uuid' } },
        required: ['executionId'],
        additionalProperties: false,
      },
    },
  },
];

function parseArguments<S extends z.ZodTypeAny>(toolCall: AgentToolCall, schema: S) {
  let value: unknown;
  try {
    value = JSON.parse(toolCall.arguments || '{}');
  } catch {
    return { success: false as const, error: 'Tool arguments must be valid JSON.' };
  }
  const parsed = schema.safeParse(value);
  return parsed.success
    ? { success: true as const, data: parsed.data as z.output<S> }
    : { success: false as const, error: 'Tool arguments did not match the required schema.' };
}

function errorResult(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

async function proposeWorkflowRun(
  userId: string,
  args: z.output<typeof RunWorkflowSchema>,
) {
  if (JSON.stringify(args.inputData || {}).length > 8_000) {
    return { result: errorResult('INPUT_TOO_LARGE', 'Manual trigger data is too large.') };
  }

  const [workflow] = await db.select({
    id: workflows.id,
    name: workflows.name,
    status: workflows.status,
    triggerType: workflows.triggerType,
  }).from(workflows)
    .where(and(eq(workflows.id, args.workflowId), eq(workflows.userId, userId)))
    .limit(1);
  if (!workflow) return { result: errorResult('NOT_FOUND', 'Workflow not found.') };
  if (workflow.status === 'archived') {
    return { result: errorResult('WORKFLOW_ARCHIVED', 'Archived workflows cannot be run.') };
  }

  const [activeExecution] = await db.select({ id: executions.id })
    .from(executions)
    .where(and(
      eq(executions.workflowId, workflow.id),
      eq(executions.userId, userId),
      inArray(executions.status, ['running', 'waiting']),
    ))
    .limit(1);
  if (activeExecution) {
    return { result: errorResult('ALREADY_RUNNING', 'This workflow already has an active execution.') };
  }

  const proposal: AgentExecutionProposal = {
    actionType: 'workflow.run',
    title: `Run workflow: ${workflow.name}`,
    description: 'Start a manual execution after approval.',
    payload: {
      version: 1,
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggerType: workflow.triggerType,
      inputData: args.inputData || {},
    },
  };
  return {
    result: {
      ok: true,
      proposal: { ...proposal, requiresApproval: true },
    },
    proposal,
  };
}

async function getExecutionForProposal(userId: string, executionId: string) {
  const [execution] = await db.select({
    id: executions.id,
    workflowId: executions.workflowId,
    workflowName: workflows.name,
    status: executions.status,
    errorMessage: executions.errorMessage,
    triggerData: executions.triggerData,
  }).from(executions)
    .leftJoin(workflows, and(
      eq(executions.workflowId, workflows.id),
      eq(workflows.userId, userId),
    ))
    .where(and(eq(executions.id, executionId), eq(executions.userId, userId)))
    .limit(1);
  return execution;
}

async function proposeExecutionCancel(userId: string, executionId: string) {
  const execution = await getExecutionForProposal(userId, executionId);
  if (!execution) return { result: errorResult('NOT_FOUND', 'Execution not found.') };
  if (execution.status !== 'running' && execution.status !== 'waiting') {
    return {
      result: errorResult(
        'NOT_CANCELLABLE',
        `Executions with status ${execution.status} cannot be cancelled.`,
      ),
    };
  }

  const proposal: AgentExecutionProposal = {
    actionType: 'execution.cancel',
    title: `Cancel execution${execution.workflowName ? `: ${execution.workflowName}` : ''}`,
    description: 'Request cancellation at the next safe execution boundary.',
    payload: {
      version: 1,
      executionId: execution.id,
      workflowId: execution.workflowId,
      workflowName: execution.workflowName,
      currentStatus: execution.status,
    },
  };
  return { result: { ok: true, proposal: { ...proposal, requiresApproval: true } }, proposal };
}

async function proposeExecutionRetry(userId: string, executionId: string) {
  const execution = await getExecutionForProposal(userId, executionId);
  if (!execution) return { result: errorResult('NOT_FOUND', 'Execution not found.') };
  if (execution.status !== 'failed') {
    return { result: errorResult('NOT_FAILED', 'Only failed executions can be retried.') };
  }
  if (!execution.workflowId) {
    return { result: errorResult('WORKFLOW_NOT_FOUND', 'The failed execution has no workflow to retry.') };
  }

  const [workflow] = await db.select({ status: workflows.status })
    .from(workflows)
    .where(and(eq(workflows.id, execution.workflowId), eq(workflows.userId, userId)))
    .limit(1);
  if (!workflow) return { result: errorResult('WORKFLOW_NOT_FOUND', 'Workflow not found.') };
  if (workflow.status !== 'active') {
    return { result: errorResult('WORKFLOW_INACTIVE', 'Only active workflows can be retried.') };
  }

  const proposal: AgentExecutionProposal = {
    actionType: 'execution.retry',
    title: `Retry execution${execution.workflowName ? `: ${execution.workflowName}` : ''}`,
    description: 'Start a new execution using the failed run’s trigger data.',
    payload: {
      version: 1,
      executionId: execution.id,
      workflowId: execution.workflowId,
      workflowName: execution.workflowName,
      previousError: execution.errorMessage,
      triggerData: execution.triggerData?.data || {},
    },
  };
  return { result: { ok: true, proposal: { ...proposal, requiresApproval: true } }, proposal };
}

export function createAgentExecutionProposalCollector(userId: string) {
  const proposals: AgentExecutionProposal[] = [];
  const cachedResults = new Map<string, unknown>();

  return {
    proposals,
    handles(name: string) {
      return name === 'propose_workflow_run'
        || name === 'propose_execution_cancel'
        || name === 'propose_execution_retry';
    },
    async execute(toolCall: AgentToolCall) {
      const cacheKey = `${toolCall.name}:${toolCall.arguments}`;
      if (cachedResults.has(cacheKey)) return cachedResults.get(cacheKey);

      let generated: { result: unknown; proposal?: AgentExecutionProposal };
      if (toolCall.name === 'propose_workflow_run') {
        const args = parseArguments(toolCall, RunWorkflowSchema);
        generated = args.success
          ? await proposeWorkflowRun(userId, args.data)
          : { result: errorResult('INVALID_ARGUMENTS', args.error) };
      } else {
        const args = parseArguments(toolCall, ExecutionIdSchema);
        if (!args.success) {
          generated = { result: errorResult('INVALID_ARGUMENTS', args.error) };
        } else {
          generated = toolCall.name === 'propose_execution_cancel'
            ? await proposeExecutionCancel(userId, args.data.executionId)
            : await proposeExecutionRetry(userId, args.data.executionId);
        }
      }

      if (generated.proposal) proposals.push(generated.proposal);
      cachedResults.set(cacheKey, generated.result);
      return generated.result;
    },
  };
}
