/**
 * Event Detail Page
 * 
 * Dedicated page for full event intelligence view
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { EventData } from '@/lib/types/core';
import { EventIntelligencePanel } from '@/components/EventIntelligencePanel';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import EventCard from '@/components/EventCard';

// Helper function to safely format date
function formatEventDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  
  // Skip invalid date strings
  if (dateString === 'Unknown Date' || dateString.includes(' to ')) {
    return null;
  }
  
  try {
    const date = new Date(dateString);
    // Check if date is valid (not Invalid Date)
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleDateString();
  } catch (e) {
    return null;
  }
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = decodeURIComponent(params.eventId as string);
  
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = supabaseBrowser();
      
      console.log('[EventDetailPage] Loading event with ID:', eventId);
      
      // Check if eventId is a board item ID (UUID) or optimized ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
      const isOptimizedId = eventId.startsWith('optimized_');
      const isUrl = eventId.startsWith('http://') || eventId.startsWith('https://');
      
      let eventData: EventData | null = null;

      // OPTIMIZATION: Run queries in parallel where possible
      const { data: { user } } = await supabase.auth.getUser();
      
      // Prepare parallel queries
      const queries: Promise<any>[] = [];
      
      // Query 1: Check board if UUID
      if (isUUID && user) {
        queries.push(
          supabase
            .from('user_event_board')
            .select('event_id, event_url, event_data')
            .eq('id', eventId)
            .eq('user_id', user.id)
            .maybeSingle()
            .then(({ data }) => ({ type: 'board', data }))
        );
      }
      
      // Query 2: Check collected_events by ID
      queries.push(
        supabase
          .from('collected_events')
          .select('*')
          .eq('id', eventId)
          .maybeSingle()
          .then(({ data }) => ({ type: 'byId', data }))
      );
      
      // Query 3: Check collected_events by URL (if it's a URL)
      if (isUrl) {
        const normalizedUrl = eventId.replace(/\/$/, '');
        queries.push(
          supabase
            .from('collected_events')
            .select('*')
            .eq('source_url', eventId)
            .maybeSingle()
            .then(({ data }) => ({ type: 'byUrl', data }))
        );
        
        // Also try normalized URL
        if (normalizedUrl !== eventId) {
          queries.push(
            supabase
              .from('collected_events')
              .select('*')
              .eq('source_url', normalizedUrl)
              .maybeSingle()
              .then(({ data }) => ({ type: 'byNormalizedUrl', data }))
          );
        }
      }
      
      // Query 4: Check board by URL (if it's a URL and user exists)
      if (isUrl && user) {
        queries.push(
          supabase
            .from('user_event_board')
            .select('event_id, event_url, event_data')
            .eq('event_url', eventId)
            .eq('user_id', user.id)
            .maybeSingle()
            .then(({ data }) => ({ type: 'boardByUrl', data }))
        );
      }
      
      // Execute all queries in parallel
      const results = await Promise.all(queries);
      
      // Process results in priority order
      for (const result of results) {
        if (!result.data) continue;
        
        if (result.type === 'board' && result.data) {
          const boardItem = result.data;
          // Try to get event from collected_events if we have event_id
          if (boardItem.event_id) {
            const { data: collectedEvent } = await supabase
              .from('collected_events')
              .select('*')
              .eq('id', boardItem.event_id)
              .maybeSingle();
            
            if (collectedEvent) {
              eventData = collectedEvent as EventData;
              break;
            }
          }
          
          // Use event_data from board if available
          if (boardItem.event_data) {
            eventData = boardItem.event_data as EventData;
            break;
          }
          
          // Try by event_url if available
          if (boardItem.event_url) {
            const { data: eventByUrl } = await supabase
              .from('collected_events')
              .select('*')
              .eq('source_url', boardItem.event_url)
              .maybeSingle();
            
            if (eventByUrl) {
              eventData = eventByUrl as EventData;
              break;
            }
          }
        } else if ((result.type === 'byId' || result.type === 'byUrl' || result.type === 'byNormalizedUrl') && result.data) {
          eventData = result.data as EventData;
          break;
        } else if (result.type === 'boardByUrl' && result.data) {
          const boardItem = result.data;
          if (boardItem.event_data) {
            eventData = boardItem.event_data as EventData;
            break;
          }
        }
      }

      // For optimized IDs, we can't load from DB - show error with helpful message
      if (!eventData && isOptimizedId) {
        console.log('[EventDetailPage] Optimized ID detected, event not in database');
        setError('This event is from a search result and is not yet saved to the database. Please add it to your board first to view full intelligence.');
        return;
      }

      if (!eventData) {
        console.error('[EventDetailPage] Event not found after all attempts:', {
          eventId,
          isUUID,
          isOptimizedId,
          isUrl
        });
        setError('Event not found. The event may not be in the database yet. Try adding it to your board first.');
        return;
      }

      console.log('[EventDetailPage] Event loaded successfully:', {
        id: eventData.id,
        title: eventData.title,
        source_url: eventData.source_url
      });
      setEvent(eventData);
    } catch (err: any) {
      console.error('[EventDetailPage] Error loading event:', err);
      setError(err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading event...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Event Not Found</h2>
          <p className="text-slate-600 mb-4">{error || 'The event you are looking for does not exist.'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{event.title}</h1>
            <div className="flex items-center gap-4 text-slate-600">
              {(() => {
                const formattedDate = formatEventDate(event.starts_at);
                return formattedDate ? <span>{formattedDate}</span> : null;
              })()}
              {(event.city || event.country) && (
                <span>{[event.city, event.country].filter(Boolean).join(', ')}</span>
              )}
            </div>
          </div>
          {event.source_url && (
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ExternalLink className="h-4 w-4" />
              View Original
            </a>
          )}
        </div>
      </div>

      {/* Event Card */}
      <div className="mb-8">
        <EventCard ev={event as any} />
      </div>

      {/* Intelligence Panel */}
      <div className="mb-8">
        <EventIntelligencePanel eventId={eventId} event={event} />
      </div>
    </div>
  );
}

