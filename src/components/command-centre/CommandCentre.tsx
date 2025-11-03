'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Users,
  TrendingUp,
  Calendar,
  Mail,
  Linkedin,
  Target,
  MessageSquare,
  Loader2,
  RefreshCw,
  AlertCircle,
  Plus,
  ArrowUpRight,
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
import { supabaseBrowser } from '@/lib/supabase-browser';

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
  meeting_scheduled: 'bg-purple-100 text-purple-800',
};

export function CommandCentre() {
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

  const savedProfiles = useSavedProfiles({ statusFilter: 'not_started', enabled: authReady && !!userId });
  const {
    profiles,
    loading: profilesLoading,
    error: profilesError,
    statusFilter,
    setStatusFilter,
    updateStatus,
    refresh: refreshProfiles,
  } = savedProfiles;

  const accountData = useAccountIntelligenceData({ enabled: authReady && !!userId });
  const trendingData = useTrendingInsights();

  if (!authReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-4 text-sm text-gray-600 shadow-sm">
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

  const metrics = useMemo(() => {
    const readyForOutreach = profiles.filter((profile) => profile.outreach_status === 'not_started').length;
    const activeConversations = profiles.filter((profile) => profile.outreach_status === 'contacted' || profile.outreach_status === 'responded').length;
    const meetingsScheduled = profiles.filter((profile) => profile.outreach_status === 'meeting_scheduled').length;

    return [
      {
        label: 'Ready for Outreach',
        value: readyForOutreach,
        icon: Target,
      },
      {
        label: 'Active Conversations',
        value: activeConversations,
        icon: MessageSquare,
      },
      {
        label: 'Meetings Scheduled',
        value: meetingsScheduled,
        icon: Calendar,
      },
      {
        label: 'Monitored Accounts',
        value: accountData.stats.totalAccounts,
        icon: Building2,
      },
    ];
  }, [profiles, accountData.stats.totalAccounts]);

  const prioritizedProfiles = useMemo(() => {
    const filtered = statusFilter === 'all'
      ? profiles
      : profiles.filter((profile) => profile.outreach_status === statusFilter);

    return [...filtered]
      .sort((a, b) => {
        const statusDiff = STATUS_PRIORITY[a.outreach_status] - STATUS_PRIORITY[b.outreach_status];
        if (statusDiff !== 0) return statusDiff;
        return new Date(a.saved_at).getTime() - new Date(b.saved_at).getTime();
      })
      .slice(0, 6);
  }, [profiles, statusFilter]);

  const recentSpeakers = useMemo(() => {
    return [...profiles]
      .sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime())
      .slice(0, 5);
  }, [profiles]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Command Centre</h1>
          <p className="mt-2 text-gray-600">
            Your cockpit for targeted outreach. Prioritize speakers, monitor accounts, and act on market signals.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => refreshProfiles()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <Link
            href="/saved-profiles"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Manage Saved Speakers
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <CommandMetrics metrics={metrics} loading={profilesLoading && profiles.length === 0} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TargetedSpeakersPanel
            profiles={prioritizedProfiles}
            fullCount={profiles.length}
            loading={profilesLoading}
            error={profilesError}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onStatusChange={updateStatus}
          />
        </div>
        <div className="space-y-6">
          <SpeakerInsightsPanel profiles={recentSpeakers} loading={profilesLoading} />
          <TrendHighlightsPanel
            categories={trendingData.categories}
            events={trendingData.events}
            loading={trendingData.loading}
            error={trendingData.error}
          />
        </div>
      </div>

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
  );
}

interface MetricsCardProps {
  metrics: Array<{ label: string; value: number; icon: typeof Users }>;
  loading: boolean;
}

function CommandMetrics({ metrics, loading }: MetricsCardProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                <div className="mt-2 text-2xl font-semibold text-gray-900">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : metric.value}
                </div>
              </div>
              <span className="rounded-full bg-blue-50 p-2 text-blue-600">
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface TargetedSpeakersPanelProps {
  profiles: SavedSpeakerProfile[];
  fullCount: number;
  loading: boolean;
  error: string | null;
  statusFilter: string;
  setStatusFilter: (status: SavedSpeakerProfile['outreach_status'] | 'all') => void;
  onStatusChange: (id: string, status: SavedSpeakerProfile['outreach_status']) => Promise<void>;
}

function TargetedSpeakersPanel({
  profiles,
  fullCount,
  loading,
  error,
  statusFilter,
  setStatusFilter,
  onStatusChange,
}: TargetedSpeakersPanelProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (profileId: string, status: SavedSpeakerProfile['outreach_status']) => {
    try {
      setUpdatingId(profileId);
      await onStatusChange(profileId, status);
    } catch (err) {
      alert((err as Error).message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Targeted Speakers</h2>
          <p className="text-sm text-gray-600">Top matches prioritized for outreach based on engagement signals.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'not_started', 'contacted', 'responded', 'meeting_scheduled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as SavedSpeakerProfile['outreach_status'] | 'all')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : STATUS_LABELS[status as SavedSpeakerProfile['outreach_status']]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading && profiles.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading targeted speakers...
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <h3 className="text-lg font-semibold text-gray-900">No speakers found</h3>
          <p className="mt-2 text-sm text-gray-600">
            {statusFilter === 'all'
              ? 'Save speakers from event pages to build your outreach list.'
              : 'Try selecting a different status or save new speakers to target.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {profiles.map((profile) => (
            <SpeakerCard
              key={profile.id}
              profile={profile}
              isUpdating={updatingId === profile.id}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {fullCount > profiles.length && (
        <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
          Showing top {profiles.length} of {fullCount} saved speakers. Visit
          <Link href="/saved-profiles" className="ml-1 font-medium underline">
            Saved Speaker Profiles
          </Link>
          {' '}to view the full list.
        </div>
      )}
    </div>
  );
}

interface SpeakerCardProps {
  profile: SavedSpeakerProfile;
  isUpdating: boolean;
  onStatusChange: (id: string, status: SavedSpeakerProfile['outreach_status']) => Promise<void>;
}

function SpeakerCard({ profile, isUpdating, onStatusChange }: SpeakerCardProps) {
  const { speaker_data, enhanced_data, outreach_status } = profile;
  const displayTitle = enhanced_data.title || speaker_data.title;
  const displayOrg = enhanced_data.organization || speaker_data.org;
  const location = enhanced_data.location;
  const confidence = enhanced_data.confidence;

  return (
    <div className="rounded-xl border border-gray-200 p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{speaker_data.name}</h3>
          <p className="text-sm text-gray-600">
            {displayTitle ? <span className="font-medium text-gray-700">{displayTitle}</span> : 'Role TBD'}
            {displayOrg && <span className="text-gray-400"> · </span>}
            {displayOrg}
          </p>
          {location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <MapPinSmall />
              {location}
            </p>
          )}
          {confidence != null && (
            <p className="mt-2 text-xs text-gray-500">
              Data confidence: <span className="font-medium text-gray-700">{Math.round(confidence * 100)}%</span>
            </p>
          )}
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[outreach_status]}`}>
          {STATUS_LABELS[outreach_status]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {speaker_data.email && (
          <a
            href={`mailto:${speaker_data.email}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Mail className="h-4 w-4" /> Email
          </a>
        )}
        {enhanced_data.social_links?.linkedin || speaker_data.linkedin_url ? (
          <a
            href={enhanced_data.social_links?.linkedin || speaker_data.linkedin_url || '#'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Linkedin className="h-4 w-4" /> LinkedIn
          </a>
        ) : null}
      </div>

      {profile.notes && (
        <p className="mt-3 line-clamp-3 text-sm text-gray-600">{profile.notes}</p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor={`status-${profile.id}`} className="text-xs font-medium text-gray-600">
            Outreach status
          </label>
          <select
            id={`status-${profile.id}`}
            value={outreach_status}
            onChange={(event) => onStatusChange(profile.id, event.target.value as SavedSpeakerProfile['outreach_status'])}
            disabled={isUpdating}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Link
          href={`/saved-profiles`}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          View full profile
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

interface SpeakerInsightsPanelProps {
  profiles: SavedSpeakerProfile[];
  loading: boolean;
}

function SpeakerInsightsPanel({ profiles, loading }: SpeakerInsightsPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Recent Speaker Activity</h3>
      <p className="mt-2 text-sm text-gray-600">Latest additions and status changes from your saved speakers.</p>

      {loading && profiles.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading activity...
        </div>
      ) : profiles.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No recent activity yet. Save speakers to populate this feed.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {profiles.map((profile) => (
            <li key={profile.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{profile.speaker_data.name}</p>
                  <p className="text-xs text-gray-600">{STATUS_LABELS[profile.outreach_status]}</p>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(profile.saved_at).toLocaleDateString()}
                </span>
              </div>
              {profile.enhanced_data.title && (
                <p className="mt-1 text-xs text-gray-500">{profile.enhanced_data.title}</p>
              )}
            </li>
          ))}
        </ul>
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
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Trend Signals</h3>
        <p className="mt-1 text-sm text-gray-600">Top categories and events influencing your outreach focus.</p>
      </div>
      <TrendingUp className="h-5 w-5 text-blue-600" />
    </div>

    {error && (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    )}

    {loading && categories.length === 0 ? (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading trends...
      </div>
    ) : categories.length === 0 ? (
      <p className="mt-4 text-sm text-gray-500">Trend data will appear here once event engagement builds.</p>
    ) : (
      <div className="mt-4 space-y-4">
        {categories.slice(0, 3).map((category) => (
          <div key={category.name} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{category.name}</p>
                <p className="text-xs text-gray-500">{category.count} events</p>
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
        <h4 className="text-sm font-semibold text-gray-700">High-signal events</h4>
        <ul className="mt-3 space-y-2 text-sm text-gray-600">
          {events.slice(0, 3).map((event) => (
            <li key={event.id || event.title} className="flex justify-between">
              <span className="truncate pr-2 font-medium text-gray-800">{event.title}</span>
              {event.starts_at && (
                <span className="text-xs text-gray-500">{new Date(event.starts_at).toLocaleDateString()}</span>
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
    } catch (err) {
      alert((err as Error).message || 'Failed to add account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Account Intelligence</h2>
          <p className="text-sm text-gray-600">Monitor strategic accounts, speaker activity, and event participation patterns.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onRefresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <select
            value={selectedIndustry}
            onChange={(event) => setSelectedIndustry(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading accounts...
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900">No accounts found</h3>
          <p className="mt-2 text-sm text-gray-600">Add your first account to start tracking intelligence.</p>
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
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <div className="mt-2 text-xl font-semibold text-gray-900">
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
    <div className="rounded-xl border border-gray-200 p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{account.company_name}</h3>
          {account.domain && <p className="text-sm text-gray-500">{account.domain}</p>}
        </div>
        {summary && (
          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
            {Math.round(summary.confidence_avg * 100)}% confidence
          </span>
        )}
      </div>
      {account.industry && (
        <span className="mt-3 inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
          {account.industry}
        </span>
      )}
      {summary ? (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600">
          <div>
            <p className="text-xs text-gray-500">Speakers</p>
            <p className="font-medium text-gray-800">{summary.total_speakers}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Insights</p>
            <p className="font-medium text-gray-800">{summary.total_intelligence_data}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Last activity</p>
            <p className="font-medium text-gray-800">
              {summary.latest_activity ? new Date(summary.latest_activity).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Intelligence data pending. Start tracking speakers to populate insights.</p>
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
          <h3 className="text-lg font-semibold text-gray-900">Add Strategic Account</h3>
          <button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Company name *</label>
            <input
              name="company_name"
              value={formState.company_name}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. Contoso Ltd"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Domain</label>
              <input
                name="domain"
                value={formState.domain}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="contoso.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Industry</label>
              <select
                name="industry"
                value={formState.industry}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description"
              value={formState.description}
              onChange={handleChange}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="What makes this account strategic?"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
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


