"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, MessageSquare, Hash, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

interface SlackIntegration {
  id: string;
  type: string;
  config?: {
    access_token?: string;
    team_name?: string;
  };
}

interface SendSlackStepConfigProps {
  config?: {
    integrationId?: string;
    channel?: string;
    message?: string;
    username?: string;
    icon_emoji?: string;
  };
  onChange: (config: any) => void;
}

export function SendSlackStepConfig({ config, onChange }: SendSlackStepConfigProps) {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [integrations, setIntegrations] = useState<SlackIntegration[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch integrations on mount
  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/integrations');
      if (!response.ok) {
        throw new Error('Failed to fetch integrations');
      }
      const data = await response.json();
      setIntegrations(data.integrations || []);

      // If we have a config with integrationId, verify it still exists
      if (config?.integrationId) {
        const exists = data.integrations?.some((i: SlackIntegration) => i.id === config.integrationId && i.type === 'slack');
        if (!exists) {
          // Clear the integrationId if it no longer exists
          onChange({ ...config, integrationId: undefined, channel: undefined });
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get the Slack integration
  const slackIntegration = integrations.find(i => i.type === 'slack');
  const isConnected = !!slackIntegration;

  // Fetch channels when Slack is connected
  useEffect(() => {
    if (isConnected && (!channels.length || config?.integrationId !== slackIntegration?.id)) {
      fetchChannels();
    }
  }, [isConnected, slackIntegration?.id]);

  const fetchChannels = async () => {
    if (!slackIntegration) return;

    try {
      setChannelsLoading(true);
      setError(null);
      const response = await fetch('/api/integrations/slack/channels');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch channels');
      }
      const data = await response.json();
      setChannels(data.channels || []);

      // Set the integrationId if not already set
      if (!config?.integrationId || config?.integrationId !== slackIntegration.id) {
        onChange({ ...config, integrationId: slackIntegration.id });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChannelsLoading(false);
    }
  };

  const updateConfig = (key: string, value: any) => {
    onChange({ ...config, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 text-white/40 animate-spin" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="p-6 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
        <div className="flex items-start gap-3">
          <MessageSquare className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-200 font-medium mb-2">
              Slack not connected
            </p>
            <p className="text-xs text-yellow-200/70 mb-4">
              Connect your Slack workspace to send messages to channels.
            </p>
            <Link href="/dashboard/integrations">
              <Button size="sm" className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 border-yellow-500/30 rounded-full">
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect Slack
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connected Info */}
      <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/5 border border-green-500/20 px-3 py-2 rounded-lg">
        <MessageSquare className="h-4 w-4" />
        <span>Connected to {slackIntegration.config?.team_name || 'Slack'}</span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Channel Selection */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          Channel <span className="text-red-400">*</span>
        </label>
        {channelsLoading ? (
          <div className="flex items-center gap-2 text-white/40 text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading channels...</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="text-white/40 text-sm py-2">No public channels found</div>
        ) : (
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
            <select
              value={config?.channel || ""}
              onChange={(e) => updateConfig('channel', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20 appearance-none cursor-pointer"
              required
            >
              <option value="" className="bg-black">Select a channel...</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id} className="bg-black">
                  {channel.is_private && <span className="opacity-70">🔒 </span>}
                  #{channel.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Message */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          Message <span className="text-red-400">*</span>
        </label>
        <textarea
          value={config?.message || ""}
          onChange={(e) => updateConfig('message', e.target.value)}
          placeholder="Hello from Execute! This is an automated message."
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none"
          rows={4}
          required
        />
        <p className="mt-1 text-xs text-white/40">
          You can use variables like {"{{"}contact.name{"}}"} in your message.
        </p>
      </div>

      {/* Optional Fields */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            const details = document.getElementById('slack-optional-fields');
            details?.classList.toggle('hidden');
          }}
          className="text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          + Optional settings
        </button>
        <div id="slack-optional-fields" className="hidden mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">
              Bot Username
            </label>
            <input
              type="text"
              value={config?.username || ""}
              onChange={(e) => updateConfig('username', e.target.value)}
              placeholder="Execute Bot"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">
              Icon Emoji
            </label>
            <input
              type="text"
              value={config?.icon_emoji || ""}
              onChange={(e) => updateConfig('icon_emoji', e.target.value)}
              placeholder=":robot_face:"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
