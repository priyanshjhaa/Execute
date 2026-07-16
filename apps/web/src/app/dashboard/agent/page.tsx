"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, Loader2, MessageSquare, Plus, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentThread {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentContentBlock {
  type: "text";
  text: string;
}

interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: AgentContentBlock[];
  createdAt: string;
}

interface SendMessageResponse {
  thread: {
    id: string;
    title: string;
    created: boolean;
  };
  messages: {
    user: AgentMessage;
    assistant: AgentMessage;
  };
}

type AgentStreamEvent =
  | { type: "start"; runId: string }
  | { type: "delta"; delta: string }
  | ({ type: "done" } & SendMessageResponse)
  | { type: "cancelled" }
  | { type: "error"; error: string };

const agentQueryKeys = {
  threads: ["agent", "threads"] as const,
  messages: (threadId: string) => ["agent", "threads", threadId, "messages"] as const,
};

function formatThreadTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getMessageText(message: AgentMessage): string {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const data = await response.json().catch(() => null);
  return new Error(data?.error || fallback);
}

export default function AgentPage() {
  const queryClient = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [pendingUserText, setPendingUserText] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRequestRef = useRef<AbortController | null>(null);

  const threadsQuery = useQuery<AgentThread[]>({
    queryKey: agentQueryKeys.threads,
    queryFn: async () => {
      const response = await fetch("/api/agent/threads");
      if (!response.ok) throw await readError(response, "Failed to load conversations");
      const data = await response.json();
      return data.threads || [];
    },
  });

  const messagesQuery = useQuery<AgentMessage[]>({
    queryKey: agentQueryKeys.messages(selectedThreadId || "new"),
    queryFn: async () => {
      const response = await fetch(`/api/agent/threads/${selectedThreadId}/messages`);
      if (!response.ok) throw await readError(response, "Failed to load conversation");
      const data = await response.json();
      return data.messages || [];
    },
    enabled: !!selectedThreadId,
  });

  const sendMessage = useMutation<SendMessageResponse | null, Error, string>({
    mutationFn: async (message) => {
      const runId = crypto.randomUUID();
      const requestController = new AbortController();
      activeRequestRef.current = requestController;
      setActiveRunId(runId);
      setPendingUserText(message);
      setStreamingText("");

      try {
        const response = await fetch("/api/agent/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId,
            message,
            ...(selectedThreadId ? { threadId: selectedThreadId } : {}),
          }),
          signal: requestController.signal,
        });

        if (!response.ok) throw await readError(response, "Failed to send message");
        if (!response.body) throw new Error("Streaming is unavailable");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let completedResponse: SendMessageResponse | null = null;
        let wasCancelled = false;

        const handleLine = (line: string) => {
          if (!line.trim()) return;
          const event = JSON.parse(line) as AgentStreamEvent;

          if (event.type === "delta") {
            setStreamingText((current) => current + event.delta);
          } else if (event.type === "done") {
            completedResponse = {
              thread: event.thread,
              messages: event.messages,
            };
          } else if (event.type === "cancelled") {
            wasCancelled = true;
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          lines.forEach(handleLine);

          if (done) {
            if (buffer) handleLine(buffer);
            break;
          }
        }

        if (wasCancelled) return null;
        if (!completedResponse) throw new Error("Agent stream ended before completion");
        return completedResponse;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return null;
        }
        throw error;
      } finally {
        activeRequestRef.current = null;
        setActiveRunId(null);
      }
    },
    onSuccess: (data) => {
      setPendingUserText("");
      setStreamingText("");
      if (!data) return;

      const threadId = data.thread.id;
      queryClient.setQueryData<AgentMessage[]>(
        agentQueryKeys.messages(threadId),
        (current = []) => [...current, data.messages.user, data.messages.assistant],
      );
      setSelectedThreadId(threadId);
      setDraft("");
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.threads });
    },
    onError: () => {
      setPendingUserText("");
      setStreamingText("");
    },
  });

  const threads = threadsQuery.data || [];
  const messages = selectedThreadId ? (messagesQuery.data || []) : [];
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sendMessage.isPending, streamingText]);

  const startConversation = () => {
    setSelectedThreadId(null);
    setDraft("");
    setMobileConversationOpen(true);
    sendMessage.reset();
  };

  const selectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setMobileConversationOpen(true);
    sendMessage.reset();
  };

  const submitMessage = (event?: FormEvent) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || sendMessage.isPending) return;
    sendMessage.mutate(message);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  const stopResponse = () => {
    if (!activeRunId) return;

    void fetch(`/api/agent/runs/${activeRunId}/cancel`, { method: "POST" })
      .catch(() => undefined);
    activeRequestRef.current?.abort();
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[540px] flex-col bg-black">
      <header className="border-b border-white/10 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-white/60" />
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Agent</h1>
            <p className="mt-1 text-sm text-white/45">Ask questions and plan work with Execute</p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 p-3 sm:p-4 lg:p-6">
        <div className="mx-auto flex h-full max-w-7xl overflow-hidden rounded-xl border border-white/10 bg-white/[0.015]">
          <aside className={cn(
            "w-full shrink-0 border-white/10 bg-black md:block md:w-72 md:border-r lg:w-80",
            mobileConversationOpen ? "hidden" : "block",
          )}>
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <h2 className="text-sm font-semibold text-white">Conversations</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={startConversation}
                className="h-9 w-9 text-white/60 hover:bg-white/5 hover:text-white"
                aria-label="New conversation"
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="h-[calc(100%-4rem)] overflow-y-auto p-2">
              {threadsQuery.isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                </div>
              ) : threadsQuery.isError ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm text-red-300/80">{threadsQuery.error.message}</p>
                  <button
                    type="button"
                    onClick={() => threadsQuery.refetch()}
                    className="mt-3 text-xs font-medium text-white/60 hover:text-white"
                  >
                    Try again
                  </button>
                </div>
              ) : threads.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <MessageSquare className="mx-auto h-6 w-6 text-white/20" />
                  <p className="mt-3 text-sm text-white/45">No conversations yet</p>
                  <button
                    type="button"
                    onClick={startConversation}
                    className="mt-2 text-xs font-medium text-white/70 hover:text-white"
                  >
                    Start a conversation
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {threads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => selectThread(thread.id)}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                        selectedThreadId === thread.id
                          ? "bg-white/10 text-white"
                          : "text-white/60 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span className="line-clamp-2 min-w-0 text-sm leading-5">{thread.title}</span>
                      <span className="shrink-0 pt-0.5 text-[11px] text-white/30">
                        {formatThreadTime(thread.lastMessageAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className={cn(
            "min-w-0 flex-1 flex-col bg-black",
            mobileConversationOpen ? "flex" : "hidden md:flex",
          )}>
            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4 sm:px-5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMobileConversationOpen(false)}
                className="h-9 w-9 text-white/60 hover:bg-white/5 hover:text-white md:hidden"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {selectedThread?.title || "New conversation"}
                </p>
                <p className="text-xs text-white/35">Execute Agent</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {messagesQuery.isLoading && selectedThreadId ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                </div>
              ) : messagesQuery.isError ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <p className="text-sm text-red-300/80">{messagesQuery.error.message}</p>
                  <button
                    type="button"
                    onClick={() => messagesQuery.refetch()}
                    className="mt-3 text-xs font-medium text-white/60 hover:text-white"
                  >
                    Try again
                  </button>
                </div>
              ) : messages.length === 0 && !sendMessage.isPending ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <Bot className="h-5 w-5 text-white/55" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">What are you working on?</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-white/40">
                    Ask about workflows, schedules, forms, executions, contacts, or integrations.
                  </p>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
                  {messages.map((message) => {
                    const isUser = message.role === "user";
                    return (
                      <div
                        key={message.id}
                        className={cn("flex", isUser ? "justify-end" : "justify-start")}
                      >
                        <div className={cn(
                          "max-w-[88%] whitespace-pre-wrap text-sm leading-6 sm:max-w-[78%]",
                          isUser
                            ? "rounded-2xl rounded-br-md bg-white/10 px-4 py-2.5 text-white"
                            : "text-white/75",
                        )}>
                          {getMessageText(message)}
                        </div>
                      </div>
                    );
                  })}
                  {sendMessage.isPending && pendingUserText && (
                    <div className="flex justify-end">
                      <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white/10 px-4 py-2.5 text-sm leading-6 text-white sm:max-w-[78%]">
                        {pendingUserText}
                      </div>
                    </div>
                  )}
                  {sendMessage.isPending && (
                    streamingText ? (
                      <div className="flex justify-start">
                        <div className="max-w-[88%] whitespace-pre-wrap text-sm leading-6 text-white/75 sm:max-w-[78%]">
                          {streamingText}
                          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-white/50 align-middle" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-white/40">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    )
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 p-3 sm:p-4">
              <form onSubmit={submitMessage} className="mx-auto max-w-3xl">
                {sendMessage.isError && (
                  <p className="mb-2 px-1 text-xs text-red-300/80">{sendMessage.error.message}</p>
                )}
                <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 focus-within:border-white/25">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Message Execute Agent..."
                    rows={1}
                    maxLength={4000}
                    disabled={sendMessage.isPending}
                    className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/30 disabled:opacity-60"
                  />
                  {sendMessage.isPending ? (
                    <Button
                      type="button"
                      size="icon"
                      onClick={stopResponse}
                      className="h-10 w-10 shrink-0"
                      aria-label="Stop generating"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!draft.trim()}
                      className="h-10 w-10 shrink-0"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-center text-[11px] text-white/25">
                  Enter to send, Shift + Enter for a new line
                </p>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
