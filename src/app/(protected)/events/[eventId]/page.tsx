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

      // First, try to get from board if it's a UUID (board item ID)
      if (isUUID) {
        console.log('[EventDetailPage] Checking board for UUID:', eventId);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: boardItem } = await supabase
            .from('user_event_board')
            .select('event_id, event_url, event_data')
            .eq('id', eventId)
            .eq('user_id', user.id)
            .maybeSingle();
          
          console.log('[EventDetailPage] Board item found:', !!boardItem);
          
          if (boardItem) {
            // Try to get event from collected_events if we have event_id
            if (boardItem.event_id) {
              const { data: collectedEvent } = await supabase
                .from('collected_events')
                .select('*')
                .eq('id', boardItem.event_id)
                .maybeSingle();
              
              if (collectedEvent) {
                console.log('[EventDetailPage] Found event in collected_events by event_id');
                eventData = collectedEvent as EventData;
              }
            }
            
            // If not found in collected_events, use event_data from board
            if (!eventData && boardItem.event_data) {
              console.log('[EventDetailPage] Using event_data from board');
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
                console.log('[EventDetailPage] Found event in collected_events by event_url');
                eventData = eventByUrl as EventData;
              } else {
                // Create event data from URL if we have it
                console.log('[EventDetailPage] Creating event data from board URL');
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
        console.log('[EventDetailPage] Searching collected_events for:', eventId);
        
        // Try by ID first
        const { data: eventById, error: errorById } = await supabase
          .from('collected_events')
          .select('*')
          .eq('id', eventId)
          .maybeSingle();

        if (eventById) {
          console.log('[EventDetailPage] Found event by ID');
          eventData = eventById as EventData;
        } else {
          // Try by source_url (handle URL encoding variations)
          const normalizedUrl = eventId.replace(/\/$/, ''); // Remove trailing slash
          
          // Try exact match first
          let { data: eventByUrl, error: errorByUrl } = await supabase
            .from('collected_events')
            .select('*')
            .eq('source_url', eventId)
            .maybeSingle();

          // If not found and URL is different from normalized, try normalized
          if (!eventByUrl && normalizedUrl !== eventId) {
            const { data: eventByNormalizedUrl, error: errorByNormalized } = await supabase
              .from('collected_events')
              .select('*')
              .eq('source_url', normalizedUrl)
              .maybeSingle();
            
            if (eventByNormalizedUrl) {
              eventByUrl = eventByNormalizedUrl;
              errorByUrl = errorByNormalized;
            }
          }

          if (eventByUrl) {
            console.log('[EventDetailPage] Found event by source_url');
            eventData = eventByUrl as EventData;
          } else {
            console.log('[EventDetailPage] Event not found in collected_events', {
              errorById: errorById?.message,
              errorByUrl: errorByUrl?.message
            });
          }
        }
      }

      // If still not found and it's a URL, try checking board by URL
      if (!eventData && isUrl) {
        console.log('[EventDetailPage] Checking board by URL:', eventId);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: boardItem } = await supabase
            .from('user_event_board')
            .select('event_id, event_url, event_data')
            .eq('event_url', eventId)
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (boardItem && boardItem.event_data) {
            console.log('[EventDetailPage] Found event in board by URL');
            eventData = boardItem.event_data as EventData;
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

