'use client';

import { FollowupAgentConfig } from '@/lib/types/agents';
import { Info } from 'lucide-react';

interface FollowupConfigFormProps {
  config: FollowupAgentConfig;
  onChange: (config: FollowupAgentConfig) => void;
}

export function FollowupConfigForm({ config, onChange }: FollowupConfigFormProps) {
  const updateConfig = (updates: Partial<FollowupAgentConfig>) => {
    onChange({ ...config, ...updates });
  };

  const followupTypeOptions: Array<{ value: 'reminder' | 'value_add' | 'escalation' | 'check_in'; label: string }> = [
    { value: 'reminder', label: 'Reminder' },
    { value: 'value_add', label: 'Value Add' },
    { value: 'escalation', label: 'Escalation' },
    { value: 'check_in', label: 'Check In' }
  ];

  const toggleFollowupType = (type: 'reminder' | 'value_add' | 'escalation' | 'check_in') => {
    const currentTypes = config.followupTypes || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    updateConfig({ followupTypes: newTypes });
  };

  return (
    <div className="space-y-6">
      {/* Default Follow-up Delay */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="defaultFollowupDelayDays" className="block text-sm font-medium text-slate-900">
          Default Follow-up Delay (Days)
        </label>
        <p className="mt-1 mb-3 text-xs text-slate-500">
          Number of days to wait before sending a follow-up message
        </p>
        <input
          id="defaultFollowupDelayDays"
          type="number"
          min="1"
          max="30"
          value={config.defaultFollowupDelayDays || 3}
          onChange={(e) => updateConfig({ defaultFollowupDelayDays: parseInt(e.target.value) || 3 })}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Max Follow-ups */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="maxFollowups" className="block text-sm font-medium text-slate-900">
          Maximum Follow-ups
        </label>
        <p className="mt-1 mb-3 text-xs text-slate-500">
          Maximum number of follow-up attempts before stopping
        </p>
        <input
          id="maxFollowups"
          type="number"
          min="1"
          max="10"
          value={config.maxFollowups || 3}
          onChange={(e) => updateConfig({ maxFollowups: parseInt(e.target.value) || 3 })}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Escalation After Attempts */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="escalationAfterAttempts" className="block text-sm font-medium text-slate-900">
          Escalation After Attempts
        </label>
        <p className="mt-1 mb-3 text-xs text-slate-500">
          Number of failed follow-up attempts before escalating to a different approach
        </p>
        <input
          id="escalationAfterAttempts"
          type="number"
          min="1"
          max="10"
          value={config.escalationAfterAttempts || 2}
          onChange={(e) => updateConfig({ escalationAfterAttempts: parseInt(e.target.value) || 2 })}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Follow-up Types */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="block text-sm font-medium text-slate-900">
          Follow-up Types
        </label>
        <p className="mt-1 mb-3 text-xs text-slate-500">
          Types of follow-up messages the agent can send
        </p>
        <div className="space-y-2">
          {followupTypeOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={(config.followupTypes || []).includes(option.value)}
                onChange={() => toggleFollowupType(option.value)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-900">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

