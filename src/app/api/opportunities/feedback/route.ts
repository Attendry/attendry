/**
 * PHASE 1: Opportunity Feedback API
 * 
 * POST /api/opportunities/feedback
 * 
 * Handles user feedback on opportunities (dismiss, save, etc.)
 * This enables the learning loop to improve future recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

interface FeedbackRequest {
  opportunityId: string;
  action: 'dismiss' | 'save' | 'actioned';
  reason?: 'not_icp' | 'irrelevant_event' | 'already_know' | 'bad_match';
}

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

    const body: FeedbackRequest = await req.json();
    const { opportunityId, action, reason } = body;

    if (!opportunityId || !action) {
      return NextResponse.json(
        { error: 'opportunityId and action are required' },
        { status: 400 }
      );
    }

    // Validate opportunity belongs to user
    const { data: opportunity, error: fetchError } = await supabase
      .from('user_opportunities')
      .select('id, status')
      .eq('id', opportunityId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !opportunity) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    // Update opportunity based on action
    const updateData: any = {
      status: action === 'dismiss' ? 'dismissed' : action === 'save' ? 'saved' : 'actioned'
    };

    if (action === 'dismiss' && reason) {
      updateData.dismissal_reason = reason;
    }

    if (action === 'actioned') {
      updateData.actioned_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('user_opportunities')
      .update(updateData)
      .eq('id', opportunityId);

    if (updateError) {
      console.error('[opportunities-feedback] Error updating opportunity:', updateError);
      return NextResponse.json(
        { error: 'Failed to update opportunity' },
        { status: 500 }
      );
    }

    // Log feedback for learning (future: use this to improve recommendations)
    console.log(JSON.stringify({
      at: 'opportunity_feedback',
      userId: user.id,
      opportunityId,
      action,
      reason,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: `Opportunity ${action} successfully`
    });
  } catch (error) {
    console.error('[opportunities-feedback] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

