import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const executions = pgTable('executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  instruction: text('instruction').notNull(),
  parsedIntent: jsonb('parsed_intent'),
  status: varchar('status', { length: 50 }).notNull(), // pending, parsing, generating, executing, completed, failed, cancelled
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  totalSteps: integer('total_steps'),
  completedSteps: integer('completed_steps').default(0),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('executions_user_id_idx').on(table.userId),
  statusIdx: index('executions_status_idx').on(table.status),
  createdAtIdx: index('executions_created_at_idx').on(table.createdAt),
}));

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
