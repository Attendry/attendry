/**
 * POST /api/contacts/[contactId]/auto-workflow
 * Automatically trigger research and draft generation workflow
 * 
 * This endpoint:
 * 1. Checks if research exists, triggers if missing
 * 2. If preferences are complete, automatically assigns and processes outreach agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { researchContact, saveContactResearch, getContactResearch } from '@/lib/services/contact-research-service';
import { OutreachAgent } from '@/lib/agents/outreach-agent';
import { queueAgentTask } from '@/lib/services/job-queue';
import { DraftOutreachTaskInput, OutreachChannel } from '@/lib/types/agents';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { contactId: string } }
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

    const { contactId } = params;

    // Get contact with preferences
    const { data: contact, error: contactError } = await supabase
      .from('saved_speaker_profiles')
      .select('*')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    const results = {
      researchTriggered: false,
      researchCompleted: false,
      draftTriggered: false,
      draftCompleted: false,
      errors: [] as string[],
    };

    // Step 1: Check and trigger research if missing
    let research = await getContactResearch(user.id, contactId);
    
    if (!research || !research.background_info) {
      console.log(`[Auto-Workflow] Research missing for contact ${contactId}, triggering research...`);
      results.researchTriggered = true;

      try {
        const name = contact.speaker_data?.name || 'Unknown';
        const company = contact.speaker_data?.org || contact.speaker_data?.organization || 'Unknown';
        
        // Research the contact
        const researchResult = await researchContact(name, company);
        
        // Save to database
        research = await saveContactResearch(user.id, contactId, researchResult);
        results.researchCompleted = true;
        console.log(`[Auto-Workflow] Research completed for contact ${contactId}`);
      } catch (error: any) {
        console.error(`[Auto-Workflow] Failed to research contact:`, error);
        results.errors.push(`Research failed: ${error.message}`);
        // Continue anyway - draft can be generated without research
      }
    } else {
      console.log(`[Auto-Workflow] Research already exists for contact ${contactId}`);
    }

    // Step 2: Check if preferences are complete and trigger draft
    const hasPreferences = 
      contact.preferred_language && 
      contact.preferred_tone && 
      contact.preferred_channel;

    if (hasPreferences) {
      console.log(`[Auto-Workflow] Preferences complete, triggering draft generation...`);
      results.draftTriggered = true;

      try {
        // Get or create Outreach Agent
        let { data: agents, error: agentsError } = await supabase
          .from('ai_agents')
          .select('*')
          .eq('user_id', user.id)
          .eq('agent_type', 'outreach')
          .eq('status', 'active')
          .limit(1);

        if (agentsError) {
          throw new Error(`Failed to fetch agent: ${agentsError.message}`);
        }

        let agentId: string;
        if (!agents || agents.length === 0) {
          // Create a default Outreach Agent
          const { data: newAgent, error: createError } = await supabase
            .from('ai_agents')
            .insert({
              user_id: user.id,
              agent_type: 'outreach',
              name: 'Outreach Agent',
              status: 'active',
              capabilities: ['draft_outreach'],
              config: {
                autoApprove: false,
                maxDailyOutreach: 10,
                messageTone: (contact.preferred_tone as string).toLowerCase(),
                includeEventContext: true,
                includeAccountIntelligence: true,
                notifyFollowupAgent: true,
                defaultFollowupDelayDays: 3,
              },
            })
            .select()
            .single();

          if (createError || !newAgent) {
            throw new Error(`Failed to create agent: ${createError?.message}`);
          }

          agentId = newAgent.id;
        } else {
          agentId = agents[0].id;
        }

        // Check if there's already a pending or in-progress task for this contact
        const { data: existingTasks } = await supabase
          .from('agent_tasks')
          .select('id, status')
          .eq('agent_id', agentId)
          .eq('task_type', 'draft_outreach')
          .in('status', ['pending', 'in_progress'])
          .eq('input_data->>contactId', contactId)
          .limit(1);

        if (existingTasks && existingTasks.length > 0) {
          console.log(`[Auto-Workflow] Task already exists for contact ${contactId}, skipping`);
          return NextResponse.json({
            success: true,
            message: 'Task already in progress',
            ...results,
            taskId: existingTasks[0].id,
          });
        }

        // Create task
        const taskInput: DraftOutreachTaskInput = {
          contactId,
          channel: (contact.preferred_channel as OutreachChannel) || 'email',
          context: {
            preferredLanguage: (contact.preferred_language as string) || 'English',
            preferredTone: (contact.preferred_tone as string) || 'Formal',
          },
        };

        const { data: task, error: taskError } = await supabase
          .from('agent_tasks')
          .insert({
            agent_id: agentId,
            task_type: 'draft_outreach',
            status: 'pending',
            priority: 'high',
            input_data: taskInput,
            requires_approval: false,
          })
          .select()
          .single();

        if (taskError || !task) {
          throw new Error(`Failed to create task: ${taskError?.message}`);
        }

        // Queue and process task immediately
        try {
          await queueAgentTask(agentId, task.id, 'outreach', 'high');
          console.log(`[Auto-Workflow] Task queued and processing for contact ${contactId}`);
          results.draftCompleted = true;
        } catch (queueError: any) {
          console.error(`[Auto-Workflow] Queue error (task still created):`, queueError);
          // Task is created, will be processed by cron job
          results.errors.push(`Queue error: ${queueError.message}`);
        }

        return NextResponse.json({
          success: true,
          message: 'Workflow triggered successfully',
          ...results,
          taskId: task.id,
        });
      } catch (error: any) {
        console.error(`[Auto-Workflow] Failed to trigger draft:`, error);
        results.errors.push(`Draft generation failed: ${error.message}`);
        return NextResponse.json({
          success: false,
          error: error.message || 'Failed to trigger draft generation',
          ...results,
        }, { status: 500 });
      }
    } else {
      console.log(`[Auto-Workflow] Preferences incomplete for contact ${contactId}`);
      return NextResponse.json({
        success: true,
        message: 'Research completed, waiting for preferences',
        ...results,
      });
    }
  } catch (error: any) {
    console.error('[Auto-Workflow] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

