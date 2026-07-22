export interface StoredIntegrationMetadata {
  id: string;
  type: string;
  name: string;
  isActive: boolean | null;
  config: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export function sanitizeIntegration(integration: StoredIntegrationMetadata) {
  const workspaceName = integration.type === 'slack' && typeof integration.config?.team_name === 'string'
    ? integration.config.team_name
    : null;
  const defaultChannelName = integration.type === 'slack' && typeof integration.config?.default_channel_name === 'string'
    ? integration.config.default_channel_name
    : null;

  return {
    id: integration.id,
    type: integration.type,
    name: integration.name,
    isActive: integration.isActive === true,
    status: integration.isActive === true ? 'connected' as const : 'inactive' as const,
    display: {
      workspaceName,
      defaultChannelName,
    },
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export const INTEGRATION_OAUTH_GUIDES = {
  slack: {
    type: 'slack',
    name: 'Slack',
    availability: 'available',
    settingsHref: '/dashboard/integrations',
    connectHref: '/api/integrations/slack/connect',
    steps: [
      'Open Integrations and choose Connect Slack.',
      'Review the permissions on Slack and select the intended workspace.',
      'Approve access in Slack; Execute will return you to the Integrations page.',
      'Confirm the workspace shows as connected before using it in a workflow.',
    ],
  },
  'google-sheets': {
    type: 'google-sheets', name: 'Google Sheets', availability: 'coming_soon',
    settingsHref: '/dashboard/integrations', connectHref: null, steps: [],
  },
  'google-calendar': {
    type: 'google-calendar', name: 'Google Calendar', availability: 'coming_soon',
    settingsHref: '/dashboard/integrations', connectHref: null, steps: [],
  },
  notion: {
    type: 'notion', name: 'Notion', availability: 'coming_soon',
    settingsHref: '/dashboard/integrations', connectHref: null, steps: [],
  },
} as const;

export type IntegrationProviderType = keyof typeof INTEGRATION_OAUTH_GUIDES;
