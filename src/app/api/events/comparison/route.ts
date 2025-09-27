/**
 * Event Comparison API
 * 
 * This endpoint manages event comparison data for users,
 * allowing them to save and retrieve comparison lists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { EventData } from '@/lib/types/core';

/**
 * Comparison request/response
 */
interface ComparisonRequest {
  events: EventData[];
}

interface ComparisonResponse {
  events: EventData[];
  message?: string;
}

/**
 * GET /api/events/comparison
 */
export async function GET(): Promise<NextResponse<ComparisonResponse>> {
  try {
    const supabase = createServerComponentClient({ cookies });
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { events: [], message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's comparison events
    const { data: profile } = await supabase
      .from('profiles')
      .select('comparison_events')
      .eq('id', session.user.id)
      .single();

    const events = profile?.comparison_events || [];

    return NextResponse.json({ events });

  } catch (error) {
    console.error('Get comparison events error:', error);
    return NextResponse.json(
      { events: [], message: 'Failed to load comparison events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/comparison
 */
export async function POST(req: NextRequest): Promise<NextResponse<ComparisonResponse>> {
  try {
    const supabase = createServerComponentClient({ cookies });
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { events: [], message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { events }: ComparisonRequest = await req.json();

    if (!Array.isArray(events)) {
      return NextResponse.json(
        { events: [], message: 'Invalid events data' },
        { status: 400 }
      );
    }

    // Limit to 5 events
    const limitedEvents = events.slice(0, 5);

    // Save comparison events to user profile
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        comparison_events: limitedEvents,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Save comparison events error:', error);
      return NextResponse.json(
        { events: [], message: 'Failed to save comparison events' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events: limitedEvents,
      message: 'Comparison events saved successfully',
    });

  } catch (error) {
    console.error('Save comparison events error:', error);
    return NextResponse.json(
      { events: [], message: 'Failed to save comparison events' },
      { status: 500 }
    );
  }
}
