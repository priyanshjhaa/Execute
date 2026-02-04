import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, userIntegrations, users } from '@execute/db';
import { eq } from 'drizzle-orm';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle user denial
    if (error) {
      console.error('Slack OAuth error:', error);
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=access_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=invalid_callback', request.url)
      );
    }

    // Verify state parameter (CSRF protection)
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());

      // Check if state is too old (5 minutes)
      if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
        return NextResponse.redirect(
          new URL('/dashboard/integrations?error=expired_state', request.url)
        );
      }
    } catch (e) {
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=invalid_state', request.url)
      );
    }

    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=unauthorized', request.url)
      );
    }

    // Verify state matches user
    if (stateData.userId !== user.id) {
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=state_mismatch', request.url)
      );
    }

    if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=missing_config', request.url)
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/slack/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error('Slack token exchange failed:', tokenData);
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=token_exchange_failed', request.url)
      );
    }

    // Get internal user
    const [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));

    if (!internalUser) {
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=user_not_found', request.url)
      );
    }

    // Check if Slack integration already exists for this user
    const [existing] = await db.select()
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, internalUser.id))
      .limit(1);

    // Prepare integration config
    const config = {
      access_token: tokenData.access_token,
      bot_user_id: tokenData.bot_user_id,
      team_id: tokenData.team.id,
      team_name: tokenData.team.name,
      scope: tokenData.scope?.split(',') || [],
      default_channel_id: null,
      default_channel_name: null,
    };

    if (existing && existing.type === 'slack') {
      // Update existing integration
      await db.update(userIntegrations)
        .set({
          config,
          isActive: true,
          name: `${tokenData.team.name} Slack`,
          updatedAt: new Date(),
        })
        .where(eq(userIntegrations.id, existing.id));
    } else {
      // Create new integration
      await db.insert(userIntegrations).values({
        userId: internalUser.id,
        type: 'slack',
        name: `${tokenData.team.name} Slack`,
        config,
        isActive: true,
      });
    }

    // Redirect to integrations page with success
    return NextResponse.redirect(
      new URL('/dashboard/integrations?success=slack_connected', request.url)
    );

  } catch (error: any) {
    console.error('Error in Slack OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/dashboard/integrations?error=unknown_error', request.url)
    );
  }
}
