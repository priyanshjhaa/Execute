"use client";

import React from 'react';

interface ScheduleData {
  frequency: 'daily' | 'weekly' | 'monthly';
  day?: string;
  time: string;
  timezone?: string;
}

interface SchedulePickerProps {
  value: ScheduleData;
  onChange: (value: ScheduleData) => void;
}

export function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const daysOfMonth = Array.from({ length: 28 }, (_, index) => String(index + 1));

  return (
    <div className="space-y-4">
      {/* Frequency Selector */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">
          Repeat
        </label>
        <div className="flex gap-3">
          {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
            <button
              key={freq}
              type="button"
              onClick={() => onChange({ ...value, frequency: freq })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                value.frequency === freq
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              Every {freq}
            </button>
          ))}
        </div>
      </div>

      {/* Day Selector (only for weekly) */}
      {value.frequency === 'weekly' && (
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            On
          </label>
          <div className="flex flex-wrap gap-2">
            {daysOfWeek.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => onChange({ ...value, day })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  value.day === day
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day of month selector */}
      {value.frequency === 'monthly' && (
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            On day
          </label>
          <select
            value={value.day || '1'}
            onChange={(e) => onChange({ ...value, day: e.target.value })}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20 transition-colors"
          >
            {daysOfMonth.map((day) => (
              <option key={day} value={day} className="bg-black">
                {day}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Time Picker */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">
          At
        </label>
        <input
          type="time"
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20 transition-colors"
        />
        <p className="mt-2 text-xs text-white/40">
          Timezone: {value.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
        </p>
      </div>
    </div>
  );
}
