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
