import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { executions } from './executions';
import { users } from './users';
import { workflows } from './workflows';

export type FailureFindingStatus = 'open' | 'resolved' | 'dismissed';
export type FailureCategory =
  | 'authentication_or_permissions'
  | 'rate_limit_or_quota'
  | 'network_or_timeout'
  | 'invalid_input'
  | 'missing_resource_or_configuration'
  | 'unknown';

export interface FailureRepairProposal {
  kind: 'retry_execution' | 'reconnect_integration' | 'review_workflow' | 'diagnose_execution';
  label: string;
  description: string;
  agentPrompt: string;
  requiresApproval: true;
}

export const failureFindings = pgTable('failure_findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }).notNull(),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'set null' }),
  category: varchar('category', { length: 60 }).$type<FailureCategory>().notNull(),
  severity: varchar('severity', { length: 20 }).$type<'high' | 'medium'>().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  summary: text('summary').notNull(),
  evidence: jsonb('evidence').$type<string[]>().notNull().default([]),
  proposedRepair: jsonb('proposed_repair').$type<FailureRepairProposal>().notNull(),
  status: varchar('status', { length: 20 }).$type<FailureFindingStatus>().notNull().default('open'),
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  dismissedAt: timestamp('dismissed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  executionUnique: uniqueIndex('failure_findings_execution_unique').on(table.executionId),
  userStatusIdx: index('failure_findings_user_status_idx').on(table.userId, table.status),
  userDetectedIdx: index('failure_findings_user_detected_idx').on(table.userId, table.detectedAt),
  statusCheck: check('failure_findings_status_check', sql`${table.status} IN ('open', 'resolved', 'dismissed')`),
  severityCheck: check('failure_findings_severity_check', sql`${table.severity} IN ('high', 'medium')`),
}));

export type FailureFinding = typeof failureFindings.$inferSelect;
export type NewFailureFinding = typeof failureFindings.$inferInsert;
