import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { 
  CreateAgentRequest, 
  CreateAgentResponse,
  AgentType,
  OutreachAgentConfig
} from '@/lib/types/agents';

export const runtime = 'nodejs';

/**
 * POST /api/agents/create
 * Create a new AI agent instance
 */
export async function POST(req: NextRequest): Promise<NextResponse<CreateAgentResponse>> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body: CreateAgentRequest = await req.json();
    const { agentType, name, config } = body;

    // Validation
    if (!agentType || !['outreach', 'followup', 'planning', 'research'].includes(agentType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid agent type' },
        { status: 400 }
      );
    }

    if (!name || name.trim().length === 0 || name.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Name must be between 1 and 100 characters' },
        { status: 400 }
      );
    }

    // Check if agent of this type already exists
    const { data: existing } = await supabase
      .from('ai_agents')
      .select('id')
      .eq('user_id', user.id)
      .eq('agent_type', agentType)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Agent of type '${agentType}' already exists` },
        { status: 409 }
      );
    }

    // Set default config based on agent type
    let defaultConfig: any = {};
    if (agentType === 'outreach') {
      defaultConfig = {
        autoApprove: false,
        maxDailyOutreach: 10,
        messageTone: 'professional',
        includeEventContext: true,
        includeAccountIntelligence: true,
        notifyFollowupAgent: true,
        defaultFollowupDelayDays: 3,
        ...(config || {})
      } as OutreachAgentConfig;
    } else if (agentType === 'followup') {
      defaultConfig = {
        defaultFollowupDelayDays: 3,
        maxFollowups: 3,
        escalationAfterAttempts: 2,
        followupTypes: ['reminder', 'value_add'],
        ...(config || {})
      };
    } else if (agentType === 'planning') {
      defaultConfig = {
        minRelevanceScore: 50,
        maxOpportunitiesPerDay: 20,
        prioritizeBySignalStrength: true,
        coordinateWithOutreach: true,
        ...(config || {})
      };
    }

    // Set default capabilities
    const capabilities: string[] = [];
    if (agentType === 'outreach') {
      capabilities.push('draft_outreach');
    } else if (agentType === 'followup') {
      capabilities.push('schedule_followup', 'execute_followup');
    } else if (agentType === 'planning') {
      capabilities.push('analyze_opportunity', 'prioritize_opportunities');
    }

    // Create agent
    const { data: agent, error } = await supabase
      .from('ai_agents')
      .insert({
        user_id: user.id,
        agent_type: agentType,
        name: name.trim(),
        status: 'idle',
        config: defaultConfig,
        capabilities,
        last_active_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Failed to create agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: agent as any
    });
  } catch (error: any) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


