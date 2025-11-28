'use client';

import { useState } from 'react';
import { useAgents } from '@/lib/hooks/useAgents';
import { useOutreachDrafts } from '@/lib/hooks/useOutreachDrafts';
import { AIAgent, AgentType, AgentStatus } from '@/lib/types/agents';
import { 
  Loader2, 
  AlertCircle, 
  Bot, 
  CheckCircle2, 
  Clock, 
  PauseCircle,
  XCircle,
  Sparkles,
  Play,
  Settings,
  Trash2,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AssignTaskModal } from './AssignTaskModal';

interface AgentStatusCardProps {
  agent: AIAgent | null;
  agentType: AgentType;
  loading: boolean;
}

function AgentStatusCard({ agent, agentType, loading }: AgentStatusCardProps) {
  const { updateAgent, deleteAgent, refresh } = useAgents();
  const [processing, setProcessing] = useState(false);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);

  const handleStatusChange = async (newStatus: AgentStatus) => {
    if (!agent || processing) return;
    
    setProcessing(true);
    try {
      await updateAgent(agent.id, { status: newStatus });
      toast.success(`Agent ${newStatus === 'active' ? 'activated' : 'paused'} successfully`);
      await refresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update agent');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!agent || processing) return;
    
    if (!confirm(`Are you sure you want to delete "${agent.name}"?`)) {
      return;
    }

    setProcessing(true);
    try {
      await deleteAgent(agent.id);
      toast.success('Agent deleted successfully');
      await refresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete agent');
    } finally {
      setProcessing(false);
    }
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'idle':
        return <Clock className="h-4 w-4 text-slate-400" />;
      case 'paused':
        return <PauseCircle className="h-4 w-4 text-amber-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'border-green-200 bg-green-50';
      case 'idle':
        return 'border-slate-200 bg-slate-50';
      case 'paused':
        return 'border-amber-200 bg-amber-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-slate-200 bg-slate-50';
    }
  };

  const agentTypeLabels: Record<AgentType, string> = {
    outreach: 'Outreach Agent',
    followup: 'Follow-up Agent',
    planning: 'Planning Agent',
    research: 'Research Agent'
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600">{agentTypeLabels[agentType]}</p>
            <p className="text-xs text-slate-500">Not created</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition ${getStatusColor(agent.status)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon(agent.status)}
          <div>
            <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
            <p className="text-xs text-slate-600">{agentTypeLabels[agentType]}</p>
          </div>
        </div>
        <Link
          href={`/agents/${agent.id}`}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          View →
        </Link>
      </div>
      
      {/* Quick Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
        <button
          onClick={() => setShowAssignTaskModal(true)}
          disabled={processing || agent.status === 'paused' || agent.status === 'error'}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          title="Assign task to agent"
        >
          <Plus className="h-3 w-3" />
          Assign Task
        </button>

        {agent.status === 'idle' || agent.status === 'paused' ? (
          <button
            onClick={() => handleStatusChange('active')}
            disabled={processing}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
            title="Activate agent"
          >
            <Play className="h-3 w-3" />
            Activate
          </button>
        ) : agent.status === 'active' ? (
          <button
            onClick={() => handleStatusChange('paused')}
            disabled={processing}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            title="Pause agent"
          >
            <PauseCircle className="h-3 w-3" />
            Pause
          </button>
        ) : null}
        
        <Link
          href={`/agents/${agent.id}`}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          title="View agent details"
        >
          <Settings className="h-3 w-3" />
          View
        </Link>
        
        <button
          onClick={handleDelete}
          disabled={processing}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          title="Delete agent"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>

      {/* Assign Task Modal */}
      {agent && (
        <AssignTaskModal
          agent={agent}
          isOpen={showAssignTaskModal}
          onClose={() => setShowAssignTaskModal(false)}
          onSuccess={() => {
            refresh();
            toast.success('Task assigned! The agent will process it shortly.');
          }}
        />
      )}
    </div>
  );
}

export function AgentDashboardPanel() {
  const { agents, loading: agentsLoading, error: agentsError } = useAgents();
  const { drafts, loading: draftsLoading } = useOutreachDrafts({ status: 'pending_approval' });

  // Ensure agents is always an array
  const agentsArray = Array.isArray(agents) ? agents : [];
  const draftsArray = Array.isArray(drafts) ? drafts : [];

  const outreachAgent = agentsArray.find(a => a?.agent_type === 'outreach');
  const followupAgent = agentsArray.find(a => a?.agent_type === 'followup');
  const planningAgent = agentsArray.find(a => a?.agent_type === 'planning');

  const pendingCount = draftsArray.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">AI Agents</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage your AI agent team for automated outreach and follow-up
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Link
              href="/agents/approvals"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Sparkles className="h-4 w-4" />
              {pendingCount} Pending Approval{pendingCount !== 1 ? 's' : ''}
            </Link>
          )}
          <Link
            href="/agents/create"
            className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            <Sparkles className="h-4 w-4" />
            Create Agent
          </Link>
        </div>
      </div>

      {agentsError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{typeof agentsError === 'string' ? agentsError : 'An error occurred'}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AgentStatusCard 
          agent={outreachAgent || null} 
          agentType="outreach" 
          loading={agentsLoading}
        />
        <AgentStatusCard 
          agent={followupAgent || null} 
          agentType="followup" 
          loading={agentsLoading}
        />
        <AgentStatusCard 
          agent={planningAgent || null} 
          agentType="planning" 
          loading={agentsLoading}
        />
      </div>

      {agentsArray.length === 0 && !agentsLoading && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Bot className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No agents created</h3>
          <p className="mt-2 text-sm text-slate-600">
            Create your first AI agent to start automating outreach and follow-up tasks.
          </p>
          <Link
            href="/agents/create"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Sparkles className="h-4 w-4" />
            Create Agent
          </Link>
        </div>
      )}
    </div>
  );
}


