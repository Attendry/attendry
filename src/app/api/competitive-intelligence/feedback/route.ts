/**
 * Competitive Intelligence Feedback API
 * 
 * Enhancement 1: User Feedback Mechanism
 * Allows users to provide feedback on competitor matches to improve accuracy
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * POST /api/competitive-intelligence/feedback
 * 
 * Submit feedback on a competitor match
 * 
 * Body: {
 *   eventId: string,
 *   competitorName: string,
 *   matchedName: string,
 *   matchType: 'speaker' | 'sponsor' | 'attendee' | 'organizer',
 *   isCorrect: boolean,
 *   correction?: string,
 *   reason?: string
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
    const {
      eventId,
      competitorName,
      matchedName,
      matchType,
      isCorrect,
      correction,
      reason
    } = body;

    // Validation
    if (!competitorName || !matchedName || !matchType) {
      return NextResponse.json(
        { error: 'Missing required fields: competitorName, matchedName, matchType' },
        { status: 400 }
      );
    }

    if (!['speaker', 'sponsor', 'attendee', 'organizer'].includes(matchType)) {
      return NextResponse.json(
        { error: 'Invalid matchType. Must be one of: speaker, sponsor, attendee, organizer' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // Store feedback
    const { data: feedback, error: feedbackError } = await supabase
      .from('competitor_match_feedback')
      .insert({
        user_id: user.id,
        event_id: eventId || null,
        competitor_name: competitorName,
        matched_name: matchedName,
        match_type: matchType,
        is_correct: isCorrect,
        user_correction: correction || null,
        feedback_reason: reason || null,
        confidence_score: null // Will be populated from match if available
      })
      .select()
      .single();

    if (feedbackError) {
      console.error('[CompetitiveFeedback] Error storing feedback:', feedbackError);
      return NextResponse.json(
        { error: 'Failed to store feedback', details: feedbackError.message },
        { status: 500 }
      );
    }

    // If feedback is negative (not correct), create exclusion rule
    if (!isCorrect) {
      // Check if exclusion already exists
      const { data: existingExclusion } = await supabase
        .from('competitor_exclusions')
        .select('id')
        .eq('user_id', user.id)
        .eq('competitor_name', competitorName)
        .eq('excluded_pattern', matchedName)
        .maybeSingle();

      if (!existingExclusion) {
        await supabase
          .from('competitor_exclusions')
          .insert({
            user_id: user.id,
            competitor_name: competitorName,
            excluded_pattern: matchedName,
            reason: reason || 'User marked as incorrect match'
          });
      }
    }

    // If feedback is positive (correct) and we have a pattern, update matching rules
    if (isCorrect && matchedName !== competitorName) {
      // This is a valid pattern (e.g., "Competitor Corp Inc" matches "Competitor Corp")
      const { data: existingRule } = await supabase
        .from('competitor_matching_rules')
        .select('id, feedback_count')
        .eq('competitor_name', competitorName)
        .eq('learned_pattern', matchedName)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingRule) {
        // Increment feedback count
        await supabase
          .from('competitor_matching_rules')
          .update({
            feedback_count: existingRule.feedback_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRule.id);
      } else {
        // Create new rule
        await supabase
          .from('competitor_matching_rules')
          .insert({
            competitor_name: competitorName,
            learned_pattern: matchedName,
            confidence: 0.8, // Start with moderate confidence
            feedback_count: 1,
            user_id: user.id
          });
      }
    }

    return NextResponse.json({
      success: true,
      feedback: {
        id: feedback.id,
        message: 'Feedback recorded successfully'
      }
    });
  } catch (error: any) {
    console.error('[CompetitiveFeedback] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/competitive-intelligence/feedback
 * 
 * Get feedback statistics for a user
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

    const { searchParams } = new URL(req.url);
    const competitorName = searchParams.get('competitor');

    const supabase = supabaseAdmin();

    let query = supabase
      .from('competitor_match_feedback')
      .select('*')
      .eq('user_id', user.id);

    if (competitorName) {
      query = query.eq('competitor_name', competitorName);
    }

    const { data: feedback, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[CompetitiveFeedback] Error fetching feedback:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feedback', details: error.message },
        { status: 500 }
      );
    }

    // Calculate statistics
    const total = feedback?.length || 0;
    const correct = feedback?.filter(f => f.is_correct).length || 0;
    const incorrect = feedback?.filter(f => !f.is_correct).length || 0;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    return NextResponse.json({
      feedback: feedback || [],
      statistics: {
        total,
        correct,
        incorrect,
        accuracy: Math.round(accuracy * 100) / 100
      }
    });
  } catch (error: any) {
    console.error('[CompetitiveFeedback] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

