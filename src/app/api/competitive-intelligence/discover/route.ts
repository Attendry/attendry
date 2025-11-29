/**
 * Competitive Intelligence Discovery API
 * 
 * Enhancement 4: Automated Competitor Discovery
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { supabaseServer } from '@/lib/supabase-server';
import { discoverCompetitors, approveCompetitorSuggestion } from '@/lib/services/competitor-discovery-service';
import { UserProfile } from '@/lib/types/core';

/**
 * GET /api/competitive-intelligence/discover
 * 
 * Get suggested competitors
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabaseClient = await supabaseServer();
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = supabaseAdmin();
    
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const userProfile: UserProfile = {
      id: profile.id,
      full_name: profile.full_name,
      company: profile.company,
      competitors: profile.competitors || [],
      icp_terms: profile.icp_terms || [],
      industry_terms: profile.industry_terms || []
    };

    // Discover competitors
    const suggestions = await discoverCompetitors(user.id, userProfile);

    return NextResponse.json({
      suggestions,
      count: suggestions.length
    });
  } catch (error: any) {
    console.error('[CompetitorDiscovery] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/competitive-intelligence/discover/approve
 * 
 * Approve or reject a competitor suggestion
 * 
 * Body: {
 *   companyName: string,
 *   approved: boolean
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabaseClient = await supabaseServer();
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { companyName, approved } = body;

    if (!companyName) {
      return NextResponse.json(
        { error: 'Missing required field: companyName' },
        { status: 400 }
      );
    }

    await approveCompetitorSuggestion(user.id, companyName, approved);

    return NextResponse.json({
      success: true,
      message: approved ? 'Competitor added to profile' : 'Suggestion rejected'
    });
  } catch (error: any) {
    console.error('[CompetitorDiscovery] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

