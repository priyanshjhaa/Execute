import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export const quickCommands = pgTable('quick_commands', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  input: text('input').notNull(),
  classifiedIntent: jsonb('classified_intent').notNull(),
  actionTaken: jsonb('action_taken').notNull(),
  status: text('status').default('completed'), // completed | failed | pending
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const loggedEvents = pgTable('logged_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(), // client | expense | note | task
  title: text('title').notNull(),
  data: jsonb('data').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type QuickCommand = typeof quickCommands.$inferSelect;
export type NewQuickCommand = typeof quickCommands.$inferInsert;

export type LoggedEvent = typeof loggedEvents.$inferSelect;
export type NewLoggedEvent = typeof loggedEvents.$inferInsert;
