/**
 * User Activity Tracker Component
 * 
 * This component tracks and displays user activity for personalized
 * recommendations and analytics.
 */

"use client";
import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

/**
 * Activity event types
 */
type ActivityType = 
  | 'search'
  | 'view_event'
  | 'save_event'
  | 'unsave_event'
  | 'view_speaker'
  | 'filter_change'
  | 'location_change'
  | 'industry_select';

/**
 * Activity event interface
 */
interface ActivityEvent {
  id: string;
  type: ActivityType;
  timestamp: number;
  data: Record<string, any>;
  sessionId: string;
}

/**
 * Activity summary interface
 */
interface ActivitySummary {
  totalSearches: number;
  totalEventViews: number;
  totalSavedEvents: number;
  mostSearchedTerms: string[];
  mostViewedIndustries: string[];
  mostViewedLocations: string[];
  lastActivity: number;
  sessionCount: number;
}

/**
 * User Activity Tracker Component
 */
const UserActivityTracker = memo(function UserActivityTracker() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [summary, setSummary] = useState<ActivitySummary>({
    totalSearches: 0,
    totalEventViews: 0,
    totalSavedEvents: 0,
    mostSearchedTerms: [],
    mostViewedIndustries: [],
    mostViewedLocations: [],
    lastActivity: 0,
    sessionCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Generate session ID
  const sessionId = useMemo(() => {
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('activity_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('activity_session_id', sessionId);
      }
      return sessionId;
    }
    return 'server_session';
  }, []);

  // Load user activity
  useEffect(() => {
    const loadActivity = async () => {
      const supabase = supabaseBrowser();
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.warn('UserActivityTracker: failed to load session', error);
      }

      if (!session?.user) {
        setIsAuthenticated(false);
        setActivities([]);
        setSummary({
          totalSearches: 0,
          totalEventViews: 0,
          totalSavedEvents: 0,
          mostSearchedTerms: [],
          mostViewedIndustries: [],
          mostViewedLocations: [],
          lastActivity: 0,
          sessionCount: 0,
        });
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);

      try {
        const response = await fetch('/api/profile/get');
        if (response.ok) {
          const data = await response.json();
          if (data.profile?.activity) {
            setActivities(data.profile.activity);
            setSummary(calculateSummary(data.profile.activity));
          }
        }
      } catch (error) {
        console.error('Failed to load user activity:', error);
      }

      setIsLoading(false);
    };

    loadActivity();
  }, []);

  // Calculate activity summary
  const calculateSummary = useCallback((activities: ActivityEvent[]): ActivitySummary => {
    const searches = activities.filter(a => a.type === 'search');
    const eventViews = activities.filter(a => a.type === 'view_event');
    const savedEvents = activities.filter(a => a.type === 'save_event');
    
    const searchTerms = searches
      .map(s => s.data.query)
      .filter(Boolean)
      .reduce((acc, term) => {
        acc[term] = (acc[term] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const industries = activities
      .filter(a => a.data.industry)
      .map(a => a.data.industry)
      .reduce((acc, industry) => {
        acc[industry] = (acc[industry] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const locations = activities
      .filter(a => a.data.location)
      .map(a => a.data.location)
      .reduce((acc, location) => {
        acc[location] = (acc[location] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const uniqueSessions = new Set(activities.map(a => a.sessionId)).size;

    return {
      totalSearches: searches.length,
      totalEventViews: eventViews.length,
      totalSavedEvents: savedEvents.length,
      mostSearchedTerms: Object.entries(searchTerms)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([term]) => term),
      mostViewedIndustries: Object.entries(industries)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([industry]) => industry),
      mostViewedLocations: Object.entries(locations)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([location]) => location),
      lastActivity: activities.length > 0 ? Math.max(...activities.map(a => a.timestamp)) : 0,
      sessionCount: uniqueSessions,
    };
  }, []);

  // Track activity
  const trackActivity = useCallback(async (type: ActivityType, data: Record<string, any> = {}) => {
    if (!isAuthenticated) return;

    const activity: ActivityEvent = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      data,
      sessionId,
    };

    // Update local state
    setActivities(prev => {
      const newActivities = [...prev, activity].slice(-100); // Keep last 100 activities
      setSummary(calculateSummary(newActivities));
      return newActivities;
    });

    // Save to server
    try {
      await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: [...activities, activity].slice(-100),
        }),
      });
    } catch (error) {
      console.error('Failed to save activity:', error);
    }
  }, [isAuthenticated, activities, sessionId, calculateSummary]);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Activity Summary</h1>
        <p className="text-slate-600">Your activity and engagement insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Total Searches */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Total Searches</p>
              <p className="text-2xl font-bold text-slate-900">{summary.totalSearches}</p>
            </div>
          </div>
        </div>

        {/* Event Views */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Event Views</p>
              <p className="text-2xl font-bold text-slate-900">{summary.totalEventViews}</p>
            </div>
          </div>
        </div>

        {/* Saved Events */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Saved Events</p>
              <p className="text-2xl font-bold text-slate-900">{summary.totalSavedEvents}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Searched Terms */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Most Searched Terms</h2>
          {summary.mostSearchedTerms.length > 0 ? (
            <div className="space-y-2">
              {summary.mostSearchedTerms.map((term, index) => (
                <div key={term} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{term}</span>
                  <span className="text-xs text-slate-500">#{index + 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No search history yet</p>
          )}
        </div>

        {/* Most Viewed Industries */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Most Viewed Industries</h2>
          {summary.mostViewedIndustries.length > 0 ? (
            <div className="space-y-2">
              {summary.mostViewedIndustries.map((industry, index) => (
                <div key={industry} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{industry}</span>
                  <span className="text-xs text-slate-500">#{index + 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No industry preferences yet</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-6 bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.slice(-10).reverse().map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-slate-700">
                    {activity.type === 'search' && `Searched for "${activity.data.query}"`}
                    {activity.type === 'view_event' && `Viewed event "${activity.data.title}"`}
                    {activity.type === 'save_event' && `Saved event "${activity.data.title}"`}
                    {activity.type === 'unsave_event' && `Removed event "${activity.data.title}"`}
                    {activity.type === 'filter_change' && `Changed filters`}
                    {activity.type === 'location_change' && `Changed location to ${activity.data.location}`}
                    {activity.type === 'industry_select' && `Selected industry ${activity.data.industry}`}
                  </span>
                </div>
                <span className="text-xs text-slate-500">{formatTimestamp(activity.timestamp)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No recent activity</p>
        )}
      </div>
    </div>
  );
});

// Export the trackActivity function for use in other components
export { UserActivityTracker };
export type { ActivityType, ActivityEvent };

// Hook for tracking activity
export const useActivityTracker = () => {
  const trackActivity = useCallback(async (type: ActivityType, data: Record<string, any> = {}) => {
    // This would be implemented to call the tracking API
    console.log('Tracking activity:', type, data);
  }, []);

  return { trackActivity };
};
