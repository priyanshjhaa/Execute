import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, executionLogs, executions, failureFindings, workflows } from '@execute/db';
import { classifyExecutionFailure, sanitizeFailureEvidence } from '@execute/llm';

const DEFAULT_SCAN_LIMIT = 100;

function scanLimit() {
  const configured = Number.parseInt(process.env.FAILURE_MONITOR_SCAN_LIMIT || '', 10);
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 1), 500) : DEFAULT_SCAN_LIMIT;
}

export async function scanNewFailureFindings(allowedUserIds: string[] | null = null) {
  if (allowedUserIds?.length === 0) {
    return { scanned: 0, created: 0, deduplicated: 0, categories: {} };
  }
  const candidateFilters = [
    eq(executions.status, 'failed'),
    isNull(failureFindings.id),
  ];
  if (allowedUserIds) candidateFilters.push(inArray(executions.userId, allowedUserIds));

  const candidates = await db.select({
    id: executions.id,
    userId: executions.userId,
    workflowId: executions.workflowId,
    workflowName: workflows.name,
    errorMessage: executions.errorMessage,
    completedAt: executions.completedAt,
  }).from(executions)
    .leftJoin(workflows, and(
      eq(executions.workflowId, workflows.id),
      eq(executions.userId, workflows.userId),
    ))
    .leftJoin(failureFindings, eq(failureFindings.executionId, executions.id))
    .where(and(...candidateFilters))
    .orderBy(desc(executions.completedAt), desc(executions.createdAt))
    .limit(scanLimit());

  let created = 0;
  let deduplicated = 0;
  const categories: Record<string, number> = {};

  for (const execution of candidates) {
    const logs = await db.select({ message: executionLogs.message })
      .from(executionLogs)
      .where(and(
        eq(executionLogs.executionId, execution.id),
        inArray(executionLogs.level, ['error', 'warn']),
      ))
      .orderBy(desc(executionLogs.createdAt))
      .limit(8);
    const rawEvidence = [execution.errorMessage, ...logs.map((log) => log.message)]
      .filter((message): message is string => Boolean(message));
    const classification = classifyExecutionFailure(rawEvidence);
    const workflowLabel = execution.workflowName || 'Unlinked execution';
    const evidence = [...new Set(rawEvidence.map(sanitizeFailureEvidence).filter(Boolean))].slice(0, 4);
    const agentPrompt = `${classification.repairDescription} Use failed execution ${execution.id}${execution.workflowId ? ` for workflow ${execution.workflowId}` : ''}. Inspect current workspace data first. Do not execute any repair without my explicit approval.`;

    const inserted = await db.insert(failureFindings).values({
      userId: execution.userId,
      executionId: execution.id,
      workflowId: execution.workflowId,
      category: classification.category,
      severity: classification.severity,
      title: `${workflowLabel} failed`,
      summary: classification.summary,
      evidence,
      proposedRepair: {
        kind: classification.repairKind,
        label: classification.repairLabel,
        description: classification.repairDescription,
        agentPrompt,
        requiresApproval: true,
      },
    }).onConflictDoNothing({ target: failureFindings.executionId })
      .returning({ id: failureFindings.id });

    if (inserted.length) {
      created += 1;
      categories[classification.category] = (categories[classification.category] || 0) + 1;
    } else {
      deduplicated += 1;
    }
  }

  return { scanned: candidates.length, created, deduplicated, categories };
}
