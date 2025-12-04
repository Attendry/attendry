'use client';

import { useState, useMemo } from 'react';
import { 
  Target, 
  Users, 
  Calendar, 
  Bot, 
  Bell,
  ArrowRight,
  Filter,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
// Simple date formatter (replacing date-fns)
function formatDistanceToNow(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return then.toLocaleDateString();
}

export type ActivityType = 'opportunity' | 'contact' | 'event' | 'agent' | 'system';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: Date | string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

interface ActivityStreamProps {
  activities: ActivityItem[];
  loading?: boolean;
  maxItems?: number;
  showFilters?: boolean;
  compact?: boolean;
}

const activityIcons = {
  opportunity: Target,
  contact: Users,
  event: Calendar,
  agent: Bot,
  system: Bell,
};

const activityColors = {
  opportunity: 'bg-blue-100 text-blue-700',
  contact: 'bg-green-100 text-green-700',
  event: 'bg-purple-100 text-purple-700',
  agent: 'bg-orange-100 text-orange-700',
  system: 'bg-slate-100 text-slate-700',
};

function ActivityItemComponent({ activity, compact = false }: { activity: ActivityItem; compact?: boolean }) {
  const Icon = activityIcons[activity.type] || Bell;
  const colorClass = activityColors[activity.type] || activityColors.system;
  
  const timestamp = typeof activity.timestamp === 'string' 
    ? new Date(activity.timestamp) 
    : activity.timestamp;
  
  const timeAgo = formatDistanceToNow(timestamp);

  const content = (
    <div className={`group flex items-start gap-3 rounded-lg border border-slate-200 bg-white transition hover:border-blue-300 hover:bg-blue-50/50 ${compact ? 'p-2.5' : 'p-4'}`}>
      <div className={`flex items-center justify-center rounded-lg ${colorClass} ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}>
        <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-slate-900 ${compact ? 'text-sm' : ''}`}>{activity.title}</div>
        {activity.description && !compact && (
          <div className="mt-1 text-sm text-slate-600">{activity.description}</div>
        )}
        <div className={`text-slate-500 ${compact ? 'text-[10px] mt-0.5' : 'mt-2 text-xs'}`}>{timeAgo}</div>
      </div>
      {activity.actionUrl && !compact && (
        <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1" />
      )}
    </div>
  );

  if (activity.actionUrl) {
    return (
      <Link href={activity.actionUrl} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export function ActivityStream({ 
  activities, 
  loading = false, 
  maxItems = 10,
  showFilters = true,
  compact = false
}: ActivityStreamProps) {
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');

  const filteredActivities = useMemo(() => {
    const sorted = [...activities].sort((a, b) => {
      const timeA = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : a.timestamp.getTime();
      const timeB = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : b.timestamp.getTime();
      return timeB - timeA;
    });

    const filtered = filter === 'all' 
      ? sorted 
      : sorted.filter(a => a.type === filter);

    return filtered.slice(0, maxItems);
  }, [activities, filter, maxItems]);

  const activityCounts = useMemo(() => {
    const counts: Record<ActivityType | 'all', number> = {
      all: activities.length,
      opportunity: 0,
      contact: 0,
      event: 0,
      agent: 0,
      system: 0,
    };

    activities.forEach(activity => {
      counts[activity.type] = (counts[activity.type] || 0) + 1;
    });

    return counts;
  }, [activities]);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${compact ? 'p-4' : 'p-6'}`}>
      <div className={`mb-4 ${compact ? 'mb-3' : ''}`}>
        <h3 className={`font-semibold text-slate-900 ${compact ? 'text-base' : 'text-lg'}`}>Recent Activity</h3>
        {!compact && (
          <p className="mt-1 text-sm text-slate-600">
            Your latest opportunities, contacts, and events
          </p>
        )}
        {showFilters && !compact && (
          <div className="mt-3 flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as ActivityType | 'all')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All ({activityCounts.all})</option>
              <option value="opportunity">Opportunities ({activityCounts.opportunity})</option>
              <option value="contact">Contacts ({activityCounts.contact})</option>
              <option value="event">Events ({activityCounts.event})</option>
              <option value="agent">Agents ({activityCounts.agent})</option>
              <option value="system">System ({activityCounts.system})</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="py-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-sm text-slate-500">No activity to display</p>
        </div>
      ) : (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
          {filteredActivities.map((activity) => (
            <ActivityItemComponent key={activity.id} activity={activity} compact={compact} />
          ))}
        </div>
      )}

      {filteredActivities.length >= maxItems && (
        <div className="mt-6 text-center">
          <Link
            href="/activity"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View all activity
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

