/**
 * PHASE 2: Opportunity Dashboard Page
 * 
 * Main feed page for displaying proactive opportunities discovered for the user.
 * Shows curated opportunities with signals, relevance scores, and temporal intelligence.
 */

"use client";

import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { toast } from 'sonner';
import OpportunityCard from '@/components/OpportunityCard';
import DiscoveryProfileWizard from '@/components/DiscoveryProfileWizard';

interface Opportunity {
  id: string;
  event: {
    id: string;
    title: string;
    starts_at: string | null;
    ends_at: string | null;
    city: string | null;
    country: string | null;
    venue: string | null;
    organizer: string | null;
    description: string | null;
    topics: string[] | null;
    source_url: string;
  };
  signals: {
    target_accounts_attending: number;
    icp_matches: number;
    competitor_presence: boolean;
    account_connections: Array<{
      account_name: string;
      confidence_score: number;
      verification_source: string;
      speakers: Array<{ name: string; title: string }>;
    }>;
  };
  relevance: {
    score: number;
    reasons: string[];
    signal_strength: 'strong' | 'medium' | 'weak';
  };
  action_timing: {
    urgency: 'critical' | 'high' | 'medium' | 'low';
    optimal_outreach_date: string;
    days_until_event: number;
    action_window_status: 'open' | 'closing_soon' | 'closed';
    recommended_actions: string[];
  } | null;
  status: 'new' | 'viewed' | 'saved' | 'actioned' | 'dismissed';
  dismissal_reason?: string;
  discovery_method: string;
  created_at: string;
  viewed_at?: string;
  actioned_at?: string;
}

interface FeedResponse {
  success: boolean;
  opportunities: Opportunity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function OpportunitiesPage() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('new,viewed,saved');
  const [signalStrengthFilter, setSignalStrengthFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'urgency'>('relevance');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Onboarding
  const [showWizard, setShowWizard] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  // Auth setup
  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUserId(data.session?.user?.id ?? null);
        setAuthReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!cancelled) setUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Check for discovery profile
  useEffect(() => {
    if (authReady && userId) {
      checkDiscoveryProfile();
    }
  }, [authReady, userId]);

  // Load opportunities
  useEffect(() => {
    if (authReady && userId && hasProfile) {
      loadOpportunities();
    }
  }, [authReady, userId, hasProfile, statusFilter, signalStrengthFilter, sortBy, page]);

  const checkDiscoveryProfile = async () => {
    if (!userId) return;

    try {
      const response = await fetch('/api/discovery-profiles');
      if (response.ok) {
        const data = await response.json();
        setHasProfile(!!data.profile);
        if (!data.profile) {
          setShowWizard(true);
        }
      }
    } catch (error) {
      console.error('Error checking discovery profile:', error);
    }
  };

  const loadOpportunities = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        status: statusFilter,
        sort: sortBy,
        page: page.toString(),
        limit: '20'
      });

      if (signalStrengthFilter) {
        params.append('signal_strength', signalStrengthFilter);
      }

      const response = await fetch(`/api/opportunities/feed?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to load opportunities');
      }

      const data: FeedResponse = await response.json();

      if (data.success) {
        setOpportunities(data.opportunities);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load opportunities';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (opportunityId: string, reason: string) => {
    try {
      const response = await fetch('/api/opportunities/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId,
          action: 'dismiss',
          reason
        })
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss opportunity');
      }

      // Optimistic update - remove from list
      setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
      toast.success('Opportunity dismissed');
    } catch (err) {
      toast.error('Failed to dismiss opportunity');
      // Reload to sync state
      loadOpportunities();
    }
  };

  const handleSave = async (opportunityId: string) => {
    try {
      const response = await fetch('/api/opportunities/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId,
          action: 'save'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save opportunity');
      }

      // Update status in local state
      setOpportunities(prev =>
        prev.map(opp =>
          opp.id === opportunityId ? { ...opp, status: 'saved' as const } : opp
        )
      );
      toast.success('Opportunity saved');
    } catch (err) {
      toast.error('Failed to save opportunity');
    }
  };

  if (!authReady) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Loading...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-4">Sign in required</h2>
        <p>
          <a href="/login" className="text-blue-600 hover:text-blue-700">
            Go to sign in
          </a>{' '}
          to view your opportunities.
        </p>
      </div>
    );
  }

  const handleWizardComplete = () => {
    setShowWizard(false);
    setHasProfile(true);
    loadOpportunities();
    toast.success('Discovery profile created! Finding opportunities...');
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Onboarding Wizard */}
      {showWizard && (
        <DiscoveryProfileWizard
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Opportunities</h1>
        <p className="text-gray-600">
          Discovered events with your target accounts and ICP matches
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="border rounded px-3 py-1"
          >
            <option value="new,viewed,saved">Active</option>
            <option value="new">New Only</option>
            <option value="viewed">Viewed</option>
            <option value="saved">Saved</option>
            <option value="actioned">Actioned</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Signal Strength</label>
          <select
            value={signalStrengthFilter}
            onChange={(e) => {
              setSignalStrengthFilter(e.target.value);
              setPage(1);
            }}
            className="border rounded px-3 py-1"
          >
            <option value="">All</option>
            <option value="strong">Strong</option>
            <option value="medium">Medium</option>
            <option value="weak">Weak</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as 'relevance' | 'date' | 'urgency');
              setPage(1);
            }}
            className="border rounded px-3 py-1"
          >
            <option value="relevance">Relevance</option>
            <option value="date">Date</option>
            <option value="urgency">Urgency</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-gray-600">
          {total} opportunity{total !== 1 ? 'ies' : ''} found
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <p>Loading opportunities...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <button
            onClick={loadOpportunities}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && opportunities.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">No opportunities found</h3>
          <p className="text-gray-600 mb-4">
            {statusFilter === 'new,viewed,saved'
              ? hasProfile
                ? "We're discovering opportunities for you. Check back soon!"
                : "Set up your discovery profile to start finding opportunities!"
              : 'Try adjusting your filters.'}
          </p>
          {!hasProfile && (
            <button
              onClick={() => setShowWizard(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Set Up Discovery Profile
            </button>
          )}
          {statusFilter !== 'new,viewed,saved' && hasProfile && (
            <button
              onClick={() => {
                setStatusFilter('new,viewed,saved');
                setPage(1);
              }}
              className="text-blue-600 hover:text-blue-700 underline"
            >
              Show all active opportunities
            </button>
          )}
        </div>
      )}

      {/* Opportunities Feed */}
      {!loading && !error && opportunities.length > 0 && (
        <>
          <div className="space-y-4">
            {opportunities.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                onDismiss={handleDismiss}
                onSave={handleSave}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

