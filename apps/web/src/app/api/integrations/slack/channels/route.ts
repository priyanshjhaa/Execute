import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, userIntegrations, users } from '@execute/db';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get internal user
    const [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));

    if (!internalUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get Slack integration for this user
    const [integration] = await db.select()
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, internalUser.id))
      .limit(1);

    if (!integration || integration.type !== 'slack') {
      return NextResponse.json({ error: 'Slack integration not found' }, { status: 404 });
    }

    const accessToken = integration.config?.access_token;

    if (!accessToken) {
      return NextResponse.json({ error: 'Slack access token not found' }, { status: 400 });
    }

    // Fetch channels from Slack API
    const response = await fetch('https://slack.com/api/conversations.list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Slack API error:', data);
      return NextResponse.json(
        { error: 'Failed to fetch channels from Slack', details: data.error },
        { status: 500 }
      );
    }

    // Return only public channels for now (is_channel: true, is_private: false)
    const channels = (data.channels || [])
      .filter((ch: any) => ch.is_channel && !ch.is_private && !ch.is_archived)
      .map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        is_private: ch.is_private || false,
        is_channel: ch.is_channel || false,
      }));

    return NextResponse.json({ channels });
  } catch (error: any) {
    console.error('Error fetching Slack channels:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
