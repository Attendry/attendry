import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ApproveDraftRequest, AgentOutreachDraft } from '@/lib/types/agents';
import { sendOutreachEmail } from '@/lib/services/email-service';

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

    // Get contact information for sending
    const { data: contact } = await supabase
      .from('saved_speaker_profiles')
      .select('speaker_data, email')
      .eq('id', draft.contact_id)
      .single();

    // Send message via appropriate channel
    let sentRecord = null;
    let sentAt: string | null = null;
    let deliveryStatus = 'pending';
    let errorMessage: string | null = null;

    if (updatedDraft.channel === 'email' && contact?.email) {
      const emailResult = await sendOutreachEmail(
        contact.email,
        updatedDraft.subject || 'Follow-up',
        updatedDraft.message_body,
        {
          fromName: process.env.EMAIL_FROM_NAME,
        }
      );

      sentAt = new Date().toISOString();
      
      if (emailResult.success) {
        deliveryStatus = emailResult.blocked ? 'pending' : 'sent';
        
        // Create sent record
        const { data: sentData } = await supabase
          .from('agent_outreach_sent')
          .insert({
            draft_id: draftId,
            agent_id: draft.agent_id,
            contact_id: draft.contact_id,
            opportunity_id: draft.opportunity_id,
            channel: 'email',
            recipient_email: contact.email,
            recipient_name: contact.speaker_data?.name || null,
            subject: updatedDraft.subject,
            message_body: updatedDraft.message_body,
            sent_at: sentAt,
            delivery_status: deliveryStatus,
            metadata: {
              messageId: emailResult.messageId,
              blocked: emailResult.blocked || false,
            },
          })
          .select()
          .single();

        sentRecord = sentData;

        if (emailResult.blocked) {
          console.log('[Approve Draft] Email sending is blocked - message not actually sent');
        }
      } else {
        deliveryStatus = 'failed';
        errorMessage = emailResult.error || 'Failed to send email';
        
        // Still create sent record to track the failure
        const { data: sentData } = await supabase
          .from('agent_outreach_sent')
          .insert({
            draft_id: draftId,
            agent_id: draft.agent_id,
            contact_id: draft.contact_id,
            opportunity_id: draft.opportunity_id,
            channel: 'email',
            recipient_email: contact.email,
            recipient_name: contact.speaker_data?.name || null,
            subject: updatedDraft.subject,
            message_body: updatedDraft.message_body,
            sent_at: sentAt,
            delivery_status: 'failed',
            error_message: errorMessage,
          })
          .select()
          .single();

        sentRecord = sentData;
      }
    } else if (updatedDraft.channel === 'linkedin') {
      // LinkedIn integration will be added in future phase
      console.log('[Approve Draft] LinkedIn sending not yet implemented');
      deliveryStatus = 'pending';
      errorMessage = 'LinkedIn integration not yet implemented';
    }

    // Update draft with sent_at and status
    await supabase
      .from('agent_outreach_drafts')
      .update({ 
        status: sentAt ? 'sent' : 'approved',
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
        status: sentAt ? 'sent' : 'approved',
        sent_at: sentAt
      } as AgentOutreachDraft,
      sentRecord,
      emailBlocked: updatedDraft.channel === 'email' && deliveryStatus === 'pending' && !errorMessage,
    });
  } catch (error: any) {
    console.error('Error approving draft:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


