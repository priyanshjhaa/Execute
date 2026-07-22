import { z } from 'zod';

const OptionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const ContactDefinitionSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255).transform((email) => email.toLowerCase()),
  phone: OptionalText(50),
  department: OptionalText(100),
  jobTitle: OptionalText(150),
  company: OptionalText(255),
  tags: z.array(z.string().trim().min(1).max(100)).max(50)
    .transform((tags) => [...new Set(tags)]).default([]),
  notes: OptionalText(10_000),
  avatarUrl: z.union([z.string().trim().url().max(500), z.literal(''), z.null()])
    .optional()
    .transform((value) => value || null),
  isActive: z.boolean().default(true),
}).strict();

export const UpdateContactInputSchema = ContactDefinitionSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: 'At least one contact change is required.' },
);

export type ContactDefinition = z.infer<typeof ContactDefinitionSchema>;
export type UpdateContactInput = z.infer<typeof UpdateContactInputSchema>;

export function contactValidationMessage(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return 'Contact data is invalid.';
  const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
  return `${path}${issue.message}`;
}

export function isContactEmailConflict(error: unknown) {
  return Boolean(
    error
      && typeof error === 'object'
      && 'code' in error
      && error.code === '23505'
      && (!('constraint_name' in error) || error.constraint_name === 'contacts_user_email_unique_idx'),
  );
}
