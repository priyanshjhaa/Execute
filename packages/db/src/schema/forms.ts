import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workflows } from './workflows';

type FormField = {
  id: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
};

/**
 * Forms table - stores hosted form definitions
 * Users can create forms that trigger workflows when submitted
 */
export const forms = pgTable('forms', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  // Form field definitions
  // Each field has: id, label, type, required, placeholder, options (for selects)
  fields: jsonb('fields').$type<FormField[]>(),
  // Public unique slug for the form URL
  publicSlug: varchar('public_slug', { length: 100 }).unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('forms_user_id_idx').on(table.userId),
  workflowIdIdx: index('forms_workflow_id_idx').on(table.workflowId),
  publicSlugIdx: index('forms_public_slug_idx').on(table.publicSlug),
  isActiveIdx: index('forms_is_active_idx').on(table.isActive),
}));

/**
 * Form submissions table - stores form submission data
 * Triggers workflow execution when submitted
 */
export const formSubmissions = pgTable('form_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  formId: uuid('form_id').references(() => forms.id, { onDelete: 'cascade' }).notNull(),
  // Raw submission payload from form
  payload: jsonb('payload').$type<Record<string, any>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  formIdIdx: index('form_submissions_form_id_idx').on(table.formId),
  createdAtIdx: index('form_submissions_created_at_idx').on(table.createdAt),
}));

export type Form = typeof forms.$inferSelect;
export type NewForm = typeof forms.$inferInsert;
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type NewFormSubmission = typeof formSubmissions.$inferInsert;
