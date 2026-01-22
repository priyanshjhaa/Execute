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
  BarChart3,
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
      <section className="min-h-screen pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white text-sm font-medium mb-8">
            <Sparkles className="h-4 w-4" />
            <span>Turn English into Action</span>
          </div>

          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6 tracking-tight leading-[1.1]">
            Execute Your Ideas
            <br />
            <span className="text-white/60">In Plain English</span>
          </h1>

          <p className="text-xl md:text-2xl text-white/50 mb-10 max-w-3xl leading-relaxed">
            Describe what you want to do in plain English, and watch as Execute
            breaks it down into steps and runs them automatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-start items-start">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="text-base btn-gradient text-black px-8 py-6 w-full sm:w-auto rounded-full">
                Start Building Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#how-it-works" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="text-base border-white/20 text-white hover:bg-white/5 hover:text-white px-8 py-6 w-full sm:w-auto rounded-full">
                See How It Works
              </Button>
            </Link>
          </div>

          <div className="mt-16 flex flex-wrap gap-8 text-sm text-white/40">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white/60" />
              <span>No coding required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white/60" />
              <span>AI-powered automation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white/60" />
              <span>Real-time execution</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 px-6 border-t border-white/10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">How It Works</h2>
            <p className="text-xl text-white/50">
              Three simple steps to automate your workflows
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Terminal className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 1</div>
              <h3 className="text-2xl font-bold text-white">Write Instruction</h3>
              <p className="text-white/40 leading-relaxed">
                Describe what you want to do in plain English. Like
                &quot;Create a user in database and send welcome email&quot;
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 2</div>
              <h3 className="text-2xl font-bold text-white">AI Converts</h3>
              <p className="text-white/40 leading-relaxed">
                Our AI breaks down your instruction into structured, executable
                steps. You can review and edit them before running.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Zap className="h-7 w-7 text-white" />
              </div>
              <div className="text-sm font-medium text-white/50 mb-2">STEP 3</div>
              <h3 className="text-2xl font-bold text-white">See Results</h3>
              <p className="text-white/40 leading-relaxed">
                Watch your steps execute in real-time with detailed logs and
                progress updates. Know exactly what happened.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 px-6 border-t border-white/10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">Powerful Features</h2>
            <p className="text-xl text-white/50">
              Everything you need to automate your workflows
            </p>
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
                <Zap className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Lightning Fast</h3>
                <p className="text-white/40 leading-relaxed">
                  Execute your tasks in seconds with our optimized infrastructure
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
                <Shield className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Safe & Secure</h3>
                <p className="text-white/40 leading-relaxed">
                  Sandboxed execution environment with rollback capabilities
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
                <h3 className="text-xl font-semibold text-white mb-3">Real-time Logs</h3>
                <p className="text-white/40 leading-relaxed">
                  Watch your execution live with detailed step-by-step logs
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
                <h3 className="text-xl font-semibold text-white mb-3">Step Branching</h3>
                <p className="text-white/40 leading-relaxed">
                  Create complex workflows with conditional logic and dependencies
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
                <BarChart3 className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Analytics</h3>
                <p className="text-white/40 leading-relaxed">
                  Track your execution history, success rates, and performance
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
                <CheckCircle2 className="h-8 w-8 text-white mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Error Handling</h3>
                <p className="text-white/40 leading-relaxed">
                  Automatic retries and rollbacks ensure reliable execution
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Example Use Cases */}
      <section className="py-32 px-6 border-t border-white/10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">What You Can Build</h2>
            <p className="text-xl text-white/50">
              Limitless possibilities with natural language automation
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10">
                &quot;Create a new user account, send verification email, and add them to our CRM&quot;
              </code>
              <p className="text-white/40">
                User onboarding workflows made simple
              </p>
            </div>

            <div className="p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10">
                &quot;Query all inactive users, export to CSV, and email the report to admin&quot;
              </code>
              <p className="text-white/40">
                Automated reporting and data exports
              </p>
            </div>

            <div className="p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10">
                &quot;Monitor API health, check response times, and alert on failures&quot;
              </code>
              <p className="text-white/40">
                Infrastructure monitoring and alerts
              </p>
            </div>

            <div className="p-8 rounded-xl border border-white/10 bg-white/[0.02]">
              <code className="text-sm bg-white/5 px-4 py-3 rounded-lg block mb-6 text-white/80 border border-white/10">
                &quot;Sync new orders from Stripe to database, update inventory, and notify shipping team&quot;
              </code>
              <p className="text-white/40">
                E-commerce automation
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 border-t border-white/10">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Ready to Automate Your Workflows?
          </h2>
          <p className="text-xl text-white/50 mb-10 max-w-2xl mx-auto">
            Join thousands of developers and businesses automating with Execute
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="text-base btn-gradient text-black px-8 py-6 w-full sm:w-auto rounded-full">
                Get Started for Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/demo" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="text-base border-white/20 text-white hover:bg-white/5 hover:text-white px-8 py-6 w-full sm:w-auto rounded-full">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="container mx-auto text-center text-sm text-white/40">
          <p>&copy; 2025 Execute. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
