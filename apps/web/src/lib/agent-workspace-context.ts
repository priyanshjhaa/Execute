import { and, count, desc, eq, max } from 'drizzle-orm';
import {
  agentWorkspaceContextCache,
  contacts,
  db,
  failureFindings,
  forms,
  userIntegrations,
  workflows,
} from '@execute/db';
import {
  resolveWorkspaceContextCacheTtlSeconds,
  serializeUntrustedWorkspaceContext,
} from '@execute/llm';

function timestamp(value: Date | null) {
  return value?.toISOString() || null;
}

export async function getCompactWorkspaceContext(userId: string) {
  const now = new Date();
  const [cached] = await db.select().from(agentWorkspaceContextCache)
    .where(eq(agentWorkspaceContextCache.userId, userId)).limit(1);
  if (cached && cached.expiresAt > now) {
    return cached.content;
  }

  const [workflowStats, formStats, contactStats, integrationStats, attentionStats] = await Promise.all([
    db.select({ value: count(), latest: max(workflows.updatedAt) }).from(workflows).where(eq(workflows.userId, userId)),
    db.select({ value: count(), latest: max(forms.updatedAt) }).from(forms).where(eq(forms.userId, userId)),
    db.select({ value: count(), latest: max(contacts.updatedAt) }).from(contacts).where(eq(contacts.userId, userId)),
    db.select({ value: count(), latest: max(userIntegrations.updatedAt) }).from(userIntegrations).where(eq(userIntegrations.userId, userId)),
    db.select({ value: count(), latest: max(failureFindings.updatedAt) }).from(failureFindings).where(and(
      eq(failureFindings.userId, userId),
      eq(failureFindings.status, 'open'),
    )),
  ]);
  const versionData = {
    workflows: [workflowStats[0]?.value || 0, timestamp(workflowStats[0]?.latest || null)],
    forms: [formStats[0]?.value || 0, timestamp(formStats[0]?.latest || null)],
    contacts: [contactStats[0]?.value || 0, timestamp(contactStats[0]?.latest || null)],
    integrations: [integrationStats[0]?.value || 0, timestamp(integrationStats[0]?.latest || null)],
    attention: [attentionStats[0]?.value || 0, timestamp(attentionStats[0]?.latest || null)],
  };
  const sourceVersion = JSON.stringify(versionData);

  const [recentWorkflows, formStates, integrationStates] = await Promise.all([
    db.select({ name: workflows.name, status: workflows.status, triggerType: workflows.triggerType })
      .from(workflows).where(eq(workflows.userId, userId)).orderBy(desc(workflows.updatedAt)).limit(8),
    db.select({ isActive: forms.isActive, value: count() }).from(forms)
      .where(eq(forms.userId, userId)).groupBy(forms.isActive),
    db.select({ type: userIntegrations.type, isActive: userIntegrations.isActive })
      .from(userIntegrations).where(eq(userIntegrations.userId, userId)).orderBy(desc(userIntegrations.updatedAt)).limit(12),
  ]);
  const activeForms = formStates.find((row) => row.isActive)?.value || 0;
  const connectedTypes = [...new Set(integrationStates.filter((item) => item.isActive).map((item) => item.type))];
  const content = serializeUntrustedWorkspaceContext({
    generatedAt: now.toISOString(),
    workflows: {
      total: workflowStats[0]?.value || 0,
      recent: recentWorkflows,
    },
    forms: {
      total: formStats[0]?.value || 0,
      active: activeForms,
    },
    contacts: { total: contactStats[0]?.value || 0 },
    connectedIntegrationTypes: connectedTypes,
    openFailureFindings: attentionStats[0]?.value || 0,
  });
  const expiresAt = new Date(now.getTime() + resolveWorkspaceContextCacheTtlSeconds() * 1000);
  const metadata = { ...versionData, generatedAt: now.toISOString() };
  await db.insert(agentWorkspaceContextCache).values({
    userId, content, sourceVersion, metadata, expiresAt,
  }).onConflictDoUpdate({
    target: agentWorkspaceContextCache.userId,
    set: { content, sourceVersion, metadata, expiresAt, updatedAt: now },
  });
  return content;
}
