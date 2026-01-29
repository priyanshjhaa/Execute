"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Wand2, Clock, Calendar, Zap } from "lucide-react";
import { SchedulePicker } from "@/components/workflows/schedule-picker";
import { EventTriggerSelector } from "@/components/workflows/event-trigger-selector";

type TriggerType = 'now' | 'schedule' | 'event';

interface ScheduleData {
  frequency: 'daily' | 'weekly' | 'monthly';
  day?: string;
  time: string;
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const [what, setWhat] = useState("");
  const [when, setWhen] = useState<TriggerType>('now');
  const [schedule, setSchedule] = useState<ScheduleData>({
    frequency: 'weekly',
    day: 'Monday',
    time: '09:00'
  });
  const [event, setEvent] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Build the request payload
      const payload: any = {
        what,
        when,
      };

      if (when === 'schedule') {
        payload.schedule = schedule;
      } else if (when === 'event') {
        payload.event = event;
      }

      if (additionalContext.trim()) {
        payload.additionalContext = additionalContext.trim();
      }

      // Call the workflow generation API
      const response = await fetch('/api/workflows/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to generate workflow');
      }

      // TODO: Save workflow to database and redirect to edit page
      console.log('Generated workflow:', data.workflow);

      // For now, just redirect to workflows list
      router.push('/dashboard/workflows');
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow');
      setLoading(false);
    }
  };

  const isFormValid = what.trim() && (
    when === 'now' ||
    (when === 'schedule' && schedule.time) ||
    (when === 'event' && event.trim())
  );

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <Link href="/dashboard/workflows">
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white mb-4 rounded-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workflows
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            Create New Workflow
          </h1>
          <p className="text-white/50">
            Describe what you want to automate, and we'll convert it into
            executable steps.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
          {/* Section 1: What should happen? */}
          <div className="space-y-3">
            <label className="block text-lg font-semibold text-white">
              Describe what you want to happen
            </label>
            <textarea
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder="Send a reminder email to my team about the weekly meeting"
              className="w-full h-32 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors resize-none"
              required
              disabled={loading}
            />
            <p className="text-sm text-white/40">
              Be specific about what actions should be taken.
            </p>
          </div>

          {/* Section 2: When should this happen? */}
          <div className="space-y-4">
            <label className="block text-lg font-semibold text-white">
              When should this happen?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setWhen('now')}
                className={`p-6 rounded-2xl border-2 transition-all text-left ${
                  when === 'now'
                    ? 'bg-blue-500/20 border-blue-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <Zap className="h-6 w-6 mb-3" />
                <div className="font-semibold mb-1">Now</div>
                <div className="text-sm opacity-70">Run once immediately</div>
              </button>

              <button
                type="button"
                onClick={() => setWhen('schedule')}
                className={`p-6 rounded-2xl border-2 transition-all text-left ${
                  when === 'schedule'
                    ? 'bg-blue-500/20 border-blue-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <Calendar className="h-6 w-6 mb-3" />
                <div className="font-semibold mb-1">On a schedule</div>
                <div className="text-sm opacity-70">Repeat daily, weekly, or monthly</div>
              </button>

              <button
                type="button"
                onClick={() => setWhen('event')}
                className={`p-6 rounded-2xl border-2 transition-all text-left ${
                  when === 'event'
                    ? 'bg-blue-500/20 border-blue-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <Clock className="h-6 w-6 mb-3" />
                <div className="font-semibold mb-1">When something happens</div>
                <div className="text-sm opacity-70">Triggered by events</div>
              </button>
            </div>

            {/* Schedule Picker */}
            {when === 'schedule' && (
              <div className="mt-6 p-6 bg-white/[0.02] border border-white/10 rounded-2xl">
                <SchedulePicker value={schedule} onChange={setSchedule} />
              </div>
            )}

            {/* Event Selector */}
            {when === 'event' && (
              <div className="mt-6 p-6 bg-white/[0.02] border border-white/10 rounded-2xl">
                <EventTriggerSelector value={event} onChange={setEvent} />
              </div>
            )}
          </div>

          {/* Section 3: Anything else? (Optional) */}
          <div className="space-y-3">
            <label className="block text-lg font-semibold text-white">
              Anything else? <span className="font-normal text-white/50">(optional)</span>
            </label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Use a friendly tone, include meeting agenda from #general..."
              className="w-full h-24 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors resize-none"
              disabled={loading}
            />
            <p className="text-sm text-white/40">
              Add any special instructions, context, or requirements.
            </p>
          </div>

          {/* Examples */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Example Workflows
            </h3>
            <ul className="space-y-3 text-white/70">
              <li className="flex items-start gap-2">
                <span className="text-white/40 mt-1">•</span>
                <span>
                  <strong className="text-white/80">What:</strong> Send a Slack message to #sales<br />
                  <strong className="text-white/80">When:</strong> When user fills form<br />
                  <strong className="text-white/80">Extra:</strong> Only if lead value &gt; $5000
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/40 mt-1">•</span>
                <span>
                  <strong className="text-white/80">What:</strong> Send reminder email to my team<br />
                  <strong className="text-white/80">When:</strong> On a schedule (Every Monday at 9am)<br />
                  <strong className="text-white/80">Extra:</strong> Use a friendly tone
                </span>
              </li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            disabled={loading || !isFormValid}
            className="text-base btn-gradient px-8 py-6 rounded-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating Workflow...
              </>
            ) : (
              <>
                <Wand2 className="h-5 w-5 mr-2" />
                Generate Workflow
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
