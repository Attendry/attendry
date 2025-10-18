"use client";

import React, { useEffect, useState } from "react";
import { PageHeader, PageHeaderActions } from "@/components/Layout/PageHeader";
import { ContentContainer } from "@/components/Layout/PageContainer";
import { EmptyEvents } from "@/components/States/EmptyState";
import { SkeletonList } from "@/components/States/LoadingState";
import { ErrorState } from "@/components/States/ErrorState";
import RelevantEventsCalendar from "@/components/RelevantEventsCalendar";
import { Calendar, Settings, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { ActiveFilters } from "@/components/ActiveFilters";

interface RelevantEvent {
  id: string;
  title: string;
  starts_at?: string;
  ends_at?: string;
  city?: string;
  country?: string;
  venue?: string;
  organizer?: string;
  description?: string;
  topics?: string[];
  speakers?: any[];
  sponsors?: any[];
  participating_organizations?: string[];
  partners?: string[];
  competitors?: string[];
  confidence?: number;
  data_completeness?: number;
  relevance: {
    score: number;
    reasons: string[];
    matchedTerms: {
      industry: string[];
      icp: string[];
      competitors: string[];
    };
  };
}

interface CalendarResponse {
  success: boolean;
  events: RelevantEvent[];
  total: number;
  userProfile: {
    hasProfile: boolean;
    industryTerms: string[];
    icpTerms: string[];
    competitors: string[];
  };
  filters: {
    limit: number;
    daysAhead: number;
    minScore: number;
  };
}

export default function CalendarPage() {
  const [events, setEvents] = useState<RelevantEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [filters, setFilters] = useState({
    daysAhead: 90,
    minScore: 0.1,
    limit: 50,
  });
  const router = useRouter();

  const loadRelevantEvents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        limit: filters.limit.toString(),
        daysAhead: filters.daysAhead.toString(),
        minScore: filters.minScore.toString(),
      });

      const response = await fetch(`/api/events/relevant-calendar?${params}`);
      const data: CalendarResponse = await response.json();

      if (!response.ok) {
        throw new Error('Failed to load relevant events');
      }

      setEvents(data.events || []);
      setUserProfile(data.userProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load relevant events');
      console.error('Calendar load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRelevantEvents();
  }, [filters]);

  const breadcrumbs = [
    { label: "Calendar" }
  ];

  const handleFilterChange = (key: string, value: number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleRefresh = () => {
    loadRelevantEvents();
  };

  return (
    <>
      <PageHeader
        title="Relevant Events Calendar"
        subtitle="Upcoming events matched to your interests and profile"
        breadcrumbs={breadcrumbs}
        actions={
          <PageHeaderActions
            primary={{
              label: "Refresh",
              onClick: handleRefresh,
              loading
            }}
            secondary={{
              label: "Profile Settings",
              onClick: () => router.push('/admin')
            }}
          />
        }
      >
        <div className="mb-6">
          {/* Filter Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Filters</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Days Ahead
                </label>
                <select
                  value={filters.daysAhead}
                  onChange={(e) => handleFilterChange('daysAhead', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={30}>Next 30 days</option>
                  <option value={60}>Next 60 days</option>
                  <option value={90}>Next 90 days</option>
                  <option value={180}>Next 6 months</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Relevance Score
                </label>
                <select
                  value={filters.minScore}
                  onChange={(e) => handleFilterChange('minScore', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={0.05}>Low (0.05+)</option>
                  <option value={0.1}>Medium (0.1+)</option>
                  <option value={0.2}>High (0.2+)</option>
                  <option value={0.3}>Very High (0.3+)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Results
                </label>
                <select
                  value={filters.limit}
                  onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={25}>25 events</option>
                  <option value={50}>50 events</option>
                  <option value={100}>100 events</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filters Summary */}
          <div className="mt-4 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-medium text-green-900 dark:text-green-100">
                Current Calendar Filters
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                Next {filters.daysAhead} days
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                Min Score: {filters.minScore}
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                Max {filters.limit} events
              </span>
            </div>
          </div>

          {/* User Profile Summary */}
          {userProfile && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Your Profile Matches
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Industry Terms:</span>
                  <div className="text-blue-600 dark:text-blue-400 mt-1">
                    {userProfile.industryTerms.length > 0 
                      ? userProfile.industryTerms.slice(0, 3).join(', ') + (userProfile.industryTerms.length > 3 ? '...' : '')
                      : 'None set'
                    }
                  </div>
                </div>
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">ICP Terms:</span>
                  <div className="text-blue-600 dark:text-blue-400 mt-1">
                    {userProfile.icpTerms.length > 0 
                      ? userProfile.icpTerms.slice(0, 3).join(', ') + (userProfile.icpTerms.length > 3 ? '...' : '')
                      : 'None set'
                    }
                  </div>
                </div>
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Competitors:</span>
                  <div className="text-blue-600 dark:text-blue-400 mt-1">
                    {userProfile.competitors.length > 0 
                      ? userProfile.competitors.slice(0, 3).join(', ') + (userProfile.competitors.length > 3 ? '...' : '')
                      : 'None set'
                    }
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <button
                  onClick={() => router.push('/admin')}
                  className="text-xs text-blue-600 hover:text-blue-500 font-medium"
                >
                  Update your profile for better matches →
                </button>
              </div>
            </div>
          )}
        </div>
      </PageHeader>

      <ContentContainer>
        <div className="py-6">
          {loading ? (
            <SkeletonList count={5} />
          ) : error ? (
            <ErrorState
              title="Failed to load relevant events"
              message={error}
              action={{
                label: "Try Again",
                onClick: handleRefresh
              }}
            />
          ) : events.length === 0 ? (
            <EmptyEvents />
          ) : (
            <RelevantEventsCalendar 
              events={events}
              onRefresh={handleRefresh}
            />
          )}
        </div>
      </ContentContainer>
    </>
  );
}
