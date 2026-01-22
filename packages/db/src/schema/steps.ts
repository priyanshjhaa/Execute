import { pgTable, uuid, integer, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { executions } from './executions';

export const steps = pgTable('steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }).notNull(),
  stepOrder: integer('step_order').notNull(),
  stepType: varchar('step_type', { length: 100 }).notNull(),
  description: text('description'),
  inputParams: jsonb('input_params').notNull().$type<any>(),
  outputResult: jsonb('output_result').$type<any>(),
  status: varchar('status', { length: 50 }).notNull(), // pending, running, completed, failed, skipped
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  dependsOn: jsonb('depends_on').$type<string[]>(),
  rollbackStep: jsonb('rollback_step').$type<any>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  executionIdIdx: index('steps_execution_id_idx').on(table.executionId),
  statusIdx: index('steps_status_idx').on(table.status),
}));

export type Step = typeof steps.$inferSelect;
export type NewStep = typeof steps.$inferInsert;
