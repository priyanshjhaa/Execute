import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  supabaseId: uuid('supabase_id').unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  supabaseIdx: index('users_supabase_id_idx').on(table.supabaseId),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
