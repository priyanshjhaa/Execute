import { pgTable, uuid, varchar, text, timestamp, jsonb, index, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * User Integrations Table
 *
 * Stores external service integrations for each user
 * (Slack webhooks, Resend from addresses, API keys, etc.)
 */
export const userIntegrations = pgTable('user_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Integration type (slack, resend, twilio, asana, etc.)
  type: varchar('type', { length: 50 }).notNull(),

  // Human-readable name for this integration
  name: varchar('name', { length: 255 }).notNull(),

  // Integration-specific configuration stored as JSON
  config: jsonb('config').notNull().$type<Record<string, any>>(),

  // Whether this integration is active
  isActive: boolean('is_active').default(true),

  // Optional notes
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_integrations_user_id_idx').on(table.userId),
  typeIdx: index('user_integrations_type_idx').on(table.type),
  // Composite index for quick lookups
  userTypeIdx: index('user_integrations_user_type_idx').on(table.userId, table.type),
}));

export type UserIntegration = typeof userIntegrations.$inferSelect;
export type NewUserIntegration = typeof userIntegrations.$inferInsert;
