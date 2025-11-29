'use client';

import { Target, MessageSquare, Calendar, AlertCircle, TrendingUp, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

interface FocusItem {
  type: 'opportunity' | 'contact' | 'event' | 'agent';
  count: number;
  label: string;
  action: string;
  priority?: 'high' | 'medium' | 'low';
}

interface FocusCardProps {
  title: string;
  priority: 'high' | 'medium' | 'low';
  items?: FocusItem[];
  metrics?: Array<{ label: string; value: number; trend?: string }>;
  loading?: boolean;
}

function FocusCard({ title, priority, items, metrics, loading }: FocusCardProps) {
  const priorityStyles = {
    high: {
      border: 'border-red-200',
      bg: 'bg-red-50',
      title: 'text-red-900',
      accent: 'text-red-600',
      badge: 'bg-red-100 text-red-700',
    },
    medium: {
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      title: 'text-blue-900',
      accent: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-700',
    },
    low: {
      border: 'border-slate-200',
      bg: 'bg-slate-50',
      title: 'text-slate-900',
      accent: 'text-slate-600',
      badge: 'bg-slate-100 text-slate-700',
    },
  };

  const styles = priorityStyles[priority];

  return (
    <div className={`rounded-xl border-2 ${styles.border} ${styles.bg} p-6`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${styles.title}`}>{title}</h3>
        {priority === 'high' && (
          <AlertCircle className={`h-5 w-5 ${styles.accent}`} />
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : items && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <Link
              key={index}
              href={item.action}
              className="group flex items-center justify-between rounded-lg border border-white/50 bg-white/50 p-3 transition hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${styles.badge}`}>
                  {item.count}
                </span>
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      ) : metrics ? (
        <div className="space-y-4">
          {metrics.map((metric, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{metric.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900">{metric.value}</span>
                {metric.trend && (
                  <span className={`text-xs font-medium ${
                    metric.trend.startsWith('+') ? 'text-green-600' : 
                    metric.trend.startsWith('-') ? 'text-red-600' : 
                    'text-slate-500'
                  }`}>
                    {metric.trend}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center text-sm text-slate-500">
          No items to display
        </div>
      )}
    </div>
  );
}

interface FocusCardsProps {
  urgent?: {
    opportunities: number;
    contacts: number;
    events: number;
  };
  today?: {
    opportunities: number;
    contacts: number;
    agentTasks: number;
  };
  week?: {
    events: number;
    contacts: number;
    meetings: number;
    trends?: { up: number; down: number };
  };
  loading?: boolean;
}

export function FocusCards({ urgent, today, week, loading }: FocusCardsProps) {
  const urgentItems: FocusItem[] = urgent ? [
    {
      type: 'opportunity',
      count: urgent.opportunities,
      label: 'New opportunities',
      action: '/opportunities?urgency=critical',
      priority: 'high',
    },
    {
      type: 'contact',
      count: urgent.contacts,
      label: 'Follow-ups needed',
      action: '/contacts?status=contacted&needs_followup=true',
      priority: 'high',
    },
    {
      type: 'event',
      count: urgent.events,
      label: 'Events starting soon',
      action: '/events?starts_soon=true',
      priority: 'high',
    },
  ].filter(item => item.count > 0) : [];

  const todayItems: FocusItem[] = today ? [
    {
      type: 'opportunity',
      count: today.opportunities,
      label: 'New opportunities',
      action: '/opportunities?status=new',
      priority: 'medium',
    },
    {
      type: 'contact',
      count: today.contacts,
      label: 'Ready for outreach',
      action: '/contacts?status=not_started',
      priority: 'medium',
    },
    {
      type: 'agent',
      count: today.agentTasks,
      label: 'Agent tasks pending',
      action: '/agents/approvals',
      priority: 'medium',
    },
  ].filter(item => item.count > 0) : [];

  const weekMetrics = week ? [
    { label: 'Events', value: week.events, trend: week.trends?.up ? `+${week.trends.up}` : undefined },
    { label: 'Contacts', value: week.contacts, trend: week.trends?.up ? `+${week.trends.up}` : undefined },
    { label: 'Meetings', value: week.meetings, trend: undefined },
  ] : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <FocusCard
        title="Urgent Actions"
        priority="high"
        items={urgentItems}
        loading={loading}
      />
      <FocusCard
        title="Today's Focus"
        priority="medium"
        items={todayItems}
        loading={loading}
      />
      <FocusCard
        title="This Week"
        priority="low"
        metrics={weekMetrics}
        loading={loading}
      />
    </div>
  );
}

