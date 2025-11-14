export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EventInsightsService } from "@/lib/services/event-insights-service";
import { getEventIntelligence, generateEventIntelligence } from "@/lib/services/event-intelligence-service";
import { UserProfile } from "@/lib/types/core";
import { EventInsightsResponse, AttendeeInsight, TrendInsight, PositioningRecommendation } from "@/lib/types/event-board";

/**
 * GET /api/events/board/insights/[eventId]
 * 
 * Get enhanced event insights using the new EventIntelligenceService
 * Falls back to EventInsightsService if intelligence not available
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> | { eventId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        error: "Not authenticated" 
      }, { status: 401 });
    }

    // Handle both Promise and direct params (Next.js 13 vs 15)
    const resolvedParams = params instanceof Promise ? await params : params;
    const eventId = resolvedParams.eventId;

    // Get user profile for personalization
    let userProfile: UserProfile | null = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userRes.user.id)
        .single();
      
      if (profile) {
        userProfile = {
          id: profile.id,
          full_name: profile.full_name,
          company: profile.company,
          competitors: profile.competitors || [],
          icp_terms: profile.icp_terms || [],
          industry_terms: profile.industry_terms || [],
          use_in_basic_search: profile.use_in_basic_search ?? true
        };
      }
    } catch (error) {
      console.warn('[Board Insights] Failed to load user profile:', error);
    }

    // Try to get event intelligence first (Phase 1B: enhanced insights)
    try {
      // Check if eventId is a board item ID (UUID)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
      let actualEventId = eventId;
      let eventData: any = null;

      if (isUUID) {
        // Try to get board item to find the actual event
        const { data: boardItem } = await supabase
          .from('user_event_board')
          .select('event_id, event_url, event_data')
          .eq('id', eventId)
          .eq('user_id', userRes.user.id)
          .maybeSingle();
        
        if (boardItem) {
          if (boardItem.event_id) {
            actualEventId = boardItem.event_id;
          } else if (boardItem.event_url) {
            actualEventId = boardItem.event_url;
          }
          if (boardItem.event_data) {
            eventData = boardItem.event_data;
          }
        }
      }

      // Try to get or generate event intelligence
      let intelligence = await getEventIntelligence(actualEventId, userProfile || undefined);
      
      if (!intelligence && eventData) {
        // Generate intelligence if we have event data
        intelligence = await generateEventIntelligence(eventData, userProfile || undefined);
      }

      if (intelligence) {
        // Get full event data if we don't have it yet
        if (!eventData && actualEventId) {
          const supabaseAdminClient = supabaseAdmin();
          const { data: fullEvent } = await supabaseAdminClient
            .from('collected_events')
            .select('*')
            .or(`id.eq.${actualEventId},source_url.eq.${actualEventId}`)
            .maybeSingle();
          
          if (fullEvent) {
            eventData = fullEvent;
          }
        }

        // Transform EventIntelligence to EventInsightsResponse format
        const insights: EventInsightsResponse = {
          attendees: extractAttendeesFromIntelligence(intelligence, eventData),
          trends: extractTrendsFromIntelligence(intelligence, eventData),
          positioning: extractPositioningFromIntelligence(intelligence)
        };

        return NextResponse.json(insights);
      }
    } catch (intelligenceError) {
      console.warn('[Board Insights] Failed to get event intelligence, falling back to basic insights:', intelligenceError);
    }

    // Fallback to basic EventInsightsService
    const insights = await EventInsightsService.getEventInsights(eventId, userRes.user.id);
    return NextResponse.json(insights);
  } catch (e: any) {
    console.error('[Board Insights API] Error:', e);
    return NextResponse.json({ 
      error: e?.message || "Failed to generate insights" 
    }, { status: 500 });
  }
}

/**
 * Extract attendees from event intelligence and event data
 */
function extractAttendeesFromIntelligence(intelligence: any, eventData?: any): AttendeeInsight[] {
  const attendees: AttendeeInsight[] = [];

  // First, extract from actual event data (most reliable)
  if (eventData) {
    // Extract speakers from event data
    if (eventData.speakers && Array.isArray(eventData.speakers)) {
      eventData.speakers.forEach((speaker: any) => {
        if (speaker && speaker.name) {
          attendees.push({
            name: speaker.name,
            company: speaker.org || speaker.company,
            role: 'speaker',
            title: speaker.title,
            confidence: speaker.confidence || 0.8
          });
        }
      });
    }

    // Extract sponsors from event data
    if (eventData.sponsors && Array.isArray(eventData.sponsors)) {
      eventData.sponsors.forEach((sponsor: any) => {
        const name = typeof sponsor === 'string' ? sponsor : sponsor.name;
        if (name) {
          attendees.push({
            name: name,
            company: typeof sponsor === 'object' ? sponsor.company : undefined,
            role: 'sponsor',
            confidence: 0.9
          });
        }
      });
    }

    // Extract participating organizations
    if (eventData.participating_organizations && Array.isArray(eventData.participating_organizations)) {
      eventData.participating_organizations.forEach((org: string) => {
        attendees.push({
          name: org,
          company: org,
          role: 'attendee',
          confidence: 0.7
        });
      });
    }
  }

  // If we don't have event data, try to extract from intelligence
  if (attendees.length === 0) {
    // Extract from sponsors in intelligence
    if (intelligence.sponsors?.tiers) {
      intelligence.sponsors.tiers.forEach((tier: any) => {
        tier.sponsors?.forEach((sponsor: any) => {
          const name = typeof sponsor === 'string' ? sponsor : sponsor.name;
          if (name) {
            attendees.push({
              name: name,
              company: typeof sponsor === 'object' ? sponsor.company : undefined,
              role: 'sponsor',
              confidence: 0.9
            });
          }
        });
      });
    }
  }

  return attendees;
}

/**
 * Extract trends from event intelligence
 */
function extractTrendsFromIntelligence(intelligence: any, eventData?: any): TrendInsight[] {
  const trends: TrendInsight[] = [];

  // Extract themes as industry trends
  if (intelligence.discussions?.themes) {
    intelligence.discussions.themes.forEach((theme: string) => {
      trends.push({
        type: 'industry',
        label: theme,
        value: 1,
        description: `Key theme: ${theme}`
      });
    });
  }

  // Extract key topics
  if (intelligence.discussions?.keyTopics) {
    intelligence.discussions.keyTopics.forEach((topic: any) => {
      trends.push({
        type: 'industry',
        label: topic.topic,
        value: topic.importance || 1,
        description: `Importance: ${((topic.importance || 0) * 100).toFixed(0)}%`
      });
    });
  }

  // Extract geographic trend from location
  if (intelligence.location?.localMarketInsights && eventData?.country) {
    trends.push({
      type: 'geographic',
      label: eventData.country,
      value: 1,
      description: intelligence.location.localMarketInsights.substring(0, 100)
    });
  }

  // Extract temporal trend
  if (eventData?.starts_at) {
    const eventDate = new Date(eventData.starts_at);
    const now = new Date();
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil > 0 && daysUntil <= 90) {
      trends.push({
        type: 'temporal',
        label: 'Upcoming',
        value: daysUntil,
        description: `Event in ${daysUntil} days`
      });
    }
  }

  return trends;
}

/**
 * Extract positioning recommendations from event intelligence
 */
function extractPositioningFromIntelligence(intelligence: any): PositioningRecommendation[] {
  const positioning: PositioningRecommendation[] = [];

  if (intelligence.outreach) {
    // Determine action based on outreach positioning
    const positioningText = intelligence.outreach.positioning?.toLowerCase() || '';
    let action: 'sponsor' | 'speak' | 'attend' | 'network' = 'attend';
    let opportunity: 'high' | 'medium' | 'low' = 'medium';

    if (positioningText.includes('sponsor')) {
      action = 'sponsor';
      opportunity = 'high';
    } else if (positioningText.includes('speak') || positioningText.includes('speaker')) {
      action = 'speak';
      opportunity = 'medium';
    } else if (positioningText.includes('network')) {
      action = 'network';
      opportunity = 'medium';
    }

    // Use opportunity score if available (Phase 1B)
    if (intelligence.opportunityScore) {
      const overallScore = intelligence.opportunityScore.overallScore || 0;
      if (overallScore >= 0.7) {
        opportunity = 'high';
      } else if (overallScore >= 0.4) {
        opportunity = 'medium';
      } else {
        opportunity = 'low';
      }
    }

    positioning.push({
      action,
      score: intelligence.opportunityScore?.overallScore || 0.5,
      reasoning: [
        intelligence.outreach.positioning || 'Event opportunity identified',
        intelligence.outreach.recommendedApproach || 'Consider this event for engagement'
      ],
      opportunity
    });
  }

  // Add urgency-based recommendation if available
  if (intelligence.urgencyIndicators && intelligence.urgencyIndicators.urgencyLevel !== 'none') {
    positioning.push({
      action: 'attend',
      score: intelligence.urgencyIndicators.urgencyScore || 0.5,
      reasoning: [intelligence.urgencyIndicators.recommendedAction || 'Time-sensitive opportunity'],
      opportunity: intelligence.urgencyIndicators.urgencyLevel === 'critical' || intelligence.urgencyIndicators.urgencyLevel === 'high' 
        ? 'high' 
        : 'medium'
    });
  }

  return positioning.length > 0 ? positioning : [{
    action: 'attend',
    score: 0.5,
    reasoning: ['Event analysis available'],
    opportunity: 'medium'
  }];
}

