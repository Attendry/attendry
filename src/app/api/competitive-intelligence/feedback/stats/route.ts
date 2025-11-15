/**
 * Competitive Intelligence Feedback Statistics API
 * 
 * Enhancement 1: Analytics and Reporting
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/competitive-intelligence/feedback/stats
 * 
 * Get feedback statistics and analytics
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

    // Get all feedback for user
    let feedbackQuery = supabase
      .from('competitor_match_feedback')
      .select('*')
      .eq('user_id', user.id);

    if (competitorName) {
      feedbackQuery = feedbackQuery.eq('competitor_name', competitorName);
    }

    const { data: feedback, error: feedbackError } = await feedbackQuery;

    if (feedbackError) {
      console.error('[FeedbackStats] Error fetching feedback:', feedbackError);
      return NextResponse.json(
        { error: 'Failed to fetch feedback', details: feedbackError.message },
        { status: 500 }
      );
    }

    // Calculate statistics
    const total = feedback?.length || 0;
    const correct = feedback?.filter(f => f.is_correct).length || 0;
    const incorrect = feedback?.filter(f => !f.is_correct).length || 0;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    // Get match type breakdown
    const matchTypeStats = {
      speaker: { total: 0, correct: 0, incorrect: 0 },
      sponsor: { total: 0, correct: 0, incorrect: 0 },
      attendee: { total: 0, correct: 0, incorrect: 0 },
      organizer: { total: 0, correct: 0, incorrect: 0 }
    };

    feedback?.forEach(f => {
      const type = f.match_type as keyof typeof matchTypeStats;
      if (matchTypeStats[type]) {
        matchTypeStats[type].total++;
        if (f.is_correct) {
          matchTypeStats[type].correct++;
        } else {
          matchTypeStats[type].incorrect++;
        }
      }
    });

    // Get most common corrections
    const corrections = feedback
      ?.filter(f => !f.is_correct && f.user_correction)
      .map(f => f.user_correction)
      .filter((c): c is string => c !== null)
      .reduce((acc, correction) => {
        acc[correction] = (acc[correction] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

    const topCorrections = Object.entries(corrections)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([correction, count]) => ({ correction, count }));

    // Get learned rules count
    const { data: rules, error: rulesError } = await supabase
      .from('competitor_matching_rules')
      .select('id')
      .or(`user_id.is.null,user_id.eq.${user.id}`);

    const learnedRulesCount = rules?.length || 0;

    // Get exclusions count
    const { data: exclusions, error: exclusionsError } = await supabase
      .from('competitor_exclusions')
      .select('id')
      .eq('user_id', user.id);

    const exclusionsCount = exclusions?.length || 0;

    return NextResponse.json({
      statistics: {
        total,
        correct,
        incorrect,
        accuracy: Math.round(accuracy * 100) / 100,
        matchTypeStats,
        topCorrections,
        learnedRulesCount,
        exclusionsCount
      },
      feedback: feedback || []
    });
  } catch (error: any) {
    console.error('[FeedbackStats] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

