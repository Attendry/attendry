'use client';

import { useState, useEffect } from 'react';
import { AIAgent, AgentType, OutreachAgentConfig, FollowupAgentConfig, PlanningAgentConfig } from '@/lib/types/agents';
import { X, Loader2, AlertCircle, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { OutreachConfigForm } from './config-forms/OutreachConfigForm';
import { FollowupConfigForm } from './config-forms/FollowupConfigForm';
import { PlanningConfigForm } from './config-forms/PlanningConfigForm';

interface AgentConfigEditorProps {
  agent: AIAgent;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AgentConfigEditor({ agent, isOpen, onClose, onSuccess }: AgentConfigEditorProps) {
  const [config, setConfig] = useState<any>(agent.config || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset config when agent changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setConfig(agent.config || {});
      setError(null);
    }
  }, [isOpen, agent.config]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update configuration');
      }

      toast.success('Configuration updated successfully');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save configuration';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setConfig(agent.config || {});
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const renderConfigForm = () => {
    switch (agent.agent_type) {
      case 'outreach':
        return (
          <OutreachConfigForm
            config={config as OutreachAgentConfig}
            onChange={setConfig}
          />
        );
      case 'followup':
        return (
          <FollowupConfigForm
            config={config as FollowupAgentConfig}
            onChange={setConfig}
          />
        );
      case 'planning':
        return (
          <PlanningConfigForm
            config={config as PlanningAgentConfig}
            onChange={setConfig}
          />
        );
      case 'research':
        return (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
            <Info className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">
              Research agent configuration coming soon
            </p>
          </div>
        );
      default:
        return (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">
              Unknown agent type: {agent.agent_type}
            </p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Configure {agent.name}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Customize your {agent.agent_type} agent's behavior and settings
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {renderConfigForm()}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

