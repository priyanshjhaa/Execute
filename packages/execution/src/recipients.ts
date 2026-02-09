/**
 * Recipient Resolver
 *
 * Resolves contact IDs, groups, and filters to email addresses
 * for use in workflow steps.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase credentials are required for recipient resolution');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface RecipientConfig {
  type: 'manual' | 'contacts' | 'group' | 'filter';
  contactIds?: string[];
  groupId?: string;
  filter?: {
    department?: string;
    tags?: string[];
    isActive?: boolean;
  };
  // Manual entry (backward compatibility)
  to?: string | string[];
}

export interface ContactInfo {
  id: string;
  name: string;
  email: string;
  department: string | null;
  tags: string[];
}

export interface ResolvedRecipients {
  emails: string[];
  contacts: ContactInfo[];
}

/**
 * Resolve recipients from config to email addresses
 */
export async function resolveRecipients(
  userId: string,
  recipients: RecipientConfig
): Promise<ResolvedRecipients> {
  // Manual entry - backward compatibility
  if (recipients.type === 'manual' || recipients.to) {
    const emails = Array.isArray(recipients.to) ? recipients.to : [recipients.to || ''];
    return {
      emails,
      contacts: emails.map((email, i) => ({
        id: `manual-${i}`,
        name: email.split('@')[0],
        email,
        department: null,
        tags: [],
      })),
    };
  }

  let query = supabase
    .from('contacts')
    .select('id, name, email, department, tags')
    .eq('user_id', userId);

  // By contact IDs
  if (recipients.type === 'contacts' && recipients.contactIds && recipients.contactIds.length > 0) {
    query = query.in('id', recipients.contactIds);
  }

  // By group
  if (recipients.type === 'group' && recipients.groupId) {
    const { data: group } = await supabase
      .from('contact_groups')
      .select('contact_ids')
      .eq('user_id', userId)
      .eq('id', recipients.groupId)
      .single();

    if (group && group.contact_ids && group.contact_ids.length > 0) {
      query = query.in('id', group.contact_ids);
    } else {
      return { emails: [], contacts: [] };
    }
  }

  // By filter
  if (recipients.type === 'filter' && recipients.filter) {
    if (recipients.filter.department) {
      query = query.eq('department', recipients.filter.department);
    }

    if (recipients.filter.isActive !== undefined) {
      query = query.eq('is_active', recipients.filter.isActive);
    }
  }

  const { data: allContacts, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch contacts: ${error.message}`);
  }

  let filtered = allContacts || [];

  // Tags filtering (client-side since it's JSONB)
  if (recipients.type === 'filter' && recipients.filter?.tags && recipients.filter.tags.length > 0) {
    filtered = (allContacts || []).filter((c: any) => {
      const contactTags = (c.tags as string[]) || [];
      return recipients.filter!.tags!.some((tag: string) => contactTags.includes(tag));
    });
  }

  const emails = filtered.map((c: any) => c.email);

  return {
    emails,
    contacts: filtered.map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      department: c.department,
      tags: (c.tags as string[]) || [],
    })),
  };
}

/**
 * Get all user contacts for a step
 */
export async function getUserContacts(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch contacts: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all user groups for a step
 */
export async function getUserGroups(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('contact_groups')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch groups: ${error.message}`);
  }

  return data || [];
}

/**
 * Resolve a natural language text to contact emails
 * Supports: email addresses, contact names, departments, tags
 */
export async function resolveRecipientFromText(
  userId: string,
  text: string
): Promise<ResolvedRecipients> {
  const searchText = text.trim();

  // If it's already an email format, return it
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(searchText)) {
    return {
      emails: [searchText],
      contacts: [{
        id: `manual-${searchText}`,
        name: searchText.split('@')[0],
        email: searchText,
        department: null,
        tags: [],
      }],
    };
  }

  // Handle comma-separated emails or names
  if (searchText.includes(',')) {
    const parts = searchText.split(',').map(p => p.trim());
    const allEmails: string[] = [];
    const allContacts: ContactInfo[] = [];

    for (const part of parts) {
      const resolved = await resolveRecipientFromText(userId, part);
      allEmails.push(...resolved.emails);
      allContacts.push(...resolved.contacts);
    }

    return { emails: allEmails, contacts: allContacts };
  }

  // Get all user contacts
  const contacts = await getUserContacts(userId);

  // 1. Match by exact name (case-insensitive)
  const byName = contacts.filter((c: any) =>
    c.name.toLowerCase() === searchText.toLowerCase()
  );
  if (byName.length > 0) {
    return {
      emails: byName.map((c: any) => c.email),
      contacts: byName.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        department: c.department,
        tags: (c.tags as string[]) || [],
      })),
    };
  }

  // 2. Match by department
  const byDept = contacts.filter((c: any) =>
    c.department?.toLowerCase() === searchText.toLowerCase()
  );
  if (byDept.length > 0) {
    return {
      emails: byDept.map((c: any) => c.email),
      contacts: byDept.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        department: c.department,
        tags: (c.tags as string[]) || [],
      })),
    };
  }

  // 3. Match by tags
  const byTag = contacts.filter((c: any) =>
    (c.tags as string[])?.some((t: string) => t.toLowerCase() === searchText.toLowerCase())
  );
  if (byTag.length > 0) {
    return {
      emails: byTag.map((c: any) => c.email),
      contacts: byTag.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        department: c.department,
        tags: (c.tags as string[]) || [],
      })),
    };
  }

  // 4. Fuzzy name match (contains)
  const fuzzy = contacts.filter((c: any) =>
    c.name.toLowerCase().includes(searchText.toLowerCase())
  );
  if (fuzzy.length > 0) {
    return {
      emails: fuzzy.map((c: any) => c.email),
      contacts: fuzzy.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        department: c.department,
        tags: (c.tags as string[]) || [],
      })),
    };
  }

  // No matches found - provide helpful error
  const availableNames = contacts.map((c: any) => c.name).join(', ');
  const availableDepts = [...new Set(contacts.map((c: any) => c.department).filter(Boolean))].join(', ');
  const availableTags = [...new Set(contacts.flatMap((c: any) => (c.tags as string[]) || []))].join(', ');

  throw new Error(
    `Could not find contacts matching "${searchText}".\n` +
    `Available contacts: ${availableNames || 'none'}\n` +
    `Available departments: ${availableDepts || 'none'}\n` +
    `Available tags: ${availableTags || 'none'}`
  );
}
