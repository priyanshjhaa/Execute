"use client";

import { useState } from "react";
import { Loader2, Wand2, Sparkles, ArrowRight, Clock } from "lucide-react";

interface QuickCommandInputProps {
  onCommandExecuted?: (result: any) => void;
}

const suggestions = [
  { icon: "💰", text: "Spent ₹5,000 on Facebook ads", label: "Log expense" },
  { icon: "🤝", text: "We signed Acme Corp today", label: "Log client" },
  { icon: "📧", text: "Send meeting reminder to team", label: "Send email" },
  { icon: "📝", text: "Client presentation sent", label: "Add reminder" },
];

export function QuickCommandInput({ onCommandExecuted }: QuickCommandInputProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();

    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/quick-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process command');
      }

      setResult(data);
      setInput("");
      setShowSuggestions(false);
      onCommandExecuted?.(data);

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="w-full">
      {/* Input Box */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : result ? (
            <Sparkles className="h-5 w-5 text-green-400" />
          ) : (
            <Wand2 className="h-5 w-5" />
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(false);
            }}
            onFocus={() => setShowSuggestions(!result && !input)}
            placeholder="What happened or what do you want done?"
            className="w-full pl-14 pr-14 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
            disabled={loading}
            autoComplete="off"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            <ArrowRight className="h-5 w-5 text-white" />
          </button>
        </form>
      </div>

      {/* Result Message */}
      {result && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <p className="text-green-400">{result.actionTaken?.message || 'Command executed!'}</p>
          {result.actionTaken?.reminderInfo && (
            <p className="text-green-300/70 text-sm mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {result.actionTaken.reminderInfo}
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Suggestions */}
      {showSuggestions && !result && !error && (
        <div className="mt-4">
          <p className="text-xs text-white/40 mb-3">Try these examples:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion.text)}
                className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/10 rounded-xl hover:bg-white/5 hover:border-white/20 transition-colors text-left"
              >
                <span className="text-lg">{suggestion.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">{suggestion.text}</p>
                  <p className="text-xs text-white/40">{suggestion.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
