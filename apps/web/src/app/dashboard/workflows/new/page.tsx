"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NewWorkflowPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white/60 hover:text-white mb-4 rounded-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Create New Workflow</h1>
          <p className="text-white/50">Describe what you want to automate in plain English</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-4">Instruction Input</h2>
          <p className="text-white/60 mb-6">
            This page will have a text input where you can describe your workflow in plain English.
            The AI will then convert it into executable steps.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <p className="text-white/40 italic">
              Example: "Create a new user in database, send welcome email, and add them to our CRM"
            </p>
          </div>
          <div className="mt-6">
            <Button
              size="lg"
              className="text-base btn-gradient px-6 py-5 rounded-full"
              disabled
            >
              Coming Soon
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
