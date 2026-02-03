import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const contactGroups = pgTable('contact_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  // Store list of contact IDs
  contactIds: jsonb('contact_ids').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('contact_groups_user_id_idx').on(table.userId),
}));

export type ContactGroup = typeof contactGroups.$inferSelect;
export type NewContactGroup = typeof contactGroups.$inferInsert;
