"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, XCircle, Clock, Loader2, Wand2, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickCommandInput } from "@/components/quick-command-input";
import Link from "next/link";

interface QuickCommand {
  id: string;
  input: string;
  classifiedIntent: {
    intent: string;
    entity: string;
    title: string;
  };
  actionTaken: {
    type: string;
    message: string;
  };
  status: string;
  errorMessage?: string;
  createdAt: string;
}

interface CommandCounts {
  all: number;
  expense: number;
  client: number;
  task: number;
  email: number;
  note: number;
  contact: number;
  reminder: number;
}

const filters = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'expense', label: 'Expenses', icon: '💰' },
  { key: 'client', label: 'Clients', icon: '🤝' },
  { key: 'task', label: 'Tasks', icon: '✅' },
  { key: 'email', label: 'Emails', icon: '📧' },
  { key: 'note', label: 'Notes', icon: '📝' },
  { key: 'contact', label: 'Contacts', icon: '👤' },
  { key: 'reminder', label: 'Reminders', icon: '⏰' },
];

function getIntentBadge(intent: string) {
  switch (intent) {
    case "log_event":
      return <span className="px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs capitalize">Log</span>;
    case "execute_now":
      return <span className="px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs capitalize">Execute</span>;
    case "schedule_followup":
      return <span className="px-2 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs capitalize">Follow-up</span>;
    case "query_only":
      return <span className="px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs capitalize">Query</span>;
    default:
      return <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 text-xs capitalize">{intent}</span>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <div className="flex items-center gap-1.5 text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="text-xs">Done</span>
        </div>
      );
    case "failed":
      return (
        <div className="flex items-center gap-1.5 text-red-400">
          <XCircle className="h-3.5 w-3.5" />
          <span className="text-xs">Failed</span>
        </div>
      );
    case "pending":
      return (
        <div className="flex items-center gap-1.5 text-yellow-400">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-xs">Pending</span>
        </div>
      );
    default:
      return <span className="text-xs text-white/40 capitalize">{status}</span>;
  }
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function QuickCommandsPage() {
  const [commands, setCommands] = useState<QuickCommand[]>([]);
  const [counts, setCounts] = useState<CommandCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCommands = async (append = false) => {
    try {
      const limit = append ? commands.length + 20 : 20;
      const params = new URLSearchParams({
        limit: limit.toString(),
        filter: activeFilter,
      });
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`/api/quick-command?${params}`);

      if (!response.ok) {
        if (response.status === 401) {
          setCommands([]);
          return;
        }
        throw new Error('Failed to fetch quick commands');
      }

      const data = await response.json();
      setCommands(data.history || []);
      setHasMore(data.hasMore || false);
      setCounts(data.counts || null);
    } catch (error) {
      console.error('Error fetching quick commands:', error);
      setCommands([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchCommands();
  }, [activeFilter, searchQuery]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    fetchCommands(true);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchCommands();
  };

  const handleCommandExecuted = () => {
    // Refresh the list after a command is executed
    fetchCommands();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Wand2 className="h-6 w-6 text-purple-400" />
                <h1 className="text-3xl font-bold text-white">Quick Commands</h1>
              </div>
              <p className="text-white/50 ml-9">
                Tell Execute what happened or what you want done
              </p>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={loading}
              className="border-white/20 text-white hover:bg-white/5 rounded-full"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-8 py-8">
        {/* Quick Command Input - Always at top */}
        <div className="mb-8">
          <QuickCommandInput onCommandExecuted={handleCommandExecuted} />
        </div>

        {/* Filters and Search */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const count = counts?.[filter.key as keyof CommandCounts] || 0;
                return (
                  <button
                    key={filter.key}
                    onClick={() => setActiveFilter(filter.key)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${
                      activeFilter === filter.key
                        ? 'bg-white/10 border-white/30 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <span>{filter.icon}</span>
                    <span>{filter.label}</span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-md text-xs ${
                        activeFilter === filter.key
                          ? 'bg-white/20 text-white/80'
                          : 'bg-white/10 text-white/40'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search commands..."
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors text-sm"
              />
            </div>
          </div>
        </div>

        {/* Commands List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
          </div>
        ) : commands.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-6">
              <Wand2 className="h-10 w-10 text-white/20" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery ? 'No commands found' : 'No quick commands yet'}
            </h3>
            <p className="text-white/40">
              {searchQuery
                ? 'Try a different search term or filter'
                : 'Use the input above to log your first command'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 text-sm font-medium text-white/40 border-b border-white/10">
              <div className="col-span-5">Command</div>
              <div className="col-span-2">Intent</div>
              <div className="col-span-2">Entity</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Time</div>
            </div>

            {/* Commands */}
            {commands.map((command) => (
              <div
                key={command.id}
                className="p-4 md:p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 transition-all duration-300"
              >
                {/* Mobile View */}
                <div className="md:hidden space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">"{command.input}"</p>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(command.status)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getIntentBadge(command.classifiedIntent?.intent || 'unknown')}
                    <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 text-xs capitalize">
                      {command.classifiedIntent?.entity || 'unknown'}
                    </span>
                  </div>
                  {command.actionTaken?.message && (
                    <p className="text-sm text-white/60">{command.actionTaken.message}</p>
                  )}
                  {command.errorMessage && (
                    <p className="text-sm text-red-400">{command.errorMessage}</p>
                  )}
                  <p className="text-xs text-white/30">{getRelativeTime(command.createdAt)}</p>
                </div>

                {/* Desktop View */}
                <div className="hidden md:grid md:grid-cols-12 gap-4 items-center">
                  {/* Command */}
                  <div className="col-span-5 min-w-0">
                    <p className="text-white/90 font-medium truncate" title={command.input}>
                      "{command.input}"
                    </p>
                    {command.actionTaken?.message && !command.errorMessage && (
                      <p className="text-sm text-white/40 truncate mt-1">{command.actionTaken.message}</p>
                    )}
                    {command.errorMessage && (
                      <p className="text-sm text-red-400 truncate mt-1">{command.errorMessage}</p>
                    )}
                  </div>

                  {/* Intent */}
                  <div className="col-span-2">
                    {getIntentBadge(command.classifiedIntent?.intent || 'unknown')}
                  </div>

                  {/* Entity */}
                  <div className="col-span-2">
                    <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 text-xs capitalize">
                      {command.classifiedIntent?.entity || 'unknown'}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    {getStatusBadge(command.status)}
                  </div>

                  {/* Time */}
                  <div className="col-span-1 text-right text-sm text-white/40">
                    {getRelativeTime(command.createdAt)}
                  </div>
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5 rounded-full"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
