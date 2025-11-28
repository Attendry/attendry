'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAgents } from '@/lib/hooks/useAgents';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  Play,
  Trash2,
  Settings,
  Power,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AgentStatus } from '@/lib/types/agents';
import { AssignTaskModal } from '@/components/agents/AssignTaskModal';

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  active: { icon: CheckCircle2, color: 'text-green-600', label: 'Active' },
  idle: { icon: Clock, color: 'text-slate-400', label: 'Idle' },
  paused: { icon: PauseCircle, color: 'text-amber-600', label: 'Paused' },
  error: { icon: XCircle, color: 'text-red-600', label: 'Error' },
  waiting_approval: { icon: Clock, color: 'text-blue-600', label: 'Waiting Approval' }
};

const AGENT_TYPE_LABELS: Record<string, string> = {
  outreach: 'Outreach Agent',
  followup: 'Follow-up Agent',
  planning: 'Planning Agent',
  research: 'Research Agent'
};

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const { agents, loading, updateAgent, deleteAgent, refresh } = useAgents();
  const [authReady, setAuthReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setAuthReady(!!data.session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!cancelled) setAuthReady(!!session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const agent = agents.find(a => a.id === agentId);
  const statusConfig = agent ? STATUS_CONFIG[agent.status] || STATUS_CONFIG.idle : null;

  const handleStatusChange = async (newStatus: AgentStatus) => {
    if (!agent || processing) return;
    
    setProcessing(true);
    try {
      await updateAgent(agentId, { status: newStatus });
      toast.success(`Agent ${newStatus === 'active' ? 'activated' : newStatus === 'paused' ? 'paused' : 'updated'} successfully`);
      await refresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update agent status');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!agent || processing) return;
    
    if (!confirm(`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`)) {
      return;
    }

    setProcessing(true);
    try {
      await deleteAgent(agentId);
      toast.success('Agent deleted successfully');
      router.push('/command-centre');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete agent');
    } finally {
      setProcessing(false);
    }
  };

  if (!authReady || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-900">Agent not found</h3>
                <p className="text-sm text-red-700">The agent you're looking for doesn't exist.</p>
              </div>
            </div>
            <Link
              href="/command-centre"
              className="mt-4 inline-block text-sm text-red-700 hover:text-red-900"
            >
              ← Back to Command Centre
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig?.icon || Clock;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/command-centre"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Command Centre
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-3">
              <Bot className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-slate-900">{agent.name}</h1>
                {statusConfig && (
                  <div className={`flex items-center gap-2 ${statusConfig.color}`}>
                    <StatusIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">{statusConfig.label}</span>
                  </div>
                )}
              </div>
              <p className="mt-1 text-slate-600">
                {AGENT_TYPE_LABELS[agent.agent_type] || agent.agent_type}
              </p>
            </div>
          </div>
        </div>

        {/* Management Actions */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAssignTaskModal(true)}
            disabled={processing || agent.status === 'paused' || agent.status === 'error'}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Assign Task
          </button>

          {agent.status === 'idle' || agent.status === 'paused' ? (
            <button
              onClick={() => handleStatusChange('active')}
              disabled={processing}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Activate
            </button>
          ) : agent.status === 'active' ? (
            <button
              onClick={() => handleStatusChange('paused')}
              disabled={processing}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <PauseCircle className="h-4 w-4" />
              Pause
            </button>
          ) : null}
          
          {agent.status === 'error' && (
            <button
              onClick={() => handleStatusChange('idle')}
              disabled={processing}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Power className="h-4 w-4" />
              Reset
            </button>
          )}

          <button
            onClick={() => {
              // TODO: Open configuration modal/page
              toast.info('Configuration editing coming soon');
            }}
            disabled={processing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Settings className="h-4 w-4" />
            Configure
          </button>

          <button
            onClick={handleDelete}
            disabled={processing}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>

        {/* Agent Details */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Agent Information</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-slate-500">Type</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {AGENT_TYPE_LABELS[agent.agent_type] || agent.agent_type}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Status</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {statusConfig?.label || agent.status}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Created</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {new Date(agent.created_at).toLocaleDateString()}
                </dd>
              </div>
              {agent.last_active_at && (
                <div>
                  <dt className="text-sm font-medium text-slate-500">Last Active</dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {new Date(agent.last_active_at).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Capabilities */}
          {agent.capabilities && agent.capabilities.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Capabilities</h2>
              <div className="flex flex-wrap gap-2">
                {agent.capabilities.map((capability, index) => (
                  <span
                    key={index}
                    className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700"
                  >
                    {capability}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Configuration */}
          {agent.config && Object.keys(agent.config).length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Configuration</h2>
              <pre className="overflow-auto rounded-lg bg-slate-50 p-4 text-xs text-slate-700">
                {JSON.stringify(agent.config, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Assign Task Modal */}
        <AssignTaskModal
          agent={agent}
          isOpen={showAssignTaskModal}
          onClose={() => setShowAssignTaskModal(false)}
          onSuccess={() => {
            refresh();
            toast.success('Task assigned! Check the activity feed for updates.');
          }}
        />
      </div>
    </div>
  );
}

