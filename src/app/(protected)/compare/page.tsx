/**
 * Event Comparison Page
 * 
 * This page provides the event comparison interface where users can
 * add events to compare and view side-by-side analysis.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';
import { EventData } from '@/lib/types/core';
import EventComparison from '@/components/EventComparison';
import { toast } from 'sonner';
// import { useUser } from '@supabase/auth-helpers-react';

/**
 * Event Comparison Page Component
 */
const ComparePage = memo(function ComparePage() {
  // const { user } = useUser();
  const user = null; // Mock for now
  const [comparisonEvents, setComparisonEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved comparison events
  useEffect(() => {
    const loadComparisonEvents = async () => {
      try {
        const response = await fetch('/api/events/comparison');
        if (response.ok) {
          const data = await response.json();
          setComparisonEvents(data.events || []);
        }
      } catch (error) {
        console.error('Failed to load comparison events:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadComparisonEvents();
  }, []);

  // Add event to comparison
  const addEventToComparison = useCallback(async (event: EventData) => {
    if (comparisonEvents.length >= 5) {
      toast.warning("Comparison limit reached", {
        description: "You can compare up to 5 events at a time. Remove an event to add another."
      });
      return;
    }

    if (comparisonEvents.some(e => e.id === event.id)) {
      toast.info("Event already added", {
        description: "This event is already in your comparison"
      });
      return;
    }

    const newEvents = [...comparisonEvents, event];
    setComparisonEvents(newEvents);

    // Save to server
    try {
      await fetch('/api/events/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: newEvents }),
      });
    } catch (error) {
      console.error('Failed to save comparison events:', error);
    }
  }, [comparisonEvents]);

  // Remove event from comparison
  const removeEventFromComparison = useCallback(async (eventId: string) => {
    const newEvents = comparisonEvents.filter(e => e.id !== eventId);
    setComparisonEvents(newEvents);

    // Save to server
    try {
      await fetch('/api/events/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: newEvents }),
      });
    } catch (error) {
      console.error('Failed to save comparison events:', error);
    }
  }, [comparisonEvents]);

  // Clear all events
  const clearComparison = useCallback(async () => {
    setComparisonEvents([]);

    // Save to server
    try {
      await fetch('/api/events/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [] }),
      });
    } catch (error) {
      console.error('Failed to clear comparison events:', error);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Event Comparison</h1>
          <p className="text-slate-600">
            Compare events side by side to make informed decisions. 
            Add events from the events page to get started.
          </p>
        </div>

        <EventComparison
          events={comparisonEvents}
          onRemoveEvent={removeEventFromComparison}
          onClearComparison={clearComparison}
        />

        {comparisonEvents.length === 0 && (
          <div className="mt-8 text-center">
            <div className="bg-white border border-slate-200 rounded-lg p-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No events to compare</h3>
              <p className="text-slate-600 mb-4">
                Add events to your comparison to see side-by-side analysis
              </p>
              <a
                href="/events"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Browse Events
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default ComparePage;
