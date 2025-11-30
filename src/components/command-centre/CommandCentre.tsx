'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Users,
  TrendingUp,
  Calendar,
  Mail,
  Target,
  MessageSquare,
  Loader2,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { SavedSpeakerProfile } from '@/lib/types/database';
import { useSavedProfiles } from '@/lib/hooks/useSavedProfiles';
import {
  useAccountIntelligenceData,
  Account,
  AccountSummary,
} from '@/lib/hooks/useAccountIntelligenceData';
import { useTrendingInsights } from '@/lib/hooks/useTrendingInsights';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import { deriveLocale, toISO2Country } from '@/lib/utils/country';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
import { OnboardingTour, TourStep } from '@/components/onboarding/OnboardingTour';
import { QuickEventSearchPanel } from '@/components/search/QuickEventSearchPanel';

const STATUS_LABELS: Record<SavedSpeakerProfile['outreach_status'], string> = {
  not_started: 'Not Started',
  contacted: 'Contacted',
  responded: 'Responded',
  meeting_scheduled: 'Meeting Scheduled',
};

const STATUS_PRIORITY: Record<SavedSpeakerProfile['outreach_status'], number> = {
  not_started: 0,
  contacted: 1,
  responded: 2,
  meeting_scheduled: 3,
};

const STATUS_COLORS: Record<SavedSpeakerProfile['outreach_status'], string> = {
  not_started: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  responded: 'bg-green-100 text-green-800',
  meeting_scheduled: 'bg-blue-100 text-blue-800',
};

type OutreachStatus = SavedSpeakerProfile['outreach_status'];

const STATUS_HELPERS: Record<OutreachStatus, string> = {
  not_started: 'Need first contact',
  contacted: 'Awaiting response',
  responded: 'Follow up promptly',
  meeting_scheduled: 'Prepare for meeting',
};


export function CommandCentre() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Check onboarding status
  const checkOnboardingStatus = useCallback((uid: string) => {
    try {
      const stored = localStorage.getItem(`onboarding_completed_${uid}`);
      if (!stored) {
        // Show welcome modal for first-time users
        setShowWelcomeModal(true);
      } else {
        setOnboardingCompleted(true);
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUserId(data.session?.user?.id ?? null);
        setAuthReady(true);
        
        // Check if onboarding should be shown
        if (data.session?.user?.id) {
          checkOnboardingStatus(data.session.user.id);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [checkOnboardingStatus]);

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    if (userId) {
      localStorage.setItem(`onboarding_completed_${userId}`, 'true');
      setOnboardingCompleted(true);
      setShowWelcomeModal(false);
      setShowTour(false);
    }
  };

  // Handle skip onboarding
  const handleSkipOnboarding = () => {
    if (userId) {
      localStorage.setItem(`onboarding_completed_${userId}`, 'true');
      setOnboardingCompleted(true);
      setShowWelcomeModal(false);
      setShowTour(false);
    }
  };

  // Start tour
  const handleStartTour = () => {
    setShowWelcomeModal(false);
    setShowTour(true);
  };

  // Tour steps
  const tourSteps: TourStep[] = [
    {
      id: 'quick-search',
      target: '[data-tour="quick-search"]',
      title: 'Quick Event Search',
      content: 'Start here! Search for events where your target accounts will be. Use natural language or filters to find the perfect prospecting opportunities.',
      position: 'bottom',
      action: {
        label: 'Try a search',
        onClick: () => {
          // Try to find the search input - it might be in a nested component
          const searchContainer = document.querySelector('[data-tour="quick-search"]');
          if (searchContainer) {
            const searchInput = searchContainer.querySelector('input[type="text"]') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
            }
          }
        }
      }
    },
    {
      id: 'saved-profiles',
      target: '[data-tour="saved-profiles"]',
      title: 'Contacts Overview',
      content: 'See quick stats, action items, and recent activity for your saved contacts. Click any status to filter, or manage all contacts from the full page.',
      position: 'left'
    },
    {
      id: 'account-intelligence',
      target: '[data-tour="account-intelligence"]',
      title: 'Account Intelligence',
      content: 'See which events your target accounts are attending. Get insights on company participation and identify warm outreach opportunities.',
      position: 'right'
    },
    {
      id: 'trending-insights',
      target: '[data-tour="trending-insights"]',
      title: 'Trending Insights',
      content: 'Discover trending events and topics in your industry. Stay ahead of the curve and find new prospecting opportunities.',
      position: 'top'
    }
  ];

  const savedProfiles = useSavedProfiles({ statusFilter: 'all', enabled: authReady && !!userId });
  const {
    profiles,
    loading: profilesLoading,
    error: profilesError,
    updateStatus,
    refresh: refreshProfiles,
  } = savedProfiles;

  const accountData = useAccountIntelligenceData({ enabled: authReady && !!userId });
  const trendingData = useTrendingInsights();

  const metrics = useMemo(() => {
    const readyForOutreach = profiles.filter((profile) => profile.outreach_status === 'not_started').length;
    const activeConversations = profiles.filter((profile) => profile.outreach_status === 'contacted' || profile.outreach_status === 'responded').length;
    const meetingsScheduled = profiles.filter((profile) => profile.outreach_status === 'meeting_scheduled').length;

    return [
      {
        label: 'Ready for Outreach',
        value: readyForOutreach,
        icon: Target,
        filterStatus: null, // Navigate directly, no filter needed
        link: '/contacts?status=not_started',
      },
      {
        label: 'Active Conversations',
        value: activeConversations,
        icon: MessageSquare,
        filterStatus: null, // Multiple statuses - navigate to contacts page
        link: '/contacts',
      },
      {
        label: 'Meetings Scheduled',
        value: meetingsScheduled,
        icon: Calendar,
        filterStatus: null, // Navigate directly, no filter needed
        link: '/contacts?status=meeting_scheduled',
      },
      {
        label: 'Monitored Accounts',
        value: accountData.stats.totalAccounts,
        icon: Building2,
        filterStatus: null,
        link: null,
      },
    ];
  }, [profiles, accountData.stats.totalAccounts]);

  const recentSpeakers = useMemo(() => {
    return [...profiles]
      .sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime())
      .slice(0, 5);
  }, [profiles]);

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
        <UnauthenticatedNotice
          feature="Command Centre"
          description="Log in to activate targeted speaker outreach, monitored accounts, and trend insights."
        />
      </div>
    );
  }

  return (
    <>
      {/* Onboarding Components */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleSkipOnboarding}
        onStartTour={handleStartTour}
      />
      <OnboardingTour
        steps={tourSteps}
        isActive={showTour}
        onComplete={handleOnboardingComplete}
        onSkip={handleSkipOnboarding}
      />

      <div className="space-y-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Command Centre</h1>
            <p className="mt-2 text-slate-600">
              Your cockpit for targeted outreach. Prioritize speakers, monitor accounts, and act on market signals.
            </p>
          </div>
        <div className="flex gap-3">
          <button
            onClick={() => refreshProfiles()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <Link
            href="/contacts"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Manage Contacts
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="grid gap-6">
        <QuickEventSearchPanel onSpeakerSaved={refreshProfiles} />
      </div>

      <CommandMetrics 
        metrics={metrics} 
        loading={profilesLoading && profiles.length === 0}
      />

      <div className="grid gap-6 lg:grid-cols-3" data-tour="trending-insights">
        <div className="lg:col-span-2 space-y-6">
          <SpeakerInsightsPanel profiles={recentSpeakers} loading={profilesLoading} />
        </div>
        <div className="space-y-6">
          <TrendHighlightsPanel
            categories={trendingData.categories}
            events={trendingData.events}
            loading={trendingData.loading}
            error={trendingData.error}
          />
        </div>
      </div>

      <div data-tour="account-intelligence">
        <AccountIntelligencePanel
          accounts={accountData.accounts}
          summaries={accountData.summaries}
          stats={accountData.stats}
          loading={accountData.loading}
          error={accountData.error}
          onRefresh={accountData.refresh}
          onAddAccount={accountData.addAccount}
        />
      </div>
      </div>
    </>
  );
}



interface MetricsCardProps {
  metrics: Array<{ 
    label: string; 
    value: number; 
    icon: typeof Users;
    filterStatus?: OutreachStatus | null;
    link?: string | null;
  }>;
  loading: boolean;
}

function CommandMetrics({ metrics, loading }: MetricsCardProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const isClickable = metric.link !== null;

        const content = (
          <div className={`rounded-lg border border-slate-200 bg-white p-4 transition-all ${
            isClickable ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/50' : ''
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600">{metric.label}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold text-slate-900">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : metric.value}
                  </span>
                  {!loading && metric.value > 0 && isClickable && (
                    <span className="text-xs text-blue-600 font-medium">View all →</span>
                  )}
                </div>
              </div>
              <span className="rounded-full bg-blue-50 p-2 text-blue-600">
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        );

        if (metric.link) {
          return (
            <Link key={metric.label} href={metric.link} className="block">
              {content}
            </Link>
          );
        }

        return <div key={metric.label}>{content}</div>;
      })}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface SpeakerInsightsPanelProps {
  profiles: SavedSpeakerProfile[];
  loading: boolean;
}

function SpeakerInsightsPanel({ profiles, loading }: SpeakerInsightsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="rounded-lg border-0 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Recent Speaker Activity</h3>
          <p className="mt-1 text-xs text-slate-600">Latest additions and status changes from your saved speakers.</p>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
      
      {!isCollapsed && (
        <>
          {loading && profiles.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Loading activity...
            </div>
          ) : profiles.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No recent activity yet. Save speakers to populate this feed.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {profiles.map((profile) => (
                <li key={profile.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{profile.speaker_data.name}</p>
                      <p className="text-xs text-slate-600">{STATUS_LABELS[profile.outreach_status]}</p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(profile.saved_at).toLocaleDateString()}
                    </span>
                  </div>
                  {profile.enhanced_data.title && (
                    <p className="mt-1 text-xs text-slate-500">{profile.enhanced_data.title}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

interface TrendHighlightsPanelProps {
  categories: ReturnType<typeof useTrendingInsights>['categories'];
  events: ReturnType<typeof useTrendingInsights>['events'];
  loading: boolean;
  error: string | null;
}

function TrendHighlightsPanel({ categories, events, loading, error }: TrendHighlightsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="rounded-lg border-0 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Trend Signals</h3>
          <p className="mt-1 text-xs text-slate-600">Top categories and events influencing your outreach focus.</p>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
      
      {!isCollapsed && (
        <>
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loading && categories.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Loading trends...
            </div>
          ) : categories.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Trend data will appear here once event engagement builds.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {categories.slice(0, 3).map((category) => (
                <div key={category.name} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{category.name}</p>
                      <p className="text-xs text-slate-500">{category.count} events</p>
                    </div>
                    <span className={`text-xs font-medium ${category.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {category.growth >= 0 ? '+' : ''}{category.growth.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {events.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-slate-700">High-signal events</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {events.slice(0, 3).map((event) => (
                  <li key={event.id || event.title} className="flex justify-between">
                    <span className="truncate pr-2 font-medium text-slate-800">{event.title}</span>
                    {event.starts_at && (
                      <span className="text-xs text-slate-500">{new Date(event.starts_at).toLocaleDateString()}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href="/trending"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Explore full trend insights
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}

interface AccountPanelProps {
  accounts: Account[];
  summaries: AccountSummary[];
  stats: ReturnType<typeof useAccountIntelligenceData>['stats'];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAddAccount: (payload: { company_name: string; domain?: string; industry?: string; description?: string }) => Promise<void>;
}

function AccountIntelligencePanel({
  accounts,
  summaries,
  stats,
  loading,
  error,
  onRefresh,
  onAddAccount,
}: AccountPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const matchesSearch = !searchTerm
        || account.company_name.toLowerCase().includes(searchTerm.toLowerCase())
        || account.domain?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesIndustry = selectedIndustry === 'all' || account.industry === selectedIndustry;
      return matchesSearch && matchesIndustry;
    });
  }, [accounts, searchTerm, selectedIndustry]);

  const industries = useMemo(
    () => Array.from(new Set(accounts.map((account) => account.industry).filter(Boolean))) as string[],
    [accounts]
  );

  const handleAddAccount = async (payload: { company_name: string; domain?: string; industry?: string; description?: string }) => {
    try {
      setSubmitting(true);
      await onAddAccount(payload);
      setShowModal(false);
      toast.success("Account added", {
        description: `${payload.company_name} has been added to your watchlist`
      });
    } catch (err) {
      toast.error("Failed to add account", {
        description: (err as Error).message || 'An error occurred. Please try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Account Intelligence</h2>
          <p className="text-sm text-slate-600">Monitor strategic accounts, speaker activity, and event participation patterns.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onRefresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Add Account
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Accounts" value={stats.totalAccounts} icon={Building2} loading={loading} />
        <StatCard label="Speakers" value={stats.totalSpeakers} icon={Users} loading={loading} />
        <StatCard label="Event Insights" value={stats.totalEvents} icon={Calendar} loading={loading} />
        <StatCard label="Active This Week" value={stats.recentActivity} icon={TrendingUp} loading={loading} />
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <select
            value={selectedIndustry}
            onChange={(event) => setSelectedIndustry(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All industries</option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading && filteredAccounts.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading accounts...
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <h3 className="text-lg font-semibold text-slate-900">No accounts found</h3>
          <p className="mt-2 text-sm text-slate-600">Add your first account to start tracking intelligence.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAccounts.map((account) => {
            const summary = summaries.find((item) => item.account_id === account.id);
            return <AccountCard key={account.id} account={account} summary={summary} />;
          })}
        </div>
      )}

      {showModal && (
        <AddAccountModal
          submitting={submitting}
          onClose={() => setShowModal(false)}
          onSubmit={handleAddAccount}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : value}
          </div>
        </div>
        <span className="rounded-full bg-white p-2 text-blue-600 shadow">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function AccountCard({ account, summary }: { account: Account; summary?: AccountSummary }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{account.company_name}</h3>
          {account.domain && <p className="text-sm text-slate-500">{account.domain}</p>}
        </div>
        {summary && (
          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
            {Math.round(summary.confidence_avg * 100)}% confidence
          </span>
        )}
      </div>
      {account.industry && (
        <span className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
          {account.industry}
        </span>
      )}
      {summary ? (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
          <div>
            <p className="text-xs text-slate-500">Speakers</p>
            <p className="font-medium text-slate-800">{summary.total_speakers}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Insights</p>
            <p className="font-medium text-slate-800">{summary.total_intelligence_data}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Last activity</p>
            <p className="font-medium text-slate-800">
              {summary.latest_activity ? new Date(summary.latest_activity).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Intelligence data pending. Start tracking speakers to populate insights.</p>
      )}
    </div>
  );
}

interface AddAccountModalProps {
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { company_name: string; domain?: string; industry?: string; description?: string }) => Promise<void>;
}

function AddAccountModal({ submitting, onClose, onSubmit }: AddAccountModalProps) {
  const [formState, setFormState] = useState({
    company_name: '',
    domain: '',
    industry: '',
    description: '',
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.company_name.trim()) return;
    await onSubmit(formState);
    setFormState({ company_name: '', domain: '', industry: '', description: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Add Strategic Account</h3>
          <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Company name *</label>
            <input
              name="company_name"
              value={formState.company_name}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Contoso Ltd"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Domain</label>
              <input
                name="domain"
                value={formState.domain}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="contoso.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Industry</label>
              <select
                name="industry"
                value={formState.industry}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select industry</option>
                <option value="Technology">Technology</option>
                <option value="Financial Services">Financial Services</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Consulting">Consulting</option>
                <option value="Education">Education</option>
                <option value="Government">Government</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea
              name="description"
              value={formState.description}
              onChange={handleChange}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="What makes this account strategic?"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !formState.company_name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MapPinSmall() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}


