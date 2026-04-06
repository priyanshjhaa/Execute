import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, users, workflows } from '@execute/db'
import { executeWorkflow, hasActiveExecution } from '@/lib/workflow-execution'
import { isScheduledWorkflowDue, type ScheduleConfig } from '@/lib/schedule'
import { isAuthorizedSchedulerRequest } from '@/lib/scheduler-auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (!isAuthorizedSchedulerRequest(request, secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scheduledWorkflows = await db.select({
      workflow: workflows,
      user: users,
    })
      .from(workflows)
      .innerJoin(users, eq(workflows.userId, users.id))
      .where(
        and(
          eq(workflows.triggerType, 'schedule'),
          eq(workflows.status, 'active')
        )
      )

    const results: Array<{
      workflowId: string
      workflowName: string
      status: string
      executionId?: string
      reason?: string
      error?: string
    }> = []

    for (const item of scheduledWorkflows) {
      const workflow = item.workflow
      const internalUser = item.user
      const scheduleConfig = workflow.triggerConfig as ScheduleConfig | null

      if (!isScheduledWorkflowDue(scheduleConfig, workflow.lastExecutedAt)) {
        results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          status: 'skipped',
          reason: 'not_due',
        })
        continue
      }

      if (await hasActiveExecution(workflow.id)) {
        results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          status: 'skipped',
          reason: 'already_running_or_waiting',
        })
        continue
      }

      try {
        const execution = await executeWorkflow({
          workflow: workflow as any,
          internalUser: {
            id: internalUser.id,
            email: internalUser.email,
            name: internalUser.name,
          },
          triggerType: 'schedule',
          triggerSource: 'scheduler',
          triggerPayload: {
            schedule: scheduleConfig,
            triggeredAt: new Date().toISOString(),
          },
        })

        results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          status: execution.status,
          executionId: execution.executionId,
        })
      } catch (error: any) {
        results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          status: 'failed',
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      scanned: scheduledWorkflows.length,
      started: results.filter((item) => item.executionId).length,
      results,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
