"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Terminal,
  Mail,
  Lock,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement login logic
    console.log("Login:", formData);
  };

  return (
    <main className="min-h-screen bg-black">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-transparent z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-white" />
              <span className="text-lg font-semibold text-white">Execute</span>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/signup">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5 rounded-full">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Login Section */}
      <section className="min-h-screen pt-32 pb-20 px-6 flex items-center justify-center">
        <div className="container mx-auto max-w-md">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Welcome Back
            </h1>
            <p className="text-lg text-white/50">
              Sign in to continue automating your workflows
            </p>
          </div>

          {/* Form */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Link href="/forgot-password" className="text-sm text-white/40 hover:text-white transition-colors">
                    Forgot password?
                  </Link>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full text-base btn-gradient text-black px-8 py-6 rounded-full"
              >
                Sign In <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-transparent text-white/40">Don't have an account?</span>
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="text-center">
              <Link href="/signup">
                <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/5 hover:text-white px-8 py-6 rounded-full">
                  Create Free Account
                </Button>
              </Link>
            </div>
          </div>

          {/* Back to Home */}
          <div className="mt-8 text-center">
            <Link href="/" className="text-sm text-white/40 hover:text-white transition-colors">
              ← Back to home
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
