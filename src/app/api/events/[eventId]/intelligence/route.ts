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

    // Check if eventId is an optimized_ ID (temporary ID, not in DB)
    const isOptimizedId = eventId.startsWith('optimized_');
    
    // Get event from database
    let event: any = null;
    let eventError: any = null;
    
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

    // Check cache first
    const cachedIntelligence = await getEventIntelligence(eventId, userProfile || undefined);
    
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

    // Generate intelligence
    const intelligence = await generateEventIntelligence(
      event as any,
      userProfile || undefined
    );

    // Cache the result using the cache key (will look up UUID if needed)
    await cacheEventIntelligence(
      cacheKey,
      intelligence,
      userProfile || undefined
    );
    
    // Update intelligence eventId to match what was cached
    intelligence.eventId = cacheKey;

    return NextResponse.json({
      ...intelligence,
      cached: false
    });

  } catch (error) {
    console.error('Event intelligence generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate event intelligence' },
      { status: 500 }
    );
  }
}

