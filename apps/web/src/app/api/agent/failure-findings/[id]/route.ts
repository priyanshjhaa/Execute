import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, failureFindings, users } from '@execute/db';
import { createClient } from '@/lib/supabase/server';
import { canAccessAgentFeature } from '@/lib/agent-feature-access';

const UpdateFindingSchema = z.object({
  status: z.enum(['open', 'resolved', 'dismissed']),
}).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid finding ID' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [internalUser] = await db.select({ id: users.id, email: users.email }).from(users)
    .where(eq(users.supabaseId, user.id)).limit(1);
  if (!internalUser) return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
  if (!canAccessAgentFeature(internalUser, 'monitor')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const parsed = UpdateFindingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid finding status' }, { status: 400 });
  const now = new Date();
  const [finding] = await db.update(failureFindings).set({
    status: parsed.data.status,
    resolvedAt: parsed.data.status === 'resolved' ? now : null,
    dismissedAt: parsed.data.status === 'dismissed' ? now : null,
    updatedAt: now,
  }).where(and(
    eq(failureFindings.id, id),
    eq(failureFindings.userId, internalUser.id),
  )).returning({
    id: failureFindings.id,
    status: failureFindings.status,
    updatedAt: failureFindings.updatedAt,
  });
  return finding
    ? NextResponse.json({ finding })
    : NextResponse.json({ error: 'Finding not found' }, { status: 404 });
}
