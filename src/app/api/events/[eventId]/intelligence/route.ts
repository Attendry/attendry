/**
 * Event Intelligence API
 * 
 * Provides deep insights for a specific event
 * Pre-computed and cached for fast retrieval
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { supabaseServer } from '@/lib/supabase-server';
import { UserProfile } from '@/lib/types/core';
import {
  getEventIntelligence,
  generateEventIntelligence,
  cacheEventIntelligence,
  precomputeIntelligenceForEvent
} from '@/lib/services/event-intelligence-service';
import { queueIntelligenceGeneration } from '@/lib/services/intelligence-queue';

/**
 * GET /api/events/[eventId]/intelligence
 * 
 * Get event intelligence (cached or generate)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { eventId: string } }
): Promise<NextResponse> {
  try {
    const eventId = decodeURIComponent(params.eventId);
    const supabase = supabaseAdmin();

    // Get user profile for personalization
    let userProfile: UserProfile | null = null;
    try {
      const supabaseServerClient = await supabaseServer();
      const { data: { user } } = await supabaseServerClient.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          userProfile = {
            id: profile.id,
            full_name: profile.full_name,
            company: profile.company,
            competitors: profile.competitors || [],
            icp_terms: profile.icp_terms || [],
            industry_terms: profile.industry_terms || [],
            use_in_basic_search: profile.use_in_basic_search ?? true
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load user profile for intelligence:', error);
      // Continue without personalization
    }

    // Check if eventId is a board item ID (UUID format)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
    const isOptimizedId = eventId.startsWith('optimized_');
    const isUrl = eventId.startsWith('http://') || eventId.startsWith('https://');
    
    // Get event from database
    let event: any = null;
    let eventError: any = null;
    let actualEventId = eventId; // For caching
    
    // First, check if it's a board item ID
    if (isUUID) {
      const supabaseServerClient = await supabaseServer();
      const { data: { user } } = await supabaseServerClient.auth.getUser();
      
      if (user) {
        const { data: boardItem } = await supabase
          .from('user_event_board')
          .select('event_id, event_url, event_data')
          .eq('id', eventId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (boardItem) {
          // Use event_id if available, otherwise use event_url
          if (boardItem.event_id) {
            actualEventId = boardItem.event_id;
          } else if (boardItem.event_url) {
            actualEventId = boardItem.event_url;
          }
        }
      }
    }
    
    if (isOptimizedId) {
      // For optimized IDs, we can't query by ID (it's not a UUID)
      // Check cache by source_url if we can extract it from the event
      // For now, return not found - POST will handle generation with event data
      return NextResponse.json({
        eventId,
        status: 'not_generated',
        message: 'Intelligence not yet generated. Use POST to generate.',
        cached: false,
        isOptimized: true
      });
    } else if (isUrl) {
      // Try to find event by source_url
      const { data: eventByUrl } = await supabase
        .from('collected_events')
        .select('*')
        .eq('source_url', eventId)
        .maybeSingle();
      
      if (eventByUrl) {
        event = eventByUrl;
        actualEventId = eventByUrl.id;
      } else {
        eventError = new Error('Event not found by URL');
      }
    } else {
      // Try to find by UUID first, then by source_url
      const { data: eventById, error: errorById } = await supabase
        .from('collected_events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();
      
      if (eventById) {
        event = eventById;
      } else {
        // Try by source_url
        const { data: eventByUrl, error: errorByUrl } = await supabase
          .from('collected_events')
          .select('*')
          .eq('source_url', eventId)
          .maybeSingle();
        
        if (eventByUrl) {
          event = eventByUrl;
        } else {
          eventError = errorByUrl || errorById;
        }
      }
    }

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found in database' },
        { status: 404 }
      );
    }

    // Check cache first using actual event ID
    const cachedIntelligence = await getEventIntelligence(actualEventId, userProfile || undefined);
    
    if (cachedIntelligence) {
      return NextResponse.json({
        ...cachedIntelligence,
        cached: true
      });
    }

    // If not cached, return status indicating generation needed
    // In production, this could trigger background generation
    return NextResponse.json({
      eventId,
      status: 'not_generated',
      message: 'Intelligence not yet generated. Use POST to generate.',
      cached: false
    });

  } catch (error) {
    console.error('Event intelligence error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event intelligence' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[eventId]/intelligence
 * 
 * Generate event intelligence (if not cached)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { eventId: string } }
): Promise<NextResponse> {
  try {
    const eventId = decodeURIComponent(params.eventId);
    const supabase = supabaseAdmin();

    // Get user profile for personalization
    let userProfile: UserProfile | null = null;
    try {
      const supabaseServerClient = await supabaseServer();
      const { data: { user } } = await supabaseServerClient.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          userProfile = {
            id: profile.id,
            full_name: profile.full_name,
            company: profile.company,
            competitors: profile.competitors || [],
            icp_terms: profile.icp_terms || [],
            industry_terms: profile.industry_terms || [],
            use_in_basic_search: profile.use_in_basic_search ?? true
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load user profile for intelligence:', error);
      // Continue without personalization
    }

    // Check if eventId is an optimized_ ID (temporary ID, not in DB)
    const isOptimizedId = eventId.startsWith('optimized_');
    
    // Get event from database or request body
    let event: any = null;
    let eventError: any = null;
    
    if (isOptimizedId) {
      // For optimized IDs, try to get event data from request body
      try {
        const body = await req.json().catch(() => ({}));
        if (body.event) {
          event = body.event;
        } else {
          // Try to find by source_url if available
          if (body.source_url) {
            const { data: eventByUrl } = await supabase
              .from('collected_events')
              .select('*')
              .eq('source_url', body.source_url)
              .maybeSingle();
            
            if (eventByUrl) {
              event = eventByUrl;
            } else {
              // Use the event data from body if available
              event = body;
            }
          } else {
            return NextResponse.json(
              { error: 'Event data required for optimized events. Please provide event data in request body.' },
              { status: 400 }
            );
          }
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to parse event data from request body' },
          { status: 400 }
        );
      }
    } else {
      // Try to find by UUID first, then by source_url
      const { data: eventById, error: errorById } = await supabase
        .from('collected_events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();
      
      if (eventById) {
        event = eventById;
      } else {
        // Try by source_url
        const { data: eventByUrl, error: errorByUrl } = await supabase
          .from('collected_events')
          .select('*')
          .eq('source_url', eventId)
          .maybeSingle();
        
        if (eventByUrl) {
          event = eventByUrl;
        } else {
          eventError = errorByUrl || errorById;
        }
      }
    }

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found in database' },
        { status: 404 }
      );
    }

    // Determine cache key - use source_url as unique identifier for optimized events
    let cacheKey = eventId;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
    const isUrl = eventId.startsWith('http://') || eventId.startsWith('https://');
    
    // First, check if it's a board item ID
    if (isUUID) {
      const supabaseServerClient = await supabaseServer();
      const { data: { user } } = await supabaseServerClient.auth.getUser();
      
      if (user) {
        const { data: boardItem } = await supabase
          .from('user_event_board')
          .select('event_id, event_url, event_data')
          .eq('id', eventId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (boardItem) {
          // Use event_id if available, otherwise use event_url
          if (boardItem.event_id) {
            cacheKey = boardItem.event_id;
          } else if (boardItem.event_url) {
            cacheKey = boardItem.event_url;
          }
        }
      }
    }
    
    if (isOptimizedId && event.source_url) {
      // For optimized events, use source_url as unique identifier
      cacheKey = event.source_url;
      
      // Try to find the event in database by source_url to get UUID
      const { data: dbEvent } = await supabase
        .from('collected_events')
        .select('id')
        .eq('source_url', event.source_url)
        .maybeSingle();
      
      if (dbEvent) {
        cacheKey = dbEvent.id; // Use UUID if found for better caching
      }
    } else if (event.id && typeof event.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.id)) {
      cacheKey = event.id; // Use UUID from event object
    } else if (event.source_url) {
      cacheKey = event.source_url; // Use source_url as fallback
    }
    
    // Check cache first
    const cachedIntelligence = await getEventIntelligence(cacheKey, userProfile || undefined);
    
    if (cachedIntelligence) {
      return NextResponse.json({
        ...cachedIntelligence,
        cached: true
      });
    }

    // If event is not in database, try to save it first (for caching purposes)
    let actualEventId = cacheKey;
    if (isOptimizedId || !event.id || typeof event.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.id)) {
      // Event not in database, try to save it
      try {
        const { data: existing } = await supabase
          .from('collected_events')
          .select('id')
          .eq('source_url', event.source_url || cacheKey)
          .maybeSingle();
        
        if (existing) {
          actualEventId = existing.id;
        } else if (event.source_url) {
          // Save event to database for future caching
          const eventData = {
            title: event.title || 'Event',
            starts_at: event.starts_at || null,
            ends_at: event.ends_at || null,
            city: event.city || null,
            country: event.country || null,
            venue: event.venue || null,
            organizer: event.organizer || null,
            description: event.description || null,
            topics: event.topics || [],
            speakers: event.speakers || [],
            sponsors: event.sponsors || [],
            participating_organizations: event.participating_organizations || [],
            partners: event.partners || [],
            competitors: event.competitors || [],
            source_url: event.source_url,
            source_domain: event.source_url ? new URL(event.source_url).hostname : null,
            extraction_method: 'search',
            confidence: event.confidence || 0.7,
            verification_status: 'unverified'
          };
          
          const { data: savedEvent, error: saveError } = await supabase
            .from('collected_events')
            .insert(eventData)
            .select('id')
            .single();
          
          if (savedEvent && !saveError) {
            actualEventId = savedEvent.id;
            console.log(`[EventIntelligence] Saved event to database: ${actualEventId}`);
          }
        }
      } catch (saveError) {
        // Log but continue - we can still generate intelligence without saving
        console.warn('[EventIntelligence] Failed to save event to database:', saveError);
      }
    } else {
      actualEventId = event.id;
    }

    // For user-initiated requests (priority 8), generate intelligence synchronously
    // For background requests, queue for async processing
    const priority = 8; // User-initiated request
    const isUserInitiated = priority >= 8;
    
    if (isUserInitiated) {
      // Generate intelligence immediately for user requests
      console.log('[EventIntelligence] Generating intelligence synchronously for user request...');
      console.log('[EventIntelligence] Event data:', {
        title: event.title,
        source_url: event.source_url,
        hasDescription: !!event.description,
        hasTopics: !!(event.topics && event.topics.length > 0),
        hasSpeakers: !!(event.speakers && event.speakers.length > 0),
        hasSponsors: !!(event.sponsors && event.sponsors.length > 0)
      });
      
      try {
        // Generate intelligence synchronously
        const intelligence = await generateEventIntelligence(event, userProfile);
        
        // Cache the intelligence
        await cacheEventIntelligence(actualEventId, intelligence, userProfile?.id);
        
        console.log('[EventIntelligence] Intelligence generated successfully');
        
        return NextResponse.json({
          eventId: cacheKey,
          status: 'completed',
          intelligence,
          cached: false,
          queued: false
        });
      } catch (genError) {
        console.error('[EventIntelligence] Failed to generate intelligence synchronously:', genError);
        // Fall back to queuing if synchronous generation fails
        console.log('[EventIntelligence] Falling back to async queue...');
      }
    }
    
    // PERF-2.3.4: Queue intelligence generation in background for non-user requests or if sync fails
    // This allows the API to return immediately while intelligence is generated asynchronously
    console.log('[EventIntelligence] Queueing intelligence generation in background...');
    console.log('[EventIntelligence] Event data:', {
      title: event.title,
      source_url: event.source_url,
      hasDescription: !!event.description,
      hasTopics: !!(event.topics && event.topics.length > 0),
      hasSpeakers: !!(event.speakers && event.speakers.length > 0),
      hasSponsors: !!(event.sponsors && event.sponsors.length > 0)
    });
    
    // Queue intelligence generation (non-blocking)
    // Priority 8 = high priority for user-initiated requests
    try {
      await queueIntelligenceGeneration(actualEventId, priority);
      console.log('[EventIntelligence] Intelligence generation queued successfully');
    } catch (queueError) {
      console.warn('[EventIntelligence] Failed to queue intelligence generation:', queueError);
      // Continue - we'll return a pending status
    }

    // PERF-2.3.4: Return immediately with pending status
    // Frontend can poll the GET endpoint or use SSE to check when intelligence is ready
    const responseData = {
      eventId: cacheKey,
      status: 'queued',
      message: 'Intelligence generation queued and will be available shortly',
      cached: false,
      queued: true
    };

    console.log('[EventIntelligence] Returning queued status response');

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Event intelligence generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate event intelligence' },
      { status: 500 }
    );
  }
}

