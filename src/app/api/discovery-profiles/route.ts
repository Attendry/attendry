/**
 * PHASE 2: Discovery Profile API
 * 
 * POST /api/discovery-profiles
 * Create or update a user's discovery profile
 * 
 * GET /api/discovery-profiles
 * Get user's discovery profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      industries,
      regions,
      target_titles,
      target_companies,
      competitors,
      discovery_frequency,
      enable_critical_alerts
    } = body;

    // Validate required fields
    if (!industries || industries.length === 0) {
      return NextResponse.json(
        { error: 'At least one industry is required' },
        { status: 400 }
      );
    }

    if (!regions || regions.length === 0) {
      return NextResponse.json(
        { error: 'At least one region is required' },
        { status: 400 }
      );
    }

    // Upsert discovery profile
    const { data: profile, error } = await supabase
      .from('user_discovery_profiles')
      .upsert({
        user_id: user.id,
        industries: industries || [],
        event_types: [], // Can be added later
        regions: regions || [],
        target_titles: target_titles || [],
        target_companies: target_companies || [],
        competitors: competitors || [],
        discovery_frequency: discovery_frequency || 'daily',
        min_relevance_score: 50,
        enable_critical_alerts: enable_critical_alerts ?? true
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('[discovery-profiles] Error creating profile:', error);
      return NextResponse.json(
        { error: 'Failed to create discovery profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('[discovery-profiles] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data: profile, error } = await supabase
      .from('user_discovery_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[discovery-profiles] Error fetching profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch discovery profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: profile || null
    });
  } catch (error) {
    console.error('[discovery-profiles] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



