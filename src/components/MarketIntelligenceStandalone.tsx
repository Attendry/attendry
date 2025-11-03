'use client';

import Link from 'next/link';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Flame,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

import RecommendationEngine from '@/components/RecommendationEngine';
import { useTrendingInsights } from '@/lib/hooks/useTrendingInsights';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';

export const MarketIntelligenceStandalone = memo(() => {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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

  const { categories, events, loading, error, refresh } = useTrendingInsights({ enabled: authReady && !!userId });

  const primaryCategory = categories[0];
  const secondaryCategory = categories[1];
  const standoutEvent = events[0];

  const growthSummary = useMemo(() => {
    if (!primaryCategory) {
      return null;
    }

    const direction = primaryCategory.growth >= 0 ? 'accelerating' : 'cooling';
    const growthValue = `${primaryCategory.growth >= 0 ? '+' : ''}${primaryCategory.growth.toFixed(1)}%`;
    return `${primaryCategory.name} is ${direction} ${growthValue} week-over-week with ${primaryCategory.count} active events.`;
  }, [primaryCategory]);

  if (!authReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white px-6 py-4 text-sm text-blue-800 shadow">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Checking your session...
        </div>
      </div>
    );
  }

  const showAuthNotice = !userId;

  return (
    <div className="space-y-8">
      {showAuthNotice ? (
        <UnauthenticatedNotice
          feature="Market Intelligence"
          description="Log in to unlock live trend tracking and personalized event recommendations. You can continue exploring demo data without signing in."
          className="bg-white"
        />
      ) : null}

      <header className="rounded-2xl border border-blue-100 bg-blue-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Market Intelligence</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-800">
              Align your event motion to where your market energy is highest. Review pipeline-ready recommendations and track live trend shifts without leaving the page.
            </p>
          </div>
          <button
            onClick={() => refresh()}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow hover:bg-blue-100"
          >
            <RefreshCw className="h-4 w-4" /> Refresh signals
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InsightCard
            title="Fastest growing category"
            highlight={primaryCategory ? primaryCategory.name : 'Signal pending'}
            description={growthSummary ?? 'Trend data is syncing. Link your watchlist for instant insights.'}
            loading={loading}
          />
          <InsightCard
            title="Next best expansion"
            highlight={secondaryCategory ? secondaryCategory.name : 'Stay tuned'}
            description={secondaryCategory ? `${secondaryCategory.count} events signalling cross-account interest.` : 'Upcoming category intelligence will display here.'}
            loading={loading}
          />
          <InsightCard
            title="High-impact event"
            highlight={standoutEvent ? standoutEvent.title : 'Sync data sources'}
            description={standoutEvent?.starts_at ? `Happening ${new Date(standoutEvent.starts_at).toLocaleDateString()}.` : 'Connect CRM + analyst feeds to unlock event detail.'}
            loading={loading}
            icon={Flame}
          />
        </div>
      </header>

      <section>
        <RecommendationEngine />
      </section>

      <TrendDeepDive categories={categories} events={events} loading={loading} error={error} />
    </div>
  );
});

MarketIntelligenceStandalone.displayName = 'MarketIntelligenceStandalone';

interface InsightCardProps {
  title: string;
  highlight: string;
  description: string;
  loading: boolean;
  icon?: typeof Flame;
}

function InsightCard({ title, highlight, description, loading, icon: Icon = TrendingUp }: InsightCardProps) {
  return (
    <div className="rounded-xl border border-white bg-white/70 p-4 shadow">
      <div className="flex items-center gap-3 text-blue-600">
        <Icon className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">{title}</span>
      </div>
      <div className="mt-3 text-lg font-semibold text-blue-900">
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> : highlight}
      </div>
      <p className="mt-2 text-sm text-blue-800">{description}</p>
    </div>
  );
}

interface TrendDeepDiveProps {
  categories: ReturnType<typeof useTrendingInsights>['categories'];
  events: ReturnType<typeof useTrendingInsights>['events'];
  loading: boolean;
  error: string | null;
}

function TrendDeepDive({ categories, events, loading, error }: TrendDeepDiveProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Category momentum</h2>
        </div>
        {loading && categories.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-gray-500">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" /> Syncing trend data…
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-sm text-gray-500">
            Connect your event inputs to activate category tracking.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {categories.map((category) => (
              <div key={category.name} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900">{category.name}</h3>
                  <span className={`text-xs font-medium ${category.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {category.growth >= 0 ? '+' : ''}{category.growth.toFixed(1)}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500">{category.count} events in focus this week.</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Signal-rich events</h2>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-gray-500">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" /> Aggregating event signals…
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-sm text-gray-500">
            Save events or enable auto-ingest to populate signal-rich opportunities.
          </div>
        ) : (
          <ul className="space-y-3">
            {events.slice(0, 5).map((event) => (
              <li key={event.id || event.title} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {event.title}
                    </p>
                    {event.city || event.country ? (
                      <p className="text-xs text-gray-500">
                        {[event.city, event.country].filter(Boolean).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  {event.starts_at && (
                    <span className="text-xs text-gray-500">
                      {new Date(event.starts_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  View briefing
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

