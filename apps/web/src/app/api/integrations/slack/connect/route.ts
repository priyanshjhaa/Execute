import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!SLACK_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Slack is not configured. Please add SLACK_CLIENT_ID to environment variables.' },
        { status: 500 }
      );
    }

    // Generate state parameter for CSRF protection
    // We use the user's ID as part of the state to validate on callback
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
    })).toString('base64');

    // Build Slack OAuth URL
    const scopes = ['chat:write', 'channels:read', 'chat:write.public'];
    const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
    slackAuthUrl.searchParams.set('client_id', SLACK_CLIENT_ID);
    slackAuthUrl.searchParams.set('scope', scopes.join(' '));
    slackAuthUrl.searchParams.set('redirect_uri', `${NEXT_PUBLIC_APP_URL}/api/integrations/slack/callback`);
    slackAuthUrl.searchParams.set('state', state);
    slackAuthUrl.searchParams.set('user_scope', ''); // No user scopes needed for bot

    // Redirect to Slack
    return NextResponse.redirect(slackAuthUrl.toString());
  } catch (error: any) {
    console.error('Error initiating Slack OAuth:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
