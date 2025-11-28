'use client';

import { useAgentActivity } from '@/lib/hooks/useAgentActivity';
import { AgentActivityLog } from '@/lib/types/agents';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Mail,
  User,
  Sparkles,
  RefreshCw,
  Filter,
  ChevronDown
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
// Simple date formatting utility
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

interface AgentActivityFeedProps {
  agentId: string;
  autoRefresh?: boolean;
}

// Human-readable action type labels and icons
const ACTION_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  task_started: { label: 'Task Started', icon: Clock, color: 'text-blue-600' },
  task_completed: { label: 'Task Completed', icon: CheckCircle2, color: 'text-green-600' },
  task_failed: { label: 'Task Failed', icon: XCircle, color: 'text-red-600' },
  task_error: { label: 'Task Error', icon: XCircle, color: 'text-red-600' },
  draft_created: { label: 'Draft Created', icon: FileText, color: 'text-blue-600' },
  draft_approved: { label: 'Draft Approved', icon: CheckCircle2, color: 'text-green-600' },
  draft_rejected: { label: 'Draft Rejected', icon: XCircle, color: 'text-red-600' },
  message_sent: { label: 'Message Sent', icon: Mail, color: 'text-green-600' },
  contact_researched: { label: 'Contact Researched', icon: User, color: 'text-blue-600' },
  opportunity_analyzed: { label: 'Opportunity Analyzed', icon: Sparkles, color: 'text-purple-600' },
  followup_scheduled: { label: 'Follow-up Scheduled', icon: Clock, color: 'text-amber-600' }
};

function formatActionDescription(activity: AgentActivityLog): string {
  const config = ACTION_CONFIG[activity.action_type];
  const baseDescription = config?.label || activity.action_type.replace(/_/g, ' ');

  // Enhance description with metadata if available
  if (activity.metadata) {
    const metadata = activity.metadata;
    
    if (metadata.contactName) {
      return `${baseDescription} for ${metadata.contactName}`;
    }
    
    if (metadata.draftId) {
      return `${baseDescription} (Draft #${metadata.draftId.slice(0, 8)})`;
    }
    
    if (metadata.taskType) {
      return `${baseDescription}: ${metadata.taskType.replace(/_/g, ' ')}`;
    }
    
    if (metadata.channel) {
      return `${baseDescription} via ${metadata.channel}`;
    }
  }

  return baseDescription;
}

function ActivityItem({ activity }: { activity: AgentActivityLog }) {
  const config = ACTION_CONFIG[activity.action_type] || {
    label: activity.action_type.replace(/_/g, ' '),
    icon: Clock,
    color: 'text-slate-600'
  };
  const Icon = config.icon;
  const timeAgo = formatTimeAgo(new Date(activity.created_at));

  return (
    <div className="flex items-start gap-4 border-b border-slate-100 py-4 last:border-b-0">
      <div className={`rounded-full bg-slate-100 p-2 ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">
              {formatActionDescription(activity)}
            </p>
            {activity.description && activity.description !== formatActionDescription(activity) && (
              <p className="mt-1 text-sm text-slate-600">{activity.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>{timeAgo}</span>
              {activity.task_id && (
                <Link
                  href={`/agents/tasks/${activity.task_id}`}
                  className="text-blue-600 hover:text-blue-700 hover:underline"
                >
                  View Task
                </Link>
              )}
              {activity.metadata?.draftId && (
                <Link
                  href="/agents/approvals"
                  className="text-blue-600 hover:text-blue-700 hover:underline"
                >
                  View Draft
                </Link>
              )}
            </div>
          </div>
        </div>
        
        {/* Metadata details */}
        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
              Show details
            </summary>
            <div className="mt-2 rounded-lg bg-slate-50 p-3">
              <pre className="text-xs text-slate-700 overflow-auto">
                {JSON.stringify(activity.metadata, null, 2)}
              </pre>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export function AgentActivityFeed({ agentId, autoRefresh = false }: AgentActivityFeedProps) {
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  
  const {
    activities,
    loading,
    error,
    total,
    refresh,
    loadMore,
    hasMore
  } = useAgentActivity({
    agentId,
    enabled: !!agentId,
    actionType: actionTypeFilter || undefined,
    autoRefresh,
    refreshInterval: 10000
  });

  const uniqueActionTypes = Array.from(
    new Set(activities.map(a => a.action_type))
  ).sort();

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Activity Feed</h3>
          <p className="text-sm text-slate-600">
            {total} {total === 1 ? 'activity' : 'activities'} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Filter className="h-4 w-4" />
            Filter
            {actionTypeFilter && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                1
              </span>
            )}
          </button>
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter dropdown */}
      {showFilters && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <label className="mb-2 block text-sm font-medium text-slate-900">
            Filter by Action Type
          </label>
          <select
            value={actionTypeFilter}
            onChange={(e) => setActionTypeFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Actions</option>
            {uniqueActionTypes.map((type) => {
              const config = ACTION_CONFIG[type];
              return (
                <option key={type} value={type}>
                  {config?.label || type.replace(/_/g, ' ')}
                </option>
              );
            })}
          </select>
          {actionTypeFilter && (
            <button
              onClick={() => setActionTypeFilter('')}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && activities.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Empty State */}
      {!loading && activities.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No activity yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            {actionTypeFilter
              ? 'No activities match the selected filter.'
              : 'This agent hasn\'t performed any actions yet. Assign a task to get started!'}
          </p>
        </div>
      )}

      {/* Activity List */}
      {activities.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100 p-4">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="border-t border-slate-200 p-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Load More
                    <ChevronDown className="h-4 w-4" />
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Auto-refresh indicator */}
      {autoRefresh && activities.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          Auto-refreshing every 10 seconds
        </div>
      )}
    </div>
  );
}

