import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  instruction: text('instruction').notNull(),
  stepsSchema: jsonb('steps_schema').$type<any>(),
  isPublic: boolean('is_public').default(false),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('templates_user_id_idx').on(table.userId),
}));

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
