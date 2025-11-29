'use client';

import { useFollowupSchedule, FollowupSchedule } from '@/lib/hooks/useFollowupSchedule';
import {
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  Calendar,
  Mail,
  User,
  RefreshCw,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';

interface FollowupSchedulePanelProps {
  agentId?: string;
  contactId?: string;
  showUpcoming?: boolean;
  limit?: number;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMs < 0) {
    return 'Overdue';
  }

  if (diffDays > 0) {
    return `In ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }

  if (diffHours > 0) {
    return `In ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  }

  if (diffMins > 0) {
    return `In ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  }

  return 'Due now';
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'scheduled':
      return <Clock className="h-4 w-4 text-blue-600" />;
    case 'executed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-slate-400" />;
    case 'skipped':
      return <XCircle className="h-4 w-4 text-amber-600" />;
    default:
      return <Clock className="h-4 w-4 text-slate-400" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'scheduled':
      return 'border-blue-200 bg-blue-50';
    case 'executed':
      return 'border-green-200 bg-green-50';
    case 'cancelled':
      return 'border-slate-200 bg-slate-50';
    case 'skipped':
      return 'border-amber-200 bg-amber-50';
    default:
      return 'border-slate-200 bg-slate-50';
  }
}

function getFollowupTypeLabel(type: string): string {
  switch (type) {
    case 'reminder':
      return 'Reminder';
    case 'value_add':
      return 'Value Add';
    case 'escalation':
      return 'Escalation';
    case 'check_in':
      return 'Check In';
    default:
      return type;
  }
}

function ScheduleItem({ schedule, onCancel }: { schedule: FollowupSchedule; onCancel: (id: string) => void }) {
  const contactName = schedule.contact?.speaker_data?.name || 
                      schedule.contact?.enhanced_data?.name || 
                      'Unknown Contact';
  const scheduledDate = new Date(schedule.scheduled_for);
  const isOverdue = scheduledDate < new Date() && schedule.status === 'scheduled';
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!confirm(`Cancel follow-up scheduled for ${scheduledDate.toLocaleDateString()}?`)) {
      return;
    }

    setCancelling(true);
    try {
      await onCancel(schedule.id);
      toast.success('Follow-up cancelled');
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel follow-up');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className={`rounded-lg border p-4 transition ${getStatusColor(schedule.status)}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {getStatusIcon(schedule.status)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-900">{contactName}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {getFollowupTypeLabel(schedule.followup_type)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {scheduledDate.toLocaleDateString()} at {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {schedule.status === 'scheduled' && (
                <span className={isOverdue ? 'font-semibold text-red-600' : 'text-blue-600'}>
                  {formatDate(schedule.scheduled_for)}
                </span>
              )}
              {schedule.status === 'executed' && schedule.executed_at && (
                <span className="text-green-600">
                  Executed {new Date(schedule.executed_at).toLocaleDateString()}
                </span>
              )}
            </div>
            {schedule.original_outreach && (
              <div className="mt-2 text-xs text-slate-500">
                Original outreach: {schedule.original_outreach.subject || 'No subject'}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {schedule.status === 'scheduled' && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              title="Cancel follow-up"
            >
              {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            </button>
          )}
          {schedule.contact_id && (
            <Link
              href={`/contacts/${schedule.contact_id}`}
              className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
              title="View contact"
            >
              <User className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function FollowupSchedulePanel({
  agentId,
  contactId,
  showUpcoming = true,
  limit = 20,
}: FollowupSchedulePanelProps) {
  const [statusFilter, setStatusFilter] = useState<'scheduled' | 'executed' | 'cancelled' | 'skipped' | undefined>(
    showUpcoming ? 'scheduled' : undefined
  );
  const [showFilters, setShowFilters] = useState(false);

  const {
    schedules,
    loading,
    error,
    total,
    refresh,
    cancelSchedule,
  } = useFollowupSchedule({
    agentId,
    contactId,
    status: statusFilter,
    limit,
    enabled: true,
  });

  // Filter to show only upcoming if requested
  const filteredSchedules = showUpcoming
    ? schedules.filter(s => {
        if (s.status !== 'scheduled') return false;
        const scheduledDate = new Date(s.scheduled_for);
        return scheduledDate >= new Date();
      })
    : schedules;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {showUpcoming ? 'Upcoming Follow-ups' : 'Follow-up Schedule'}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {total} {total === 1 ? 'follow-up' : 'follow-ups'} {statusFilter ? `(${statusFilter})` : 'total'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Filter className="h-4 w-4" />
            Filter
            {statusFilter && (
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
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
          <label className="mb-2 block text-sm font-medium text-slate-900">
            Filter by Status
          </label>
          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value as any || undefined)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="executed">Executed</option>
            <option value="cancelled">Cancelled</option>
            <option value="skipped">Skipped</option>
          </select>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter(undefined)}
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
      {loading && filteredSchedules.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredSchedules.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No follow-ups</h3>
          <p className="mt-2 text-sm text-slate-600">
            {statusFilter
              ? `No ${statusFilter} follow-ups found.`
              : showUpcoming
              ? 'No upcoming follow-ups scheduled.'
              : 'No follow-ups found.'}
          </p>
        </div>
      )}

      {/* Schedule List */}
      {filteredSchedules.length > 0 && (
        <div className="space-y-3">
          {filteredSchedules.map((schedule) => (
            <ScheduleItem
              key={schedule.id}
              schedule={schedule}
              onCancel={cancelSchedule}
            />
          ))}
        </div>
      )}
    </div>
  );
}

