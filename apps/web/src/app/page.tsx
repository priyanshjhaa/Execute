"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Zap,
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
    <main className="landing-shell min-h-screen bg-black overflow-hidden">
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
                Try Execute Agent
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero min-h-[92vh] sm:min-h-screen pt-24 sm:pt-32 pb-14 sm:pb-20 px-4 sm:px-6 relative z-10">
        <div className="landing-hero-bg" aria-hidden="true">
          <img
            src="/execute-hero-scenic.jpg"
            alt=""
            className="hero-scenic-image h-[100svh] w-full object-cover object-[62%_center] sm:object-center opacity-90"
            decoding="async"
          />
        </div>
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="max-w-3xl">
            <div className="hero-reveal inline-flex max-w-full items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/85 text-xs sm:text-sm font-medium mb-5 sm:mb-8">
              <Sparkles className="h-4 w-4" />
              <span className="truncate">Agent-planned. Human-approved. Reliably executed.</span>
            </div>

            <h1 className="hero-reveal text-[3rem] sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-white mb-5 sm:mb-6 tracking-normal leading-[1.02] sm:leading-[1.12] [animation-delay:90ms]">
              Ask for the outcome.
              <br />
              <span className="orb-gradient-text">Approve the plan. Execute runs it.</span>
            </h1>

            <p className="hero-reveal text-base sm:text-lg md:text-xl text-white/62 mb-5 sm:mb-8 max-w-2xl leading-relaxed [animation-delay:180ms]">
              Tell Execute Agent what you want done. It inspects your workspace, asks for missing details, and prepares a complete workflow or action for your review.
            </p>

            <p className="hero-reveal text-sm sm:text-base text-white/68 mb-7 sm:mb-10 max-w-xl [animation-delay:260ms]">
              Nothing changes until you approve it. Then Execute&apos;s deterministic engine carries out the work and records every step.
            </p>

            <div className="hero-reveal flex flex-col sm:flex-row gap-3 sm:gap-4 justify-start items-stretch sm:items-start [animation-delay:340ms]">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="text-sm sm:text-base btn-gradient text-black px-6 sm:px-10 py-6 sm:py-7 w-full sm:w-auto rounded-full transition-all duration-300 hover:scale-[1.02] hover:opacity-95"
                  style={{ animationDuration: "20s" }}
                >
                  Start with Execute Agent <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#how-it-works" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="text-sm sm:text-base border-white/20 text-white hover:bg-white/5 hover:text-white px-6 sm:px-8 py-6 w-full sm:w-auto rounded-full">
                  See how it works
                </Button>
              </Link>
            </div>

            <p className="hero-reveal mt-5 sm:mt-8 text-sm md:text-base text-white/50 leading-6 [animation-delay:420ms]">
              Create workflows • Schedule reminders • Send approved emails • Diagnose failed runs
            </p>

            <div className="hero-reveal mt-8 sm:mt-16 grid grid-cols-1 min-[420px]:grid-cols-2 sm:flex sm:flex-row sm:flex-wrap gap-3 sm:gap-8 text-sm text-white/46 [animation-delay:500ms]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-white/60" />
                <span>Workspace-aware planning</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-white/60" />
                <span>Approval before every change</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-white/60" />
                <span>Tenant-scoped context</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-white/60" />
                <span>Traceable execution</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="landing-section reveal-on-scroll py-20 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 sm:mb-20">
            <div className="text-xs uppercase tracking-[0.22em] text-white/35 mb-4">Ask. Review. Run.</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">A conversation becomes controlled, executable work.</h2>
            <p className="text-lg sm:text-xl text-white/50">
              The agent handles ambiguity and planning. You keep control of every change. The execution engine handles the run.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 sm:gap-12">
            {/* Step 1 */}
            <div className="landing-card space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Terminal className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 1</div>
              <h3 className="text-2xl font-bold text-white">Ask for an outcome</h3>
              <p className="text-white/40 leading-relaxed">
                Describe the result in plain English. The agent checks your workflows, forms, contacts, integrations, and recent execution history before it responds.
              </p>
            </div>

            {/* Step 2 */}
            <div className="landing-card space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 2</div>
              <h3 className="text-2xl font-bold text-white">Review the proposal</h3>
              <p className="text-white/40 leading-relaxed">
                The agent clarifies missing recipients, timing, timezone, or configuration and presents the exact change for approval.
              </p>
            </div>

            {/* Step 3 */}
            <div className="landing-card space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Zap className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 3</div>
              <h3 className="text-2xl font-bold text-white">Let Execute run it</h3>
              <p className="text-white/40 leading-relaxed">
                Approved work passes to the deterministic engine. Every step, wait, result, and failure stays visible in execution history.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section reveal-on-scroll py-20 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 sm:mb-20">
            <div className="text-xs uppercase tracking-[0.22em] text-white/35 mb-4">One agent, grounded in your workspace</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">Plan broadly. Act carefully. Execute predictably.</h2>
            <p className="text-lg sm:text-xl text-white/50">
              Execute Agent coordinates the work you already manage—without bypassing validation, approvals, tenant boundaries, or your execution engine.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="landing-card group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <Mail className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Agent-built workflows</h3>
                <p className="text-white/40 leading-relaxed">
                  Ask for a recurring reminder, an onboarding sequence, or an API workflow. The agent produces a validated definition ready for review.
                </p>
              </div>
            </div>

            <div className="landing-card group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <MessageSquare className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Approval before action</h3>
                <p className="text-white/40 leading-relaxed">
                  Creating records, changing workflows, sending email, disconnecting integrations, and starting runs all require explicit confirmation.
                </p>
              </div>
            </div>

            <div className="landing-card group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <Users className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Workspace-aware answers</h3>
                <p className="text-white/40 leading-relaxed">
                  Inspect workflows, forms, contacts, integrations, executions, and logs through read-only tools scoped to the current workspace.
                </p>
              </div>
            </div>

            <div className="landing-card group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <GitBranch className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Deterministic execution</h3>
                <p className="text-white/40 leading-relaxed">
                  The model proposes; server validation and the existing engine perform. Runs can wait, branch, call APIs, send messages, and report results.
                </p>
              </div>
            </div>

            <div className="landing-card group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <Clock className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Scheduled autonomy</h3>
                <p className="text-white/40 leading-relaxed">
                  Approve an active schedule once, then let the engine run it in the confirmed timezone with every recurrence recorded.
                </p>
              </div>
            </div>

            <div className="landing-card group relative p-6 sm:p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <Globe className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Failures that explain themselves</h3>
                <p className="text-white/40 leading-relaxed">
                  Failed runs are classified, summarized, and placed in Needs Attention with evidence and a repair path that still requires approval.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Basic vs Premium */}
      <section className="landing-section reveal-on-scroll py-20 sm:py-28 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 sm:mb-16 text-center">
            <div className="inline-flex max-w-full items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs sm:text-sm font-medium mb-6">
              <Lock className="h-4 w-4" />
              <span className="truncate">A safe operating model for agentic work</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Start with an agent you can supervise.
              <br />
              <span className="text-white/70">Expand the action surface over time.</span>
            </h2>
            <p className="text-base sm:text-lg text-white/50 max-w-3xl mx-auto">
              The core experience combines workspace inspection, validated proposals, explicit approvals, and traceable execution. Premium will extend the actions and integrations the same agent can coordinate.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="landing-card relative p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="relative z-10">
                <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Available today</div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">Basic</h3>
                <p className="text-sm sm:text-base text-white/50 mb-6 sm:mb-8">For teams adopting supervised, agent-driven automation</p>

                <div className="space-y-4 mb-10">
                  {[
                    "Create and revise workflows with the Agent",
                    "Approve every write and external effect",
                    "Run schedules, forms, webhooks, and APIs",
                    "Manage contacts, forms, and integrations",
                    "Inspect execution history and logs",
                    "Diagnose failures in Needs Attention",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-white/80">
                      <CheckCircle2 className="h-5 w-5 text-white/75 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}

                  {[
                    "Send SMS",
                    "Coordinate additional providers",
                    "Use expanded workspace limits",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-white/35">
                      <X className="h-5 w-5 text-white/25 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Link href="/signup" className="block">
                  <Button className="w-full bg-white text-black hover:bg-white/90 rounded-full py-6 text-sm sm:text-base font-medium">
                    Start with Execute Agent
                  </Button>
                </Link>
              </div>
            </div>

            <div className="landing-card relative p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
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
                <p className="text-sm sm:text-base text-white/50">Everything in Basic, plus a broader catalog of approved actions and integrations</p>
                <div className="mt-5 mb-6 sm:mb-8">
                  <div className="text-3xl sm:text-4xl font-bold text-white">₹499<span className="text-lg sm:text-xl text-white/75 font-medium">/month</span></div>
                  <div className="text-sm text-white/40 mt-1">~$5.69/month</div>
                </div>

                <div className="space-y-4 mb-10">
                  {[
                    "Everything in the supervised Agent workspace",
                    "Higher daily usage and context limits",
                    "More integration providers",
                    "Advanced workflow actions",
                    "Expanded monitoring and diagnostics",
                    "Team-oriented controls",
                    "Send SMS",
                    "Create tasks across connected tools",
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
              The Agent plans; the engine executes
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
              <MessageSquare className="h-4 w-4" />
              Every mutation remains approval-gated
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
              <Users className="h-4 w-4" />
              Workspace data stays tenant-scoped
            </span>
          </div>
        </div>
      </section>

      {/* Example Use Cases */}
      <section className="landing-section reveal-on-scroll py-20 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 sm:mb-20">
            <div className="text-xs uppercase tracking-[0.22em] text-white/35 mb-4">What a conversation can become</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">From request to proposal to receipt.</h2>
            <p className="text-lg sm:text-xl text-white/50">
              The Agent gathers what is missing, shows what will change, and stays with the work through execution.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="landing-card p-6 sm:p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-xs sm:text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10 break-words leading-6">
                &quot;Create an onboarding form and connect it to a workflow that welcomes each new customer&quot;
              </code>
              <p className="text-white/40">
                The Agent proposes the form, linked workflow, fields, and actions as reviewable changes.
              </p>
            </div>

            <div className="landing-card p-6 sm:p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-xs sm:text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10 break-words leading-6">
                &quot;Every Monday at 5 PM, remind me about the weekly meeting&quot;
              </code>
              <p className="text-white/40">
                The Agent asks for timezone and delivery details before proposing an active recurring workflow.
              </p>
            </div>

            <div className="landing-card p-6 sm:p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-xs sm:text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10 break-words leading-6">
                &quot;Why did yesterday&apos;s customer sync fail, and what should I fix?&quot;
              </code>
              <p className="text-white/40">
                Read-only tools inspect the failed execution and logs, then propose a repair without applying it.
              </p>
            </div>

            <div className="landing-card p-6 sm:p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-xs sm:text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10 break-words leading-6">
                &quot;Log ₹5,000 as a marketing expense and show my total this month&quot;
              </code>
              <p className="text-white/40">
                Writing the expense requires approval; reading the tenant-scoped event summary does not.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-section reveal-on-scroll py-20 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Give the Agent one outcome.
          </h2>
          <p className="text-lg sm:text-xl text-white/50 mb-8 sm:mb-10 max-w-2xl mx-auto">
            Review the plan, approve the exact action, and let Execute turn it into work you can inspect from first trigger to final result.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="text-sm sm:text-base btn-gradient text-black px-6 sm:px-8 py-6 w-full sm:w-auto rounded-full">
                Start with Execute Agent <ArrowRight className="ml-2 h-5 w-5" />
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
          <p>&copy; 2026 Execute. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
