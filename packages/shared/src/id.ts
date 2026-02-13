/**
 * Generate a unique ID using crypto.randomUUID()
 * Node.js built-in, no external dependencies
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a unique public slug for forms
 */
export function generateSlug(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < length; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}
