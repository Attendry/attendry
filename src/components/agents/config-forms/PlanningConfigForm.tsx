'use client';

import { PlanningAgentConfig } from '@/lib/types/agents';
import { Info } from 'lucide-react';

interface PlanningConfigFormProps {
  config: PlanningAgentConfig;
  onChange: (config: PlanningAgentConfig) => void;
}

export function PlanningConfigForm({ config, onChange }: PlanningConfigFormProps) {
  const updateConfig = (updates: Partial<PlanningAgentConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-6">
      {/* Minimum Relevance Score */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="minRelevanceScore" className="block text-sm font-medium text-slate-900">
          Minimum Relevance Score
        </label>
        <p className="mt-1 mb-3 text-xs text-slate-500">
          Minimum relevance score (0-100) required for an opportunity to be considered
        </p>
        <input
          id="minRelevanceScore"
          type="number"
          min="0"
          max="100"
          value={config.minRelevanceScore || 50}
          onChange={(e) => updateConfig({ minRelevanceScore: parseInt(e.target.value) || 50 })}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <div className="h-2 flex-1 rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{ width: `${config.minRelevanceScore || 50}%` }}
            />
          </div>
          <span>{config.minRelevanceScore || 50}%</span>
        </div>
      </div>

      {/* Max Opportunities Per Day */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="maxOpportunitiesPerDay" className="block text-sm font-medium text-slate-900">
          Maximum Opportunities Per Day
        </label>
        <p className="mt-1 mb-3 text-xs text-slate-500">
          Maximum number of opportunities the agent can identify per day
        </p>
        <input
          id="maxOpportunitiesPerDay"
          type="number"
          min="1"
          max="100"
          value={config.maxOpportunitiesPerDay || 20}
          onChange={(e) => updateConfig({ maxOpportunitiesPerDay: parseInt(e.target.value) || 20 })}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Prioritize By Signal Strength */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
              Prioritize By Signal Strength
              <div className="group relative">
                <Info className="h-4 w-4 text-slate-400" />
                <div className="absolute bottom-full left-1/2 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white group-hover:block">
                  Prioritize opportunities based on signal strength and engagement indicators
                </div>
              </div>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Prioritize opportunities based on signal strength
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={config.prioritizeBySignalStrength !== false}
              onChange={(e) => updateConfig({ prioritizeBySignalStrength: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300"></div>
          </label>
        </div>
      </div>

      {/* Coordinate With Outreach */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
              Coordinate With Outreach Agent
              <div className="group relative">
                <Info className="h-4 w-4 text-slate-400" />
                <div className="absolute bottom-full left-1/2 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white group-hover:block">
                  Automatically coordinate identified opportunities with the outreach agent
                </div>
              </div>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Automatically coordinate with outreach agent for identified opportunities
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={config.coordinateWithOutreach !== false}
              onChange={(e) => updateConfig({ coordinateWithOutreach: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300"></div>
          </label>
        </div>
      </div>
    </div>
  );
}

