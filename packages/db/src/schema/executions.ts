import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workflows } from './workflows';

export const executions = pgTable('executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  // For one-off executions without a workflow, store the instruction
  instruction: text('instruction'),
  // Trigger context (what triggered this execution)
  triggerData: jsonb('trigger_data').$type<{
    type: string;
    source: string;
    data: any;
  }>(),
  status: varchar('status', { length: 50 }).notNull(), // pending, running, completed, failed, cancelled, waiting
  cancelRequested: boolean('cancel_requested').notNull().default(false), // Flag for cancellation requests
  startedAt: timestamp('started_at'),
  resumeAt: timestamp('resume_at'), // When to resume a waiting execution (e.g., after delay)
  completedAt: timestamp('completed_at'),
  totalSteps: integer('total_steps'),
  completedSteps: integer('completed_steps').default(0),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workflowIdIdx: index('executions_workflow_id_idx').on(table.workflowId),
  userIdIdx: index('executions_user_id_idx').on(table.userId),
  statusIdx: index('executions_status_idx').on(table.status),
  createdAtIdx: index('executions_created_at_idx').on(table.createdAt),
  cancelRequestedIdx: index('executions_cancel_requested_idx').on(table.cancelRequested),
  resumeAtIdx: index('executions_resume_at_idx').on(table.resumeAt),
}));

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
