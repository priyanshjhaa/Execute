"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Terminal,
  Mail,
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    try {
      await signUp(formData.email, formData.password, formData.name);
      // Redirect is handled by signUp function
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.')
      setLoading(false)
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google.')
      setGoogleLoading(false);
    }
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
            <Link href="/login">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5 rounded-full">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Signup Section */}
      <section className="min-h-screen pt-32 pb-20 px-6 flex items-center justify-center">
        <div className="container mx-auto max-w-md">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Create Your Account
            </h1>
            <p className="text-lg text-white/50">
              Start automating your workflows in minutes
            </p>
          </div>

          {/* Form */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8">
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Input */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white/80 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
                    placeholder="John Doe"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

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
                    disabled={loading}
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
                    minLength={8}
                    disabled={loading}
                  />
                </div>
                <p className="mt-2 text-sm text-white/40">
                  Must be at least 8 characters
                </p>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-white/40">Or continue with</span>
                </div>
              </div>

              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-white/5 border border-white/10 rounded-full text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign up with Google
                  </>
                )}
              </button>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                disabled={loading || googleLoading}
                className="w-full text-base btn-gradient text-black px-8 py-6 rounded-full"
              >
                {loading ? 'Creating account...' : 'Create Account'} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              {/* Terms */}
              <p className="text-xs text-white/40 text-center">
                By signing up, you agree to our{" "}
                <Link href="/terms" className="text-white/60 hover:text-white transition-colors">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-white/60 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </p>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-transparent text-white/40">Already have an account?</span>
              </div>
            </div>

            {/* Sign In Link */}
            <div className="text-center">
              <Link href="/login">
                <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/5 hover:text-white px-8 py-6 rounded-full">
                  Sign In Instead
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

          {/* Features */}
          <div className="mt-12 grid grid-cols-3 gap-4">
            <div className="text-center">
              <CheckCircle2 className="h-5 w-5 text-white/60 mx-auto mb-2" />
              <p className="text-xs text-white/40">Free to start</p>
            </div>
            <div className="text-center">
              <CheckCircle2 className="h-5 w-5 text-white/60 mx-auto mb-2" />
              <p className="text-xs text-white/40">No credit card</p>
            </div>
            <div className="text-center">
              <CheckCircle2 className="h-5 w-5 text-white/60 mx-auto mb-2" />
              <p className="text-xs text-white/40">Cancel anytime</p>
            </div>
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
