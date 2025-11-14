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

    // Determine cache key - try to find actual UUID if event is in database
    let cacheKey = eventId;
    if (isOptimizedId && event.source_url) {
      // For optimized events, try to find the event in database by source_url
      const { data: dbEvent } = await supabase
        .from('collected_events')
        .select('id')
        .eq('source_url', event.source_url)
        .maybeSingle();
      
      if (dbEvent) {
        cacheKey = dbEvent.id; // Use UUID if found
      } else {
        cacheKey = event.source_url; // Use source_url as fallback
      }
    } else if (event.id && typeof event.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.id)) {
      cacheKey = event.id; // Use UUID from event object
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

    // Generate intelligence
    console.log('[EventIntelligence] About to generate intelligence...');
    console.log('[EventIntelligence] Event data:', {
      title: event.title,
      source_url: event.source_url,
      hasDescription: !!event.description,
      hasTopics: !!(event.topics && event.topics.length > 0),
      hasSpeakers: !!(event.speakers && event.speakers.length > 0),
      hasSponsors: !!(event.sponsors && event.sponsors.length > 0)
    });
    
    let intelligence;
    try {
      console.log('[EventIntelligence] Calling generateEventIntelligence...');
      intelligence = await generateEventIntelligence(
        event as any,
        userProfile || undefined
      );
      console.log('[EventIntelligence] Intelligence generated successfully');
    } catch (genError: any) {
      console.error('[EventIntelligence] Generation failed:', genError);
      console.error('[EventIntelligence] Error stack:', genError.stack);
      console.error('[EventIntelligence] Error details:', {
        message: genError.message,
        name: genError.name,
        cause: genError.cause
      });
      return NextResponse.json(
        { 
          error: 'Failed to generate intelligence',
          details: genError.message || 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Try to cache the result using the actual event ID
    try {
      await cacheEventIntelligence(
        actualEventId,
        intelligence,
        userProfile || undefined
      );
      console.log('[EventIntelligence] Intelligence cached successfully');
    } catch (cacheError) {
      // Log but don't fail - intelligence generation succeeded
      console.warn('[EventIntelligence] Cache failed (non-fatal):', cacheError);
    }
    
    // Update intelligence eventId to match what was used
    intelligence.eventId = cacheKey;

    const responseData = {
      ...intelligence,
      cached: false
    };

    console.log('[EventIntelligence] Returning intelligence response:', {
      eventId: responseData.eventId,
      hasDiscussions: !!responseData.discussions,
      hasSponsors: !!responseData.sponsors,
      hasLocation: !!responseData.location,
      hasOutreach: !!responseData.outreach,
      discussionsKeys: responseData.discussions ? Object.keys(responseData.discussions) : [],
      sponsorsKeys: responseData.sponsors ? Object.keys(responseData.sponsors) : [],
      locationKeys: responseData.location ? Object.keys(responseData.location) : [],
      outreachKeys: responseData.outreach ? Object.keys(responseData.outreach) : []
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Event intelligence generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate event intelligence' },
      { status: 500 }
    );
  }
}

