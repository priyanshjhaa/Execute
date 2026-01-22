import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { executions } from './executions';
import { steps } from './steps';

export const executionLogs = pgTable('execution_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }).notNull(),
  stepId: uuid('step_id').references(() => steps.id, { onDelete: 'cascade' }),
  level: varchar('level', { length: 20 }).notNull(), // info, warn, error, debug
  message: text('message').notNull(),
  metadata: jsonb('metadata').$type<any>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  executionIdIdx: index('execution_logs_execution_id_idx').on(table.executionId),
  createdAtIdx: index('execution_logs_created_at_idx').on(table.createdAt),
}));

export type ExecutionLog = typeof executionLogs.$inferSelect;
export type NewExecutionLog = typeof executionLogs.$inferInsert;
