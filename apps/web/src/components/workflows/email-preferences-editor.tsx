"use client";

import { Mail, FileText, Sparkles } from "lucide-react";

interface EmailPreferences {
  tone?: 'formal' | 'casual' | 'friendly' | 'urgent';
  structure?: 'detailed' | 'brief' | 'minimal';
  customInstructions?: string;
}

interface EmailPreferencesEditorProps {
  value: EmailPreferences;
  onChange: (value: EmailPreferences) => void;
}

const TONE_OPTIONS = [
  {
    value: 'formal' as const,
    label: 'Formal',
    description: 'Professional and respectful',
    icon: '👔',
  },
  {
    value: 'casual' as const,
    label: 'Casual',
    description: 'Relaxed and friendly',
    icon: '🌴',
  },
  {
    value: 'friendly' as const,
    label: 'Friendly',
    description: 'Warm and approachable',
    icon: '😊',
  },
  {
    value: 'urgent' as const,
    label: 'Urgent',
    description: 'Time-sensitive and direct',
    icon: '⚡',
  },
];

const STRUCTURE_OPTIONS = [
  {
    value: 'detailed' as const,
    label: 'Detailed',
    description: 'Full context with details box',
    icon: '📋',
  },
  {
    value: 'brief' as const,
    label: 'Brief',
    description: 'Concise with key info',
    icon: '📝',
  },
  {
    value: 'minimal' as const,
    label: 'Minimal',
    description: 'Just the essentials',
    icon: '✨',
  },
];

export function EmailPreferencesEditor({ value, onChange }: EmailPreferencesEditorProps) {
  const handleToneChange = (tone: EmailPreferences['tone']) => {
    onChange({ ...value, tone });
  };

  const handleStructureChange = (structure: EmailPreferences['structure']) => {
    onChange({ ...value, structure });
  };

  const handleCustomInstructionsChange = (customInstructions: string) => {
    onChange({ ...value, customInstructions });
  };

  return (
    <div className="space-y-6">
      {/* Tone Selection */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-3">
          <Mail className="inline h-4 w-4 mr-2" />
          Email Tone
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TONE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleToneChange(option.value)}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                value.tone === option.value
                  ? 'bg-blue-500/20 border-blue-500 text-white'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <div className="text-2xl mb-1">{option.icon}</div>
              <div className="font-semibold text-sm mb-0.5">{option.label}</div>
              <div className="text-xs opacity-70">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Structure Selection */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-3">
          <FileText className="inline h-4 w-4 mr-2" />
          Email Structure
        </label>
        <div className="grid grid-cols-3 gap-3">
          {STRUCTURE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleStructureChange(option.value)}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                value.structure === option.value
                  ? 'bg-blue-500/20 border-blue-500 text-white'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <div className="text-2xl mb-1">{option.icon}</div>
              <div className="font-semibold text-sm mb-0.5">{option.label}</div>
              <div className="text-xs opacity-70">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Instructions */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-3">
          <Sparkles className="inline h-4 w-4 mr-2" />
          Custom Instructions (optional)
        </label>
        <textarea
          placeholder="E.g., Include project name in subject, use friendly language, mention specific deadline..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none"
          rows={3}
          value={value.customInstructions || ''}
          onChange={(e) => handleCustomInstructionsChange(e.target.value)}
        />
        <p className="text-xs text-white/40 mt-2">
          Add any specific requirements for how the email should be written
        </p>
      </div>
    </div>
  );
}
