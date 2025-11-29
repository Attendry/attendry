import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ActivityItem } from '@/components/dashboard/ActivityStream';

interface DashboardSummaryResponse {
  success: boolean;
  summary?: {
    urgent: {
      opportunities: number;
      contacts: number;
      events: number;
    };
    today: {
      opportunities: number;
      contacts: number;
      agentTasks: number;
    };
    week: {
      events: number;
      contacts: number;
      meetings: number;
      trends?: { up: number; down: number };
    };
    activities: ActivityItem[];
  };
  error?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse<DashboardSummaryResponse>> {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - 7));
    const weekAgo = new Date(now.setDate(now.getDate() - 7));
    const twoDaysFromNow = new Date(now.setTime(now.getTime() + 2 * 24 * 60 * 60 * 1000));

    // Urgent: Critical opportunities, contacts needing follow-up, events starting soon
    const [urgentOpportunities, urgentContacts, urgentEvents] = await Promise.all([
      // Opportunities with critical urgency
      supabase
        .from('user_opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'new')
        .or('relevance->>signal_strength.eq.strong,action_timing->>urgency.eq.critical')
        .then(({ count }) => count || 0),

      // Contacts that need follow-up (contacted > 3 days ago, no response)
      supabase
        .from('saved_speaker_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('outreach_status', 'contacted')
        .lt('last_contacted_at', new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .then(({ count }) => count || 0),

      // Events starting in next 48 hours
      supabase
        .from('event_board_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('event->>starts_at', now.toISOString())
        .lte('event->>starts_at', twoDaysFromNow.toISOString())
        .then(({ count }) => count || 0),
    ]);

    // Today: New opportunities, contacts ready for outreach, agent tasks
    const [todayOpportunities, todayContacts, agentTasks] = await Promise.all([
      // Opportunities created today
      supabase
        .from('user_opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'new')
        .gte('created_at', todayStart.toISOString())
        .then(({ count }) => count || 0),

      // Contacts ready for first outreach
      supabase
        .from('saved_speaker_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('outreach_status', 'not_started')
        .then(({ count }) => count || 0),

      // Agent tasks pending approval
      supabase
        .from('agent_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending_approval')
        .then(({ count }) => count || 0),
    ]);

    // Week: Events, contacts, meetings, trends
    const [weekEvents, weekContacts, weekMeetings, weekEventsLastWeek] = await Promise.all([
      // Events this week
      supabase
        .from('event_board_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', weekStart.toISOString())
        .then(({ count }) => count || 0),

      // Contacts added this week
      supabase
        .from('saved_speaker_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('saved_at', weekStart.toISOString())
        .then(({ count }) => count || 0),

      // Meetings scheduled this week
      supabase
        .from('saved_speaker_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('outreach_status', 'meeting_scheduled')
        .gte('saved_at', weekStart.toISOString())
        .then(({ count }) => count || 0),

      // Events from last week (for trend comparison)
      supabase
        .from('event_board_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', weekAgo.toISOString())
        .lt('created_at', weekStart.toISOString())
        .then(({ count }) => count || 0),
    ]);

    const weekTrend = weekEventsLastWeek > 0 
      ? weekEvents - weekEventsLastWeek 
      : 0;

    // Activities: Recent opportunities, contacts, events, agent actions
    const [opportunities, contacts, events, agentActivities] = await Promise.all([
      // Recent opportunities
      supabase
        .from('user_opportunities')
        .select('id, status, created_at, event')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => data || []),

      // Recent contacts
      supabase
        .from('saved_speaker_profiles')
        .select('id, outreach_status, saved_at, speaker_data')
        .eq('user_id', userId)
        .order('saved_at', { ascending: false })
        .limit(5)
        .then(({ data }) => data || []),

      // Recent events
      supabase
        .from('event_board_items')
        .select('id, created_at, event')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => data || []),

      // Recent agent activities
      supabase
        .from('agent_drafts')
        .select('id, created_at, agent_type, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => data || []),
    ]);

    // Build activity stream
    const activities: ActivityItem[] = [
      ...opportunities.map((opp: any) => ({
        id: `opp-${opp.id}`,
        type: 'opportunity' as const,
        title: `New opportunity: ${opp.event?.title || 'Untitled Event'}`,
        description: opp.status === 'new' ? 'Ready for review' : undefined,
        timestamp: opp.created_at,
        actionUrl: `/opportunities?id=${opp.id}`,
      })),
      ...contacts.map((contact: any) => ({
        id: `contact-${contact.id}`,
        type: 'contact' as const,
        title: `Contact ${contact.outreach_status === 'not_started' ? 'ready' : contact.outreach_status}: ${contact.speaker_data?.name || 'Unknown'}`,
        timestamp: contact.saved_at,
        actionUrl: `/contacts?id=${contact.id}`,
      })),
      ...events.map((event: any) => ({
        id: `event-${event.id}`,
        type: 'event' as const,
        title: `Event added: ${event.event?.title || 'Untitled Event'}`,
        timestamp: event.created_at,
        actionUrl: `/events-board?id=${event.id}`,
      })),
      ...agentActivities.map((agent: any) => ({
        id: `agent-${agent.id}`,
        type: 'agent' as const,
        title: `Agent ${agent.agent_type} ${agent.status === 'pending_approval' ? 'needs approval' : 'completed task'}`,
        timestamp: agent.created_at,
        actionUrl: agent.status === 'pending_approval' ? `/agents/approvals?id=${agent.id}` : undefined,
      })),
    ].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    }).slice(0, 10);

    return NextResponse.json({
      success: true,
      summary: {
        urgent: {
          opportunities: urgentOpportunities,
          contacts: urgentContacts,
          events: urgentEvents,
        },
        today: {
          opportunities: todayOpportunities,
          contacts: todayContacts,
          agentTasks: agentTasks,
        },
        week: {
          events: weekEvents,
          contacts: weekContacts,
          meetings: weekMeetings,
          trends: weekTrend !== 0 ? { up: weekTrend > 0 ? weekTrend : 0, down: weekTrend < 0 ? Math.abs(weekTrend) : 0 } : undefined,
        },
        activities,
      },
    });
  } catch (error: any) {
    console.error('Dashboard summary error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

