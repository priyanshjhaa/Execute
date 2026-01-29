"use client";

import React from 'react';

interface EventTriggerSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const commonEvents = [
  { value: 'user_created', label: 'When user signs up' },
  { value: 'form_submitted', label: 'When user fills form' },
  { value: 'webhook_received', label: 'When webhook is called' },
  { value: 'email_received', label: 'When email is received' },
  { value: 'purchase_completed', label: 'When purchase is made' },
];

export function EventTriggerSelector({ value, onChange }: EventTriggerSelectorProps) {
  const [customEvent, setCustomEvent] = React.useState(value && !commonEvents.find(e => e.value === value) ? value : '');

  const handleChange = (newValue: string) => {
    if (newValue === 'custom') {
      setCustomEvent('');
    } else {
      setCustomEvent('');
      onChange(newValue);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomEvent(val);
    onChange(val);
  };

  const selectedCommon = commonEvents.find(e => e.value === value);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-white/80 mb-2">
        When should this happen?
      </label>
      <div className="space-y-2">
        {commonEvents.map((event) => (
          <button
            key={event.value}
            type="button"
            onClick={() => handleChange(event.value)}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
              value === event.value
                ? 'bg-blue-500/20 border-2 border-blue-500 text-white'
                : 'bg-white/5 border-2 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <div className="font-medium">{event.label}</div>
          </button>
        ))}

        {/* Custom Event Input */}
        <div className={`p-4 rounded-xl border-2 transition-all ${
          !selectedCommon && value
            ? 'bg-blue-500/20 border-blue-500'
            : 'bg-white/5 border-white/10'
        }`}>
          <input
            type="text"
            value={customEvent}
            onChange={handleCustomChange}
            onClick={() => handleChange('custom')}
            placeholder="Or type a custom event..."
            className="w-full bg-transparent text-white placeholder:text-white/40 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
