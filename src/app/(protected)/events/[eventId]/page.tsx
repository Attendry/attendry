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
      const supabase = supabaseBrowser();
      
      // Check if eventId is a board item ID (UUID) or optimized ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
      const isOptimizedId = eventId.startsWith('optimized_');
      
      let eventData: EventData | null = null;

      // First, try to get from board if it's a UUID (board item ID)
      if (isUUID) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: boardItem } = await supabase
            .from('user_event_board')
            .select('event_id, event_url, event_data')
            .eq('id', eventId)
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (boardItem) {
            // Try to get event from collected_events if we have event_id
            if (boardItem.event_id) {
              const { data: collectedEvent } = await supabase
                .from('collected_events')
                .select('*')
                .eq('id', boardItem.event_id)
                .single();
              
              if (collectedEvent) {
                eventData = collectedEvent as EventData;
              }
            }
            
            // If not found in collected_events, use event_data from board
            if (!eventData && boardItem.event_data) {
              eventData = boardItem.event_data as EventData;
            }
            
            // If still not found, try by event_url
            if (!eventData && boardItem.event_url) {
              const { data: eventByUrl } = await supabase
                .from('collected_events')
                .select('*')
                .eq('source_url', boardItem.event_url)
                .maybeSingle();
              
              if (eventByUrl) {
                eventData = eventByUrl as EventData;
              } else {
                // Create event data from URL if we have it
                eventData = {
                  source_url: boardItem.event_url,
                  title: 'Event',
                  id: eventId
                } as EventData;
              }
            }
          }
        }
      }

      // If not found in board, try collected_events directly
      if (!eventData) {
        const { data, error: fetchError } = await supabase
          .from('collected_events')
          .select('*')
          .or(`id.eq.${eventId},source_url.eq.${eventId}`)
          .maybeSingle();

        if (!fetchError && data) {
          eventData = data as EventData;
        }
      }

      // For optimized IDs, we can't load from DB - show error with helpful message
      if (!eventData && isOptimizedId) {
        setError('This event is from a search result and is not yet saved to the database. Please add it to your board first to view full intelligence.');
        return;
      }

      if (!eventData) {
        setError('Event not found');
        return;
      }

      setEvent(eventData);
    } catch (err: any) {
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
              {event.starts_at && (
                <span>{new Date(event.starts_at).toLocaleDateString()}</span>
              )}
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

