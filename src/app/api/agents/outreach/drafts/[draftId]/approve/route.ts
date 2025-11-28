import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ApproveDraftRequest, AgentOutreachDraft } from '@/lib/types/agents';

export const runtime = 'nodejs';

/**
 * POST /api/agents/outreach/drafts/[draftId]/approve
 * Approve and send an outreach draft
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
    const body: ApproveDraftRequest = await req.json();
    const { edits } = body;

    // Get draft and verify ownership
    const { data: draft, error: draftError } = await supabase
      .from('agent_outreach_drafts')
      .select(`
        *,
        agent:ai_agents!inner(user_id, agent_type, config)
      `)
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json(
        { success: false, error: 'Draft not found' },
        { status: 404 }
      );
    }

    // Verify ownership through agent
    if ((draft.agent as any).user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (draft.status !== 'pending_approval' && draft.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: `Draft cannot be approved. Current status: ${draft.status}` },
        { status: 400 }
      );
    }

    // Apply edits if provided
    const updateData: any = {
      status: 'approved',
      approved_at: new Date().toISOString()
    };

    if (edits) {
      if (edits.subject !== undefined) {
        updateData.subject = edits.subject;
      }
      if (edits.messageBody !== undefined) {
        updateData.message_body = edits.messageBody;
      }
    }

    // Update draft
    const { data: updatedDraft, error: updateError } = await supabase
      .from('agent_outreach_drafts')
      .update(updateData)
      .eq('id', draftId)
      .select()
      .single();

    if (updateError || !updatedDraft) {
      return NextResponse.json(
        { success: false, error: updateError?.message || 'Failed to update draft' },
        { status: 500 }
      );
    }

    // Send message via appropriate channel
    const sentAt = await sendOutreachMessage(updatedDraft as AgentOutreachDraft);

    // Update draft with sent_at
    await supabase
      .from('agent_outreach_drafts')
      .update({ 
        status: 'sent',
        sent_at: sentAt 
      })
      .eq('id', draftId);

    // Update contact's outreach_status
    await supabase
      .from('saved_speaker_profiles')
      .update({ 
        outreach_status: 'contacted',
        last_updated: new Date().toISOString()
      })
      .eq('id', draft.contact_id);

    // Log activity
    await supabase.rpc('log_agent_activity', {
      p_agent_id: draft.agent_id,
      p_task_id: draft.task_id,
      p_action_type: 'message_sent',
      p_description: `Sent ${draft.channel} message to contact`,
      p_metadata: { draftId: draft.id, channel: draft.channel }
    });

    // Update metrics
    const today = new Date().toISOString().split('T')[0];
    const { data: existingMetrics } = await supabase
      .from('agent_performance_metrics')
      .select('*')
      .eq('agent_id', draft.agent_id)
      .eq('metric_date', today)
      .single();

    if (existingMetrics) {
      await supabase
        .from('agent_performance_metrics')
        .update({ messages_sent: (existingMetrics.messages_sent || 0) + 1 })
        .eq('id', existingMetrics.id);
    } else {
      await supabase
        .from('agent_performance_metrics')
        .insert({
          agent_id: draft.agent_id,
          metric_date: today,
          messages_sent: 1
        });
    }

    return NextResponse.json({
      success: true,
      draft: {
        ...updatedDraft,
        status: 'sent',
        sent_at: sentAt
      } as AgentOutreachDraft
    });
  } catch (error: any) {
    console.error('Error approving draft:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Send outreach message via appropriate channel
 * For Phase 1, this is a placeholder - actual sending would integrate with email/LinkedIn APIs
 */
async function sendOutreachMessage(draft: AgentOutreachDraft): Promise<string> {
  // TODO: Integrate with actual email/LinkedIn sending services
  // For now, just return current timestamp to simulate sending
  
  if (draft.channel === 'email') {
    // Would use email service (SendGrid, Resend, etc.)
    console.log(`[SIMULATED] Sending email to contact ${draft.contact_id}`);
    console.log(`Subject: ${draft.subject}`);
    console.log(`Body: ${draft.message_body.substring(0, 100)}...`);
  } else if (draft.channel === 'linkedin') {
    // Would use LinkedIn API
    console.log(`[SIMULATED] Sending LinkedIn message to contact ${draft.contact_id}`);
    console.log(`Message: ${draft.message_body.substring(0, 100)}...`);
  }

  return new Date().toISOString();
}


