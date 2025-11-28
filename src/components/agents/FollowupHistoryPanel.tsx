'use client';

import { useFollowupSchedule, FollowupSchedule } from '@/lib/hooks/useFollowupSchedule';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  Mail,
  User,
  RefreshCw,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

interface FollowupHistoryPanelProps {
  agentId?: string;
  contactId?: string;
  limit?: number;
}

function getStatusIcon(status: string) {
  switch (status) {
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

function HistoryItem({ schedule }: { schedule: FollowupSchedule }) {
  const contactName = schedule.contact?.speaker_data?.name || 
                      schedule.contact?.enhanced_data?.name || 
                      'Unknown Contact';
  const scheduledDate = new Date(schedule.scheduled_for);
  const executedDate = schedule.executed_at ? new Date(schedule.executed_at) : null;

  return (
    <div className="flex items-start gap-4 border-b border-slate-100 py-4 last:border-b-0">
      <div className="rounded-full bg-slate-100 p-2">
        {getStatusIcon(schedule.status)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-slate-900">{contactName}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {getFollowupTypeLabel(schedule.followup_type)}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                schedule.status === 'executed' 
                  ? 'bg-green-100 text-green-700'
                  : schedule.status === 'cancelled'
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {schedule.status}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Scheduled: {scheduledDate.toLocaleDateString()} at {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {executedDate && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Executed: {executedDate.toLocaleDateString()} at {executedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            {schedule.message_draft && (
              <div className="mt-2 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700 mb-1">Message:</p>
                <p className="text-xs text-slate-600 line-clamp-2">
                  {schedule.message_draft}
                </p>
              </div>
            )}
            {schedule.original_outreach && (
              <div className="mt-2 text-xs text-slate-500">
                Original outreach: {schedule.original_outreach.subject || 'No subject'}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          {schedule.contact_id && (
            <Link
              href={`/contacts/${schedule.contact_id}`}
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              <User className="h-3 w-3" />
              View Contact
            </Link>
          )}
          {schedule.original_outreach_id && (
            <Link
              href={`/agents/outreach/drafts/${schedule.original_outreach_id}`}
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              <Mail className="h-3 w-3" />
              View Original Outreach
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function FollowupHistoryPanel({
  agentId,
  contactId,
  limit = 50,
}: FollowupHistoryPanelProps) {
  const {
    schedules,
    loading,
    error,
    total,
    refresh,
  } = useFollowupSchedule({
    agentId,
    contactId,
    status: 'executed',
    limit,
    enabled: true,
  });

  // Also include cancelled and skipped for history
  const historySchedules = schedules.filter(s => 
    s.status === 'executed' || s.status === 'cancelled' || s.status === 'skipped'
  ).sort((a, b) => {
    const dateA = a.executed_at ? new Date(a.executed_at) : new Date(a.scheduled_for);
    const dateB = b.executed_at ? new Date(b.executed_at) : new Date(b.scheduled_for);
    return dateB.getTime() - dateA.getTime(); // Most recent first
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Follow-up History</h3>
          <p className="mt-1 text-sm text-slate-600">
            {total} {total === 1 ? 'follow-up' : 'follow-ups'} executed
          </p>
        </div>
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && historySchedules.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Empty State */}
      {!loading && historySchedules.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No follow-up history</h3>
          <p className="mt-2 text-sm text-slate-600">
            No follow-ups have been executed yet.
          </p>
        </div>
      )}

      {/* History List */}
      {historySchedules.length > 0 && (
        <div className="divide-y divide-slate-100">
          {historySchedules.map((schedule) => (
            <HistoryItem key={schedule.id} schedule={schedule} />
          ))}
        </div>
      )}
    </div>
  );
}

