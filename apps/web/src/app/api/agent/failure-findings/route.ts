import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq } from 'drizzle-orm';
import { db, executions, failureFindings, users, workflows } from '@execute/db';
import { createClient } from '@/lib/supabase/server';

const allowedStatuses = new Set(['open', 'resolved', 'dismissed']);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [internalUser] = await db.select({ id: users.id }).from(users)
    .where(eq(users.supabaseId, user.id)).limit(1);
  if (!internalUser) return NextResponse.json({ findings: [], count: 0 });

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status') || 'open';
  const status = allowedStatuses.has(statusParam) ? statusParam as 'open' | 'resolved' | 'dismissed' : 'open';
  const countOnly = searchParams.get('count') === 'true';
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const filters = and(eq(failureFindings.userId, internalUser.id), eq(failureFindings.status, status));

  if (countOnly) {
    const [result] = await db.select({ value: count() }).from(failureFindings).where(filters);
    return NextResponse.json({ count: result?.value || 0 });
  }

  const findings = await db.select({
    id: failureFindings.id,
    executionId: failureFindings.executionId,
    workflowId: failureFindings.workflowId,
    workflowName: workflows.name,
    executionStatus: executions.status,
    category: failureFindings.category,
    severity: failureFindings.severity,
    title: failureFindings.title,
    summary: failureFindings.summary,
    evidence: failureFindings.evidence,
    proposedRepair: failureFindings.proposedRepair,
    status: failureFindings.status,
    detectedAt: failureFindings.detectedAt,
    updatedAt: failureFindings.updatedAt,
  }).from(failureFindings)
    .innerJoin(executions, and(
      eq(failureFindings.executionId, executions.id),
      eq(executions.userId, internalUser.id),
    ))
    .leftJoin(workflows, and(
      eq(failureFindings.workflowId, workflows.id),
      eq(workflows.userId, internalUser.id),
    ))
    .where(filters)
    .orderBy(desc(failureFindings.detectedAt))
    .limit(limit);

  return NextResponse.json({ findings, count: findings.length });
}
