import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Basic info
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),

  // Organization details
  department: varchar('department', { length: 100 }),
  jobTitle: varchar('job_title', { length: 150 }),
  company: varchar('company', { length: 255 }),

  // Custom attributes stored as JSONB
  customFields: jsonb('custom_fields').$type<Record<string, any>>(),

  // Tags for categorization
  tags: jsonb('tags').$type<string[]>(),

  // Status
  isActive: boolean('is_active').default(true),

  // Metadata
  notes: text('notes'),
  avatarUrl: varchar('avatar_url', { length: 500 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('contacts_user_id_idx').on(table.userId),
  emailIdx: index('contacts_email_idx').on(table.email),
  departmentIdx: index('contacts_department_idx').on(table.department),
  // Composite index for user + email uniqueness
  userEmailIdx: index('contacts_user_email_idx').on(table.userId, table.email),
}));

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
