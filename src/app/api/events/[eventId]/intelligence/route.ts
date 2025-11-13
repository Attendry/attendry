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

    // Get event from database
    const { data: event, error: eventError } = await supabase
      .from('collected_events')
      .select('*')
      .or(`id.eq.${eventId},source_url.eq.${eventId}`)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
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

    // Get event from database
    const { data: event, error: eventError } = await supabase
      .from('collected_events')
      .select('*')
      .or(`id.eq.${eventId},source_url.eq.${eventId}`)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
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

    // Generate intelligence
    const intelligence = await generateEventIntelligence(
      event as any,
      userProfile || undefined
    );

    // Cache the result
    await cacheEventIntelligence(
      eventId,
      intelligence,
      userProfile || undefined
    );

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

