import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { AIAgent, AgentStatus, AgentConfig } from '@/lib/types/agents';

export const runtime = 'nodejs';

/**
 * GET /api/agents/[agentId]
 * Get specific agent details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
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

    const { agentId } = params;

    const { data: agent, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: agent as AIAgent
    });
  } catch (error: any) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/[agentId]
 * Update agent configuration or status
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { agentId: string } }
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

    const { agentId } = params;
    const body = await req.json();
    const { name, status, config } = body;

    // Verify ownership
    const { data: existing } = await supabase
      .from('ai_agents')
      .select('id, user_id')
      .eq('id', agentId)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: any = {};
    if (name !== undefined) {
      if (name.trim().length === 0 || name.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Name must be between 1 and 100 characters' },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    if (status !== undefined) {
      if (!['idle', 'active', 'waiting_approval', 'paused', 'error'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status' },
          { status: 400 }
        );
      }
      updates.status = status;
      if (status === 'active' || status === 'idle') {
        updates.last_active_at = new Date().toISOString();
      }
    }

    if (config !== undefined) {
      // Merge with existing config
      const { data: current } = await supabase
        .from('ai_agents')
        .select('config')
        .eq('id', agentId)
        .single();
      
      updates.config = { ...(current?.config || {}), ...config };
    }

    const { data: agent, error } = await supabase
      .from('ai_agents')
      .update(updates)
      .eq('id', agentId)
      .select()
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Failed to update agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: agent as AIAgent
    });
  } catch (error: any) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[agentId]
 * Delete an agent (cascades to tasks, drafts, etc.)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { agentId: string } }
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

    const { agentId } = params;

    // Verify ownership
    const { data: existing } = await supabase
      .from('ai_agents')
      .select('id, user_id')
      .eq('id', agentId)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Delete agent (cascades to related tables)
    const { error } = await supabase
      .from('ai_agents')
      .delete()
      .eq('id', agentId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true
    });
  } catch (error: any) {
    console.error('Error deleting agent:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


