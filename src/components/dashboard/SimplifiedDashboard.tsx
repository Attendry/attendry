'use client';

import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { DashboardHeader } from './DashboardHeader';
import { FocusCards } from './FocusCards';
import { ActivityStream, ActivityItem } from './ActivityStream';
import { OutreachManager } from '../outreach/OutreachManager';
import { Loader2 } from 'lucide-react';

interface DashboardSummary {
  urgent: {
    opportunities: number;
    contacts: number;
    events: number;
  };
  today: {
    opportunities: number;
    contacts: number;
    agentTasks: number;
  };
  week: {
    events: number;
    contacts: number;
    meetings: number;
    trends?: { up: number; down: number };
  };
  activities: ActivityItem[];
}

export function SimplifiedDashboard() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUserId(data.session?.user?.id ?? null);
        setAuthReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authReady && userId) {
      loadDashboardSummary();
    }
  }, [authReady, userId]);

  const loadDashboardSummary = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard/summary');
      if (!response.ok) {
        throw new Error('Failed to load dashboard summary');
      }

      const data = await response.json();
      if (data.success) {
        setSummary(data.summary);
      } else {
        throw new Error(data.error || 'Failed to load dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          Checking your session...
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Sign in required</h2>
          <p className="text-slate-600 mb-4">
            Please sign in to view your dashboard.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4 text-red-900">Error loading dashboard</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={loadDashboardSummary}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const urgentOpportunities = summary?.urgent.opportunities || 0;
  const readyForOutreach = summary?.today.contacts || 0;

  return (
    <div className="space-y-8">
      <DashboardHeader 
        urgentOpportunities={urgentOpportunities}
        readyForOutreach={readyForOutreach}
      />

      <FocusCards
        urgent={summary?.urgent}
        today={summary?.today}
        week={summary?.week}
        loading={loading}
      />

      {/* Main content area: Outreach Orbit center, Activity Stream right sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Outreach Orbit - Main content (3 columns on large screens) */}
        <div className="lg:col-span-3">
          <OutreachManager />
        </div>

        {/* Activity Stream - Right sidebar (1 column on large screens) */}
        <div className="lg:col-span-1">
          <ActivityStream
            activities={summary?.activities || []}
            loading={loading}
            maxItems={10}
            compact={true}
          />
        </div>
      </div>
    </div>
  );
}

