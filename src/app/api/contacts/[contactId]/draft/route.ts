import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { OutreachAgent } from "@/lib/agents/outreach-agent";
import { DraftOutreachTaskInput, OutreachChannel } from "@/lib/types/agents";

export const runtime = 'nodejs';

/**
 * POST /api/contacts/[contactId]/draft
 * Generate an outreach draft for a contact using the Outreach Agent
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const contactId = params.contactId;
    const body = await req.json();
    const {
      language = "English",
      tone = "Formal",
      channel = "email",
      opportunityId,
    } = body;

    // Verify contact ownership
    const { data: contact, error: contactError } = await supabase
      .from("saved_speaker_profiles")
      .select("*")
      .eq("id", contactId)
      .eq("user_id", user.id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }

    // Get or create Outreach Agent for user
    let { data: agents, error: agentsError } = await supabase
      .from("ai_agents")
      .select("*")
      .eq("user_id", user.id)
      .eq("agent_type", "outreach")
      .eq("status", "active")
      .limit(1);

    if (agentsError) {
      console.error("Error fetching agents:", agentsError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch agent" },
        { status: 500 }
      );
    }

    let agentId: string;
    if (!agents || agents.length === 0) {
      // Create a default Outreach Agent
      const { data: newAgent, error: createError } = await supabase
        .from("ai_agents")
        .insert({
          user_id: user.id,
          agent_type: "outreach",
          name: "Outreach Agent",
          status: "active",
          capabilities: ["draft_outreach"],
          config: {
            autoApprove: false,
            maxDailyOutreach: 10,
            messageTone: tone.toLowerCase(),
            includeEventContext: true,
            includeAccountIntelligence: true,
            notifyFollowupAgent: true,
            defaultFollowupDelayDays: 3,
          },
        })
        .select()
        .single();

      if (createError || !newAgent) {
        console.error("Error creating agent:", createError);
        return NextResponse.json(
          { success: false, error: "Failed to create agent" },
          { status: 500 }
        );
      }

      agentId = newAgent.id;
    } else {
      agentId = agents[0].id;
    }

    // Initialize Outreach Agent
    const outreachAgent = new OutreachAgent(agentId);
    await outreachAgent.initialize();

    // Create a task for draft generation
    const taskInput: DraftOutreachTaskInput = {
      contactId,
      opportunityId: opportunityId || undefined,
      channel: channel as OutreachChannel,
      context: {
        preferredLanguage: language,
        preferredTone: tone,
      },
    };

    // Create task record
    const { data: task, error: taskError } = await supabase
      .from("agent_tasks")
      .insert({
        agent_id: agentId,
        task_type: "draft_outreach",
        status: "pending",
        priority: "high",
        input_data: taskInput,
        requires_approval: false, // We'll handle approval separately
      })
      .select()
      .single();

    if (taskError || !task) {
      console.error("Error creating task:", taskError);
      return NextResponse.json(
        { success: false, error: "Failed to create task" },
        { status: 500 }
      );
    }

    // Process the task
    const result = await outreachAgent.processTask(task);

    if (!result.success || !result.output) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to generate draft",
        },
        { status: 500 }
      );
    }

    // Fetch the created draft with full details
    const { data: draft, error: draftError } = await supabase
      .from("agent_outreach_drafts")
      .select("*")
      .eq("id", result.output.draftId)
      .single();

    if (draftError || !draft) {
      console.error("Error fetching draft:", draftError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch draft" },
        { status: 500 }
      );
    }

    // Update task status
    await supabase
      .from("agent_tasks")
      .update({ status: "completed" })
      .eq("id", task.id);

    return NextResponse.json({
      success: true,
      draft: {
        id: draft.id,
        subject: draft.subject,
        messageBody: draft.message_body,
        channel: draft.channel,
        personalizationContext: draft.personalization_context,
      },
    });
  } catch (error: any) {
    console.error("API Error in contact draft generation:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

