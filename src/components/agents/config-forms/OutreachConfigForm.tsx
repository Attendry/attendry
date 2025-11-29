'use client';

import { OutreachAgentConfig } from '@/lib/types/agents';
import { Info } from 'lucide-react';

interface OutreachConfigFormProps {
  config: OutreachAgentConfig;
  onChange: (config: OutreachAgentConfig) => void;
}

export function OutreachConfigForm({ config, onChange }: OutreachConfigFormProps) {
  const updateConfig = (updates: Partial<OutreachAgentConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-6">
      {/* Auto-Approve */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
              Auto-Approve Drafts
              <div className="group relative">
                <Info className="h-4 w-4 text-slate-400" />
                <div className="absolute bottom-full left-1/2 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white group-hover:block">
                  When enabled, drafts will be automatically approved and sent without manual review
                </div>
              </div>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Automatically approve and send outreach drafts without manual review
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={config.autoApprove || false}
              onChange={(e) => updateConfig({ autoApprove: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300"></div>
          </label>
        </div>
      </div>

      {/* Daily Limit */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="maxDailyOutreach" className="block text-sm font-medium text-slate-900">
          Maximum Daily Outreach
        </label>
        <p className="mt-1 mb-3 text-xs text-slate-500">
          Maximum number of outreach messages the agent can send per day
        </p>
        <input
          id="maxDailyOutreach"
          type="number"
          min="1"
          max="100"
          value={config.maxDailyOutreach || 10}
          onChange={(e) => updateConfig({ maxDailyOutreach: parseInt(e.target.value) || 10 })}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Message Tone */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="messageTone" className="block text-sm font-medium text-slate-900">
          Message Tone
        </label>
        <p className="mt-1 mb-3 text-xs text-slate-500">
          The tone and style used in outreach messages
        </p>
        <select
          id="messageTone"
          value={config.messageTone || 'professional'}
          onChange={(e) => updateConfig({ messageTone: e.target.value as 'professional' | 'friendly' | 'casual' })}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="professional">Professional</option>
          <option value="friendly">Friendly</option>
          <option value="casual">Casual</option>
        </select>
      </div>

      {/* Include Event Context */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
              Include Event Context
              <div className="group relative">
                <Info className="h-4 w-4 text-slate-400" />
                <div className="absolute bottom-full left-1/2 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white group-hover:block">
                  Include event details, dates, and speaker information in outreach messages
                </div>
              </div>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Include event details and context in outreach messages
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={config.includeEventContext !== false}
              onChange={(e) => updateConfig({ includeEventContext: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300"></div>
          </label>
        </div>
      </div>

      {/* Include Account Intelligence */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
              Include Account Intelligence
              <div className="group relative">
                <Info className="h-4 w-4 text-slate-400" />
                <div className="absolute bottom-full left-1/2 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white group-hover:block">
                  Include account research, company information, and relevant insights in messages
                </div>
              </div>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Include account research and company intelligence in outreach
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={config.includeAccountIntelligence !== false}
              onChange={(e) => updateConfig({ includeAccountIntelligence: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300"></div>
          </label>
        </div>
      </div>

      {/* Notify Follow-up Agent */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
              Notify Follow-up Agent
              <div className="group relative">
                <Info className="h-4 w-4 text-slate-400" />
                <div className="absolute bottom-full left-1/2 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white group-hover:block">
                  Automatically notify the follow-up agent when outreach is sent
                </div>
              </div>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Automatically notify follow-up agent when messages are sent
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={config.notifyFollowupAgent !== false}
              onChange={(e) => updateConfig({ notifyFollowupAgent: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300"></div>
          </label>
        </div>
      </div>

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
    </div>
  );
}

