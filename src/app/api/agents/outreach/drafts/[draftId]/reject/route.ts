import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { RejectDraftRequest } from '@/lib/types/agents';

export const runtime = 'nodejs';

/**
 * POST /api/agents/outreach/drafts/[draftId]/reject
 * Reject a draft with feedback
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { draftId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { draftId } = params;
    const body: RejectDraftRequest = await req.json();
    const { reason } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Get draft and verify ownership
    const { data: draft, error: draftError } = await supabase
      .from('agent_outreach_drafts')
      .select(`
        *,
        agent:ai_agents!inner(user_id)
      `)
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json(
        { success: false, error: 'Draft not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if ((draft.agent as any).user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (draft.status !== 'pending_approval' && draft.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: `Draft cannot be rejected. Current status: ${draft.status}` },
        { status: 400 }
      );
    }

    // Update draft
    const { error: updateError } = await supabase
      .from('agent_outreach_drafts')
      .update({
        status: 'rejected',
        rejection_reason: reason.trim()
      })
      .eq('id', draftId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.rpc('log_agent_activity', {
      p_agent_id: draft.agent_id,
      p_task_id: draft.task_id,
      p_action_type: 'draft_rejected',
      p_description: `Draft rejected: ${reason.substring(0, 100)}`,
      p_metadata: { draftId: draft.id, reason: reason.trim() }
    });

    return NextResponse.json({
      success: true
    });
  } catch (error: any) {
    console.error('Error rejecting draft:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


