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
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-white" />
            <span className="text-lg font-semibold text-white">Execute</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5 rounded-full">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-white text-black hover:bg-white/90 font-medium rounded-full">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen pt-32 pb-20 px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white text-sm font-medium mb-8">
            <Sparkles className="h-4 w-4" />
            <span>Email, Slack, API, and scheduled workflows</span>
          </div>

          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6 tracking-tight leading-[1.1]">
            Turn simple instructions
            <br />
            <span className="orb-gradient-text">into automated workflows.</span>
          </h1>

          <p className="text-xl md:text-2xl text-white/50 mb-10 max-w-3xl leading-relaxed">
            Send emails, call APIs, and run tasks - all from plain English.
          </p>

          <p className="text-base md:text-lg text-white/65 mb-10 max-w-2xl">
            No code. No setup. Just describe what you want.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-start items-start">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="text-base btn-gradient text-black px-10 py-7 w-full sm:w-auto rounded-full transition-all duration-300 hover:scale-[1.02] hover:opacity-95"
                style={{ animationDuration: "20s" }}
              >
                Start building workflows <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#how-it-works" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="text-base border-white/20 text-white hover:bg-white/5 hover:text-white px-8 py-6 w-full sm:w-auto rounded-full">
                View demo
              </Button>
            </Link>
          </div>

          <p className="mt-8 text-sm md:text-base text-white/45">
            Send onboarding emails • Notify your team • Trigger APIs • Schedule reminders
          </p>

          <div className="mt-16 flex flex-wrap gap-8 text-sm text-white/40">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white/60" />
              <span>No coding required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white/60" />
              <span>Email workflows</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white/60" />
              <span>Slack messages</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white/60" />
              <span>API calls, delays, and logic</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">How It Works</h2>
            <p className="text-xl text-white/50">
              You set it up once. Execute runs it on time and shows you exactly what happened.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Terminal className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 1</div>
              <h3 className="text-2xl font-bold text-white">Describe What You Want</h3>
              <p className="text-white/40 leading-relaxed">
                Tell Execute what needs to happen in plain English—like &quot;Send a weekly email to my marketing contacts&quot;
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 2</div>
              <h3 className="text-2xl font-bold text-white">We Build the Steps</h3>
              <p className="text-white/40 leading-relaxed">
                AI converts your request into executable steps. Review, edit if needed, then set your schedule.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Zap className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 3</div>
              <h3 className="text-2xl font-bold text-white">It Just Happens</h3>
              <p className="text-white/40 leading-relaxed">
                Execute runs your workflow on schedule. Watch in real-time or check the log to see exactly what happened.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">Schedule tasks, send emails, and track execution without remembering or checking.</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="group relative p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
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
                  Automate email sending with personalization using our contact management system
                </p>
              </div>
            </div>

            <div className="group relative p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
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
                  Send messages to your Slack channels with one-click OAuth integration
                </p>
              </div>
            </div>

            <div className="group relative p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <Users className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Contact Management</h3>
                <p className="text-white/40 leading-relaxed">
                  Organize contacts into groups and target specific segments in your workflows
                </p>
              </div>
            </div>

            <div className="group relative p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
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
                  Create smart workflows that branch based on conditions and previous results
                </p>
              </div>
            </div>

            <div className="group relative p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <Clock className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Delays & Scheduling</h3>
                <p className="text-white/40 leading-relaxed">
                  Add waits between steps or schedule workflows to run at specific times
                </p>
              </div>
            </div>

            <div className="group relative p-8 rounded-xl border border-white/10 transition-all duration-300 bg-white/[0.02] overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 card-gradient-border opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative z-10">
                <Globe className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">HTTP Requests</h3>
                <p className="text-white/40 leading-relaxed">
                  Connect to any API service with custom HTTP requests for advanced integrations
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Basic vs Premium */}
      <section className="py-28 px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm font-medium mb-6">
              <Lock className="h-4 w-4" />
              <span>Workflow action plans</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Choose between what runs now
              <br />
              <span className="text-white/70">and what expands with Premium.</span>
            </h2>
            <p className="text-lg text-white/50 max-w-3xl mx-auto">
              Basic includes the workflow actions Execute can reliably run today. Premium includes all of Basic plus the higher-level actions already defined in the product vision.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="relative p-8 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="relative z-10">
                <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Available today</div>
                <h3 className="text-3xl font-bold text-white mb-2">Basic</h3>
                <p className="text-white/50 mb-8">For teams starting with live, executable workflow actions</p>

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
                  <Button className="w-full bg-white text-black hover:bg-white/90 rounded-full py-6 text-base font-medium">
                    Start with Basic
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative p-8 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 card-gradient-bg"></div>
              </div>
              <div className="absolute right-6 top-6">
                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-white/10 text-white/80 border border-white/15 rounded-full">
                  Coming Soon
                </span>
              </div>
              <div className="relative z-10">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3">Expanded plan</div>
                <h3 className="text-3xl font-bold text-white mb-2">Premium</h3>
                <p className="text-white/50">Everything in Basic, plus advanced workflow actions as they unlock</p>
                <div className="mt-5 mb-8">
                  <div className="text-4xl font-bold text-white">₹499<span className="text-xl text-white/75 font-medium">/month</span></div>
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
                  className="w-full border-white/20 text-white/80 hover:bg-white/5 hover:text-white rounded-full py-6 text-base font-medium"
                >
                  Explore Premium
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-white/45">
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
      <section className="py-32 px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">What You Can Build</h2>
            <p className="text-xl text-white/50">
              Real workflows you can create today
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10">
                &quot;Send a personalized welcome email to new contacts from my Marketing list&quot;
              </code>
              <p className="text-white/40">
                Automated email campaigns for your contact groups
              </p>
            </div>

            <div className="p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10">
                &quot;Send a daily summary email to the team and post a notification to our Slack channel&quot;
              </code>
              <p className="text-white/40">
                Keep your team informed across multiple channels
              </p>
            </div>

            <div className="p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10">
                &quot;If the first email fails, wait 5 minutes and retry, then alert me on Slack&quot;
              </code>
              <p className="text-white/40">
                Smart error handling with conditional logic
              </p>
            </div>

            <div className="p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10">
                &quot;Send a follow-up email 3 days after initial contact to all leads in Sales group&quot;
              </code>
              <p className="text-white/40">
                Timed follow-ups that nurture leads automatically
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 relative z-10">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Ready to stop worrying about recurring tasks?
          </h2>
          <p className="text-xl text-white/50 mb-10 max-w-2xl mx-auto">
            Set it up once, and we'll make sure it happens every time
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="text-base btn-gradient text-black px-8 py-6 w-full sm:w-auto rounded-full">
                Create your first execution <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#how-it-works" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="text-base border-white/20 text-white hover:bg-white/5 hover:text-white px-8 py-6 w-full sm:w-auto rounded-full">
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
