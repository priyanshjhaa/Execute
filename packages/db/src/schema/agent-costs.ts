import { sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { agentRuns, agentThreads } from './agent';
import { users } from './users';

export type AgentModelCallPurpose = 'response' | 'summary';
export type AgentModelTier = 'fast' | 'reasoning';

export const agentModelCalls = pgTable('agent_model_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  runId: uuid('run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
  threadId: uuid('thread_id').references(() => agentThreads.id, { onDelete: 'set null' }),
  sequence: integer('sequence').notNull(),
  purpose: varchar('purpose', { length: 20 }).$type<AgentModelCallPurpose>().notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  model: varchar('model', { length: 255 }).notNull(),
  tier: varchar('tier', { length: 20 }).$type<AgentModelTier>().notNull().default('fast'),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  latencyMs: integer('latency_ms').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userCreatedIdx: index('agent_model_calls_user_created_idx').on(table.userId, table.createdAt),
  runIdx: index('agent_model_calls_run_idx').on(table.runId),
  threadIdx: index('agent_model_calls_thread_idx').on(table.threadId),
  purposeCheck: check('agent_model_calls_purpose_check', sql`${table.purpose} IN ('response', 'summary')`),
  tierCheck: check('agent_model_calls_tier_check', sql`${table.tier} IN ('fast', 'reasoning')`),
  tokenCheck: check('agent_model_calls_token_check', sql`${table.inputTokens} >= 0 AND ${table.outputTokens} >= 0 AND ${table.totalTokens} >= 0`),
  latencyCheck: check('agent_model_calls_latency_check', sql`${table.latencyMs} >= 0`),
}));

export const agentWorkspaceContextCache = pgTable('agent_workspace_context_cache', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  sourceVersion: text('source_version').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId], name: 'agent_workspace_context_cache_pkey' }),
  expiresIdx: index('agent_workspace_context_cache_expires_idx').on(table.expiresAt),
}));

export const agentDailyUsage = pgTable('agent_daily_usage', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  usageDate: date('usage_date').notNull(),
  requestCount: integer('request_count').notNull().default(0),
  modelCallCount: integer('model_call_count').notNull().default(0),
  reasoningCallCount: integer('reasoning_call_count').notNull().default(0),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.usageDate], name: 'agent_daily_usage_pkey' }),
  dateIdx: index('agent_daily_usage_date_idx').on(table.usageDate),
  nonNegativeCheck: check(
    'agent_daily_usage_non_negative_check',
    sql`${table.requestCount} >= 0 AND ${table.modelCallCount} >= 0 AND ${table.reasoningCallCount} >= 0 AND ${table.inputTokens} >= 0 AND ${table.outputTokens} >= 0 AND ${table.totalTokens} >= 0`,
  ),
}));

export type AgentModelCall = typeof agentModelCalls.$inferSelect;
export type NewAgentModelCall = typeof agentModelCalls.$inferInsert;
