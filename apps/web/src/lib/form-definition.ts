import { z } from 'zod';

export const FORM_FIELD_TYPES = [
  'text',
  'email',
  'number',
  'textarea',
  'select',
  'checkbox',
] as const;

export const FormFieldSchema = z.object({
  id: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  label: z.string().trim().min(1).max(255),
  type: z.enum(FORM_FIELD_TYPES),
  required: z.boolean(),
  placeholder: z.string().trim().max(500).optional(),
  options: z.array(z.string().trim().min(1).max(255)).min(1).max(50).optional(),
}).strict().superRefine((field, context) => {
  if (field.type === 'select' && !field.options?.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'Select fields require at least one option.',
    });
  }
});

export const FormFieldsSchema = z.array(FormFieldSchema).min(1).max(50)
  .superRefine((fields, context) => {
    const ids = new Set<string>();
    for (const [index, field] of fields.entries()) {
      if (ids.has(field.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: 'Form field IDs must be unique.',
        });
      }
      ids.add(field.id);
    }
  });

export const CreateFormInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(4_000).nullable().optional(),
  fields: FormFieldsSchema,
  workflowId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
}).strict();

export const UpdateFormInputSchema = CreateFormInputSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: 'At least one form change is required.' },
);

export type FormFieldInput = z.infer<typeof FormFieldSchema>;
export type CreateFormInput = z.infer<typeof CreateFormInputSchema>;
export type UpdateFormInput = z.infer<typeof UpdateFormInputSchema>;

export function formValidationMessage(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return 'Form data is invalid.';
  const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
  return `${path}${issue.message}`;
}
