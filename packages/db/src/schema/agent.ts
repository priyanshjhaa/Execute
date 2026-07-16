import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export type AgentMessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type AgentRunStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export type AgentMessageContentBlock = {
  type: 'text';
  text: string;
};

export const agentThreads = pgTable('agent_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull().default('New conversation'),
  summary: text('summary'),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('agent_threads_user_id_idx').on(table.userId),
  userLastMessageIdx: index('agent_threads_user_last_message_idx').on(table.userId, table.lastMessageAt),
  lastMessageAtIdx: index('agent_threads_last_message_at_idx').on(table.lastMessageAt),
}));

export const agentMessages = pgTable('agent_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').references(() => agentThreads.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 20 }).$type<AgentMessageRole>().notNull(),
  content: jsonb('content').$type<AgentMessageContentBlock[]>().notNull(),
  provider: varchar('provider', { length: 50 }),
  model: varchar('model', { length: 255 }),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  latencyMs: integer('latency_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  threadIdIdx: index('agent_messages_thread_id_idx').on(table.threadId),
  userIdIdx: index('agent_messages_user_id_idx').on(table.userId),
  threadCreatedAtIdx: index('agent_messages_thread_created_at_idx').on(table.threadId, table.createdAt),
  roleCheck: check('agent_messages_role_check', sql`${table.role} IN ('user', 'assistant', 'system', 'tool')`),
}));

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  threadId: uuid('thread_id').references(() => agentThreads.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 20 }).$type<AgentRunStatus>().notNull().default('running'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('agent_runs_user_id_idx').on(table.userId),
  userStatusIdx: index('agent_runs_user_status_idx').on(table.userId, table.status),
  statusCheck: check('agent_runs_status_check', sql`${table.status} IN ('running', 'completed', 'cancelled', 'failed')`),
}));

export type AgentThread = typeof agentThreads.$inferSelect;
export type NewAgentThread = typeof agentThreads.$inferInsert;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type NewAgentMessage = typeof agentMessages.$inferInsert;
export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
