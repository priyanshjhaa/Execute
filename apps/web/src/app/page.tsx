"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Zap,
  Shield,
  Clock,
  CheckCircle2,
  Terminal,
  Sparkles,
  GitBranch,
  Lock,
  Mail,
  MessageSquare,
  Users,
  Globe,
  Phone,
  ListChecks,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function Home() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== "undefined") {
        const currentScrollY = window.scrollY;

        // Show navbar when scrolling up, hide when scrolling down
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          setIsVisible(false);
        } else {
          setIsVisible(true);
        }

        setLastScrollY(currentScrollY);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <main className="min-h-screen bg-black">
      {/* Fixed gradient background */}
      <div className="gradient-bg"></div>
      {/* Navigation */}
      <nav
        className={`fixed top-0 w-full bg-transparent z-50 transition-transform duration-300 ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-white" />
            <span className="text-base sm:text-lg font-semibold text-white">Execute</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-6">
            <Link href="/login">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5 rounded-full px-3 sm:px-4">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-white text-black hover:bg-white/90 font-medium rounded-full px-4 sm:px-5">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="inline-flex max-w-full items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs sm:text-sm font-medium mb-6 sm:mb-8">
            <Sparkles className="h-4 w-4" />
            <span className="truncate">Quick commands, forms, schedules, and live workflow execution</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-5 sm:mb-6 tracking-tight leading-[1.05] sm:leading-[1.1]">
            Turn instructions
            <br />
            <span className="orb-gradient-text">into workflows that actually run.</span>
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-white/50 mb-6 sm:mb-8 max-w-3xl leading-relaxed">
            Send emails, post to Slack, call APIs, add delays, and branch with logic from plain English, quick commands, or hosted form triggers.
          </p>

          <p className="text-sm sm:text-base md:text-lg text-white/65 mb-8 sm:mb-10 max-w-2xl">
            No code. No busywork. Just describe what you want or trigger it from a form, command, or schedule.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-start items-stretch sm:items-start">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="text-sm sm:text-base btn-gradient text-black px-6 sm:px-10 py-6 sm:py-7 w-full sm:w-auto rounded-full transition-all duration-300 hover:scale-[1.02] hover:opacity-95"
                style={{ animationDuration: "20s" }}
              >
                Start building workflows <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#how-it-works" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="text-sm sm:text-base border-white/20 text-white hover:bg-white/5 hover:text-white px-6 sm:px-8 py-6 w-full sm:w-auto rounded-full">
                View demo
              </Button>
            </Link>
          </div>

          <p className="mt-6 sm:mt-8 text-sm md:text-base text-white/45 leading-6">
            Run quick commands • Trigger workflows from forms • Send emails and Slack updates • Call APIs on schedule
          </p>

          <div className="mt-10 sm:mt-16 flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:gap-8 text-sm text-white/40">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white/60" />
              <span>No coding required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white/60" />
              <span>Quick commands</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white/60" />
              <span>Form-triggered workflows</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white/60" />
              <span>Email, Slack, API calls, delays, and logic</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">How It Works</h2>
            <p className="text-lg sm:text-xl text-white/50">
              Describe a workflow once, trigger it from forms or events, or kick it off from quick commands and schedules. Execute runs it and logs what happened.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 sm:gap-12">
            {/* Step 1 */}
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Terminal className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 1</div>
              <h3 className="text-2xl font-bold text-white">Describe What You Want</h3>
              <p className="text-white/40 leading-relaxed">
                Tell Execute what needs to happen in plain English, from one-off automations to recurring workflows.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 2</div>
              <h3 className="text-2xl font-bold text-white">Choose How It Starts</h3>
              <p className="text-white/40 leading-relaxed">
                Launch it from a quick command, run it on a schedule, or trigger it from a hosted form or incoming event.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Zap className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 3</div>
              <h3 className="text-2xl font-bold text-white">Watch Execution Live</h3>
              <p className="text-white/40 leading-relaxed">
                Execute runs each step, logs the results, and shows you exactly what happened when a workflow succeeds, waits, or fails.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">Build automations from instructions, quick commands, forms, and schedules.</h2>
            <p className="text-lg sm:text-xl text-white/50">
              The core product today is workflow execution: triggers in, actions out, and clear logs for every run.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <Mail className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Send Emails</h3>
                <p className="text-white/40 leading-relaxed">
                  Send structured workflow emails for reminders, updates, outreach, and follow-ups without writing templates by hand.
                </p>
              </div>
            </div>

            <div className="group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <MessageSquare className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Slack Messages</h3>
                <p className="text-white/40 leading-relaxed">
                  Notify channels from live workflows with connected Slack integrations or direct webhook-based delivery.
                </p>
              </div>
            </div>

            <div className="group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <Users className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Forms As Triggers</h3>
                <p className="text-white/40 leading-relaxed">
                  Create hosted forms to collect submissions and trigger workflows automatically when someone fills them out.
                </p>
              </div>
            </div>

            <div className="group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <GitBranch className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Conditional Logic</h3>
                <p className="text-white/40 leading-relaxed">
                  Branch workflows based on trigger data and step results so the right path runs automatically.
                </p>
              </div>
            </div>

            <div className="group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <Clock className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Quick Commands & Timing</h3>
                <p className="text-white/40 leading-relaxed">
                  Tell Execute what happened or what you want done, then run it now, on schedule, or after a delay between steps.
                </p>
              </div>
            </div>

            <div className="group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <Globe className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">HTTP Requests & Logs</h3>
                <p className="text-white/40 leading-relaxed">
                  Connect to external APIs with custom requests and track each workflow run through execution history and step logs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Basic vs Premium */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 sm:mb-16 text-center">
            <div className="inline-flex max-w-full items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs sm:text-sm font-medium mb-6">
              <Lock className="h-4 w-4" />
              <span className="truncate">Workflow action plans</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Choose between what runs now
              <br />
              <span className="text-white/70">and what expands as Execute grows.</span>
            </h2>
            <p className="text-base sm:text-lg text-white/50 max-w-3xl mx-auto">
              Basic includes the workflow actions and triggers Execute can reliably run today. Premium includes all of Basic plus the higher-level actions already defined in the product vision.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="relative p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="relative z-10">
                <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Available today</div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">Basic</h3>
                <p className="text-sm sm:text-base text-white/50 mb-6 sm:mb-8">For teams starting with live, executable workflow actions</p>

                <div className="space-y-4 mb-10">
                  {[
                    "Send emails",
                    "Trigger HTTP requests",
                    "Add delays and schedules",
                    "Branch with conditional logic",
                    "Track workflow execution",
                    "Add contacts to lists",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-white/80">
                      <CheckCircle2 className="h-5 w-5 text-white/75 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}

                  {[
                    "Post Slack messages",
                    "Send SMS",
                    "Create tasks",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-white/35">
                      <X className="h-5 w-5 text-white/25 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Link href="/signup" className="block">
                  <Button className="w-full bg-white text-black hover:bg-white/90 rounded-full py-6 text-sm sm:text-base font-medium">
                    Start with Basic
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
                <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs bg-white/10 text-white/80 border border-white/15 rounded-full">
                  Coming Soon
                </span>
              </div>
              <div className="relative z-10">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3">Expanded plan</div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">Premium</h3>
                <p className="text-sm sm:text-base text-white/50">Everything in Basic, plus advanced workflow actions as they unlock</p>
                <div className="mt-5 mb-6 sm:mb-8">
                  <div className="text-3xl sm:text-4xl font-bold text-white">₹499<span className="text-lg sm:text-xl text-white/75 font-medium">/month</span></div>
                  <div className="text-sm text-white/40 mt-1">~$5.69/month</div>
                </div>

                <div className="space-y-4 mb-10">
                  {[
                    "Send emails",
                    "Post Slack messages",
                    "Trigger HTTP requests",
                    "Add delays and schedules",
                    "Branch with conditional logic",
                    "Track workflow execution",
                    "Add contacts to lists",
                    "Send SMS",
                    "Create tasks",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-white/85">
                      <CheckCircle2 className="h-5 w-5 text-white/80 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  className="w-full border-white/20 text-white/80 hover:bg-white/5 hover:text-white rounded-full py-6 text-sm sm:text-base font-medium"
                >
                  Explore Premium
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3 text-sm text-white/45">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
              <Mail className="h-4 w-4" />
              Basic runs live workflow actions today
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
              <MessageSquare className="h-4 w-4" />
              Premium adds Slack, SMS, and task automation
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
              <Users className="h-4 w-4" />
              List automation is included in Basic
            </span>
          </div>
        </div>
      </section>

      {/* Example Use Cases */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">What You Can Build</h2>
            <p className="text-lg sm:text-xl text-white/50">
              Real workflows you can launch from instructions, forms, quick commands, and schedules
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 sm:p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-xs sm:text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10 break-words leading-6">
                &quot;When someone submits my onboarding form, send a welcome email and notify the team in Slack&quot;
              </code>
              <p className="text-white/40">
                Hosted form submissions that kick off real workflows automatically
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-xs sm:text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10 break-words leading-6">
                &quot;We signed Acme Corp&quot;
              </code>
              <p className="text-white/40">
                Quick commands that turn business updates into tracked workflow runs
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-xs sm:text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10 break-words leading-6">
                &quot;Call our internal API, wait 5 minutes, then alert Slack if the response fails&quot;
              </code>
              <p className="text-white/40">
                API-based automation with delays, retries, and branching logic
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-xs sm:text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10 break-words leading-6">
                &quot;Every Monday at 9 AM, send a project reminder email and log the run for review&quot;
              </code>
              <p className="text-white/40">
                Scheduled workflows with visible execution history
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Ready to turn instructions into execution?
          </h2>
          <p className="text-lg sm:text-xl text-white/50 mb-8 sm:mb-10 max-w-2xl mx-auto">
            Build workflows that run from schedules, quick commands, and form submissions without chasing every task manually.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="text-sm sm:text-base btn-gradient text-black px-6 sm:px-8 py-6 w-full sm:w-auto rounded-full">
                Create your first execution <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#how-it-works" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="text-sm sm:text-base border-white/20 text-white hover:bg-white/5 hover:text-white px-6 sm:px-8 py-6 w-full sm:w-auto rounded-full">
                See how it works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6 relative z-10">
        <div className="container mx-auto text-center text-sm text-white/40">
          <p>&copy; 2025 Execute. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
