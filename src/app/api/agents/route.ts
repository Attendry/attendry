import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { AIAgent, AgentType, AgentStatus } from '@/lib/types/agents';

export const runtime = 'nodejs';

/**
 * GET /api/agents
 * Get all user's agents
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const agentType = searchParams.get('agentType') as AgentType | null;
    const status = searchParams.get('status') as AgentStatus | null;

    let query = supabase
      .from('ai_agents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (agentType) {
      query = query.eq('agent_type', agentType);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: agents, error } = await query;

    if (error) {
      // Check if table doesn't exist (migration not run)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          agents: [] as AIAgent[],
          message: 'Agent system not initialized. Please run database migrations.'
        });
      }
      return NextResponse.json(
        { success: false, error: error.message || 'Database error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agents: (agents || []) as AIAgent[]
    });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


