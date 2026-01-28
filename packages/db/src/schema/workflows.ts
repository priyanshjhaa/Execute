import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  // The complete workflow definition including all steps
  definition: jsonb('definition').notNull().$type<{
    steps: any[];
    triggerStepId: string;
  }>(),
  // Configuration for how the workflow is triggered
  triggerType: varchar('trigger_type', { length: 50 }).notNull(), // webhook, schedule, event
  triggerConfig: jsonb('trigger_config').$type<any>(),
  // Workflow status
  status: varchar('status', { length: 50 }).notNull().default('draft'), // draft, active, archived
  // Optional: webhook endpoint ID for external triggers
  webhookId: varchar('webhook_id', { length: 255 }),
  // Optional: cron expression for scheduled workflows
  scheduleExpression: varchar('schedule_expression', { length: 255 }),
  // Statistics
  lastExecutedAt: timestamp('last_executed_at'),
  totalExecutions: integer('total_executions').default(0),
  successRate: integer('success_rate').default(0), // percentage
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('workflows_user_id_idx').on(table.userId),
  statusIdx: index('workflows_status_idx').on(table.status),
  triggerTypeIdx: index('workflows_trigger_type_idx').on(table.triggerType),
  webhookIdIdx: index('workflows_webhook_id_idx').on(table.webhookId),
  createdAtIdx: index('workflows_created_at_idx').on(table.createdAt),
}));

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
