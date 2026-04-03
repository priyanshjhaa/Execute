import { and, eq, inArray } from 'drizzle-orm'
import { createExecutor, getAllHandlers } from '@execute/execution'
import { db, executions, steps, workflows } from '@execute/db'

interface InternalUser {
  id: string
  email: string
  name?: string | null
}

interface PersistedWorkflow {
  id: string
  name: string
  userId: string
  definition: {
    steps: any[]
    triggerStepId: string
  }
  triggerType: string
  triggerConfig: any
  webhookId?: string | null
  scheduleExpression?: string | null
  totalExecutions?: number | null
  successRate?: number | null
}

interface ExecuteWorkflowOptions {
  workflow: PersistedWorkflow
  internalUser: InternalUser
  triggerType: 'manual' | 'schedule' | 'webhook'
  triggerSource: string
  triggerPayload?: Record<string, unknown>
}

function generateId(): string {
  return crypto.randomUUID()
}

export async function hasActiveExecution(workflowId: string) {
  const [activeExecution] = await db.select()
    .from(executions)
    .where(
      and(
        eq(executions.workflowId, workflowId),
        inArray(executions.status, ['running', 'waiting'])
      )
    )
    .limit(1)

  return !!activeExecution
}

export async function executeWorkflow({
  workflow,
  internalUser,
  triggerType,
  triggerSource,
  triggerPayload = {},
}: ExecuteWorkflowOptions) {
  const executionId = generateId()

  await db.insert(executions).values({
    id: executionId,
    workflowId: workflow.id,
    userId: internalUser.id,
    status: 'running',
    cancelRequested: false,
    triggerData: {
      type: triggerType,
      source: triggerSource,
      data: triggerPayload,
    },
    startedAt: new Date(),
  })

  const executor = createExecutor()
  const handlers = getAllHandlers()
  for (const handler of handlers) {
    executor.registerHandler(handler)
  }

  let stepOrder = 0
  const stepDbIds = new Map<string, string>()

  const result = await executor.execute(
    {
      id: workflow.id,
      name: workflow.name,
      userId: internalUser.id,
      definition: workflow.definition as any,
      triggerType: workflow.triggerType,
      triggerConfig: workflow.triggerConfig as any,
      webhookId: workflow.webhookId || undefined,
      scheduleExpression: workflow.scheduleExpression || undefined,
    },
    { id: internalUser.id, email: internalUser.email, name: internalUser.name || undefined },
    executionId,
    {
      triggerData: triggerPayload,
      onStepStart: async (stepId) => {
        const stepDef = workflow.definition.steps.find((s: any) => s.id === stepId)
        const [stepRecord] = await db.insert(steps).values({
          executionId,
          stepOrder: stepOrder++,
          stepType: stepDef?.type || 'unknown',
          description: stepDef?.name || stepId,
          inputParams: stepDef || {},
          status: 'running',
          startedAt: new Date(),
        }).returning()
        stepDbIds.set(stepId, stepRecord.id)
      },
      onStepComplete: async (stepResult) => {
        const dbStepId = stepDbIds.get(stepResult.stepId)
        if (dbStepId) {
          await db.update(steps)
            .set({
              status: stepResult.status,
              outputResult: { data: stepResult.data, error: stepResult.error },
              completedAt: stepResult.completedAt || new Date(),
              errorMessage: stepResult.error,
            })
            .where(eq(steps.id, dbStepId))
        }
      },
      shouldContinue: async () => {
        const [execution] = await db.select()
          .from(executions)
          .where(eq(executions.id, executionId))
          .limit(1)

        if (execution?.cancelRequested) {
          await db.update(executions)
            .set({
              status: 'cancelled',
              cancelRequested: false,
              completedAt: new Date(),
              errorMessage: 'Execution cancelled by user',
            })
            .where(eq(executions.id, executionId))
          return false
        }

        return true
      },
    }
  )

  const [currentExecution] = await db.select()
    .from(executions)
    .where(eq(executions.id, executionId))
    .limit(1)

  if (currentExecution?.status !== 'cancelled') {
    const now = new Date()
    const waitingStep = result.steps.find((s) => s.status === 'waiting')
    const resumeAt = waitingStep?.data?.resumeAt
      ? new Date(waitingStep.data.resumeAt)
      : null

    await db.update(executions)
      .set({
        status: result.status === 'waiting' ? 'waiting' : result.status,
        resumeAt,
        completedAt: result.status === 'waiting' ? undefined : now,
        errorMessage: result.error,
        totalSteps: result.steps.length,
        completedSteps: result.steps.filter((s) => s.status === 'completed').length,
      })
      .where(eq(executions.id, executionId))

    const shouldCountExecution = result.status === 'completed' || result.status === 'failed'
    if (shouldCountExecution) {
      const nextTotalExecutions = (workflow.totalExecutions || 0) + 1
      const priorSuccessCount = Math.round(((workflow.successRate || 0) / 100) * (workflow.totalExecutions || 0))
      const nextSuccessCount = priorSuccessCount + (result.status === 'completed' ? 1 : 0)
      const nextSuccessRate = Math.round((nextSuccessCount / nextTotalExecutions) * 100)

      await db.update(workflows)
        .set({
          lastExecutedAt: now,
          totalExecutions: nextTotalExecutions,
          successRate: nextSuccessRate,
        })
        .where(eq(workflows.id, workflow.id))
    }
  }

  const [finalExecution] = await db.select()
    .from(executions)
    .where(eq(executions.id, executionId))
    .limit(1)

  return {
    executionId,
    workflowId: workflow.id,
    status: finalExecution?.status || result.status,
    error: finalExecution?.errorMessage || result.error,
    duration: result.duration,
  }
}
