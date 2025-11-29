/**
 * Competitor History Service
 * 
 * Enhancement 3: Historical Competitor Tracking
 * Tracks competitor activity over time and identifies trends
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { EventData } from '@/lib/types/core';
import { findCompetitorEvents } from './competitive-intelligence-service';

export interface CompetitorSnapshot {
  id: string;
  userId: string;
  competitorName: string;
  snapshotDate: Date;
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  eventCount: number;
  speakerCount: number;
  sponsorCount: number;
  attendeeCount: number;
  events: any[];
  topEvents: any[];
  growthRate: number;
  activityScore: number;
}

export interface CompetitorTrend {
  id: string;
  userId: string;
  competitorName: string;
  trendType: 'growth' | 'decline' | 'spike' | 'stable';
  periodStart: Date;
  periodEnd: Date;
  metric: string;
  value: number;
  changePercentage: number;
  description: string;
}

/**
 * Generate snapshot for a competitor
 */
export async function generateCompetitorSnapshot(
  userId: string,
  competitorName: string,
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly',
  date: Date
): Promise<CompetitorSnapshot> {
  const supabase = supabaseAdmin();
  
  // Calculate period boundaries
  const periodStart = getPeriodStart(date, periodType);
  const periodEnd = getPeriodEnd(date, periodType);
  
  // Get competitor events for this period
  const events = await findCompetitorEvents(competitorName, {
    from: periodStart,
    to: periodEnd
  });
  
  // Calculate metrics
  const eventCount = events.length;
  const speakerCount = events.reduce((count, event) => {
    return count + (event.speakers?.filter((s: any) => 
      s.org && normalizeCompanyName(s.org).includes(normalizeCompanyName(competitorName))
    ).length || 0);
  }, 0);
  
  const sponsorCount = events.reduce((count, event) => {
    if (!event.sponsors) return count;
    return count + event.sponsors.filter((sponsor: any) => {
      const sponsorName = typeof sponsor === 'string' ? sponsor : sponsor.name;
      return sponsorName && normalizeCompanyName(sponsorName).includes(normalizeCompanyName(competitorName));
    }).length;
  }, 0);
  
  const attendeeCount = events.reduce((count, event) => {
    return count + (event.participating_organizations?.filter((org: string) =>
      normalizeCompanyName(org).includes(normalizeCompanyName(competitorName))
    ).length || 0);
  }, 0);
  
  // Get previous period for growth calculation
  const previousPeriodStart = getPreviousPeriodStart(periodStart, periodType);
  const previousPeriodEnd = periodStart;
  
  const previousEvents = await findCompetitorEvents(competitorName, {
    from: previousPeriodStart,
    to: previousPeriodEnd
  });
  
  const previousEventCount = previousEvents.length;
  const growthRate = previousEventCount > 0
    ? ((eventCount - previousEventCount) / previousEventCount) * 100
    : eventCount > 0 ? 100 : 0;
  
  // Calculate activity score (weighted combination of metrics)
  const activityScore = (
    eventCount * 0.4 +
    speakerCount * 0.3 +
    sponsorCount * 0.2 +
    attendeeCount * 0.1
  ) / 10; // Normalize to 0-1 scale
  
  // Get top events (simplified - in production, use opportunity scores)
  const topEvents = events.slice(0, 10).map(e => ({
    id: e.id || e.source_url,
    title: e.title,
    date: e.starts_at
  }));
  
  // Store snapshot
  const { data: snapshot, error } = await supabase
    .from('competitor_activity_snapshots')
    .upsert({
      user_id: userId,
      competitor_name: competitorName,
      snapshot_date: date.toISOString().split('T')[0],
      period_type: periodType,
      event_count: eventCount,
      speaker_count: speakerCount,
      sponsor_count: sponsorCount,
      attendee_count: attendeeCount,
      events: events.map(e => e.id || e.source_url),
      top_events: topEvents,
      growth_rate: growthRate,
      activity_score: activityScore
    }, {
      onConflict: 'user_id,competitor_name,snapshot_date,period_type'
    })
    .select()
    .single();
  
  if (error) {
    console.error('[CompetitorHistory] Error storing snapshot:', error);
    throw error;
  }
  
  return {
    id: snapshot.id,
    userId: snapshot.user_id,
    competitorName: snapshot.competitor_name,
    snapshotDate: new Date(snapshot.snapshot_date),
    periodType: snapshot.period_type,
    eventCount: snapshot.event_count,
    speakerCount: snapshot.speaker_count,
    sponsorCount: snapshot.sponsor_count,
    attendeeCount: snapshot.attendee_count,
    events: snapshot.events || [],
    topEvents: snapshot.top_events || [],
    growthRate: parseFloat(snapshot.growth_rate) || 0,
    activityScore: parseFloat(snapshot.activity_score) || 0
  };
}

/**
 * Get historical snapshots for a competitor
 */
export async function getCompetitorHistory(
  userId: string,
  competitorName: string,
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly',
  startDate: Date,
  endDate: Date
): Promise<CompetitorSnapshot[]> {
  const supabase = supabaseAdmin();
  
  const { data: snapshots, error } = await supabase
    .from('competitor_activity_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('competitor_name', competitorName)
    .eq('period_type', periodType)
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .lte('snapshot_date', endDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true });
  
  if (error) {
    console.error('[CompetitorHistory] Error fetching history:', error);
    return [];
  }
  
  return (snapshots || []).map(s => ({
    id: s.id,
    userId: s.user_id,
    competitorName: s.competitor_name,
    snapshotDate: new Date(s.snapshot_date),
    periodType: s.period_type,
    eventCount: s.event_count,
    speakerCount: s.speaker_count,
    sponsorCount: s.sponsor_count,
    attendeeCount: s.attendee_count,
    events: s.events || [],
    topEvents: s.top_events || [],
    growthRate: parseFloat(s.growth_rate) || 0,
    activityScore: parseFloat(s.activity_score) || 0
  }));
}

/**
 * Analyze trends from snapshots
 */
export async function analyzeTrends(
  userId: string,
  competitorName: string,
  snapshots: CompetitorSnapshot[]
): Promise<CompetitorTrend[]> {
  if (snapshots.length < 2) return [];
  
  const trends: CompetitorTrend[] = [];
  const supabase = supabaseAdmin();
  
  // Analyze event count trend
  const eventCounts = snapshots.map(s => s.eventCount);
  const avgEventCount = eventCounts.reduce((a, b) => a + b, 0) / eventCounts.length;
  const latestCount = eventCounts[eventCounts.length - 1];
  const previousCount = eventCounts[eventCounts.length - 2];
  
  const changePercentage = previousCount > 0
    ? ((latestCount - previousCount) / previousCount) * 100
    : latestCount > 0 ? 100 : 0;
  
  let trendType: 'growth' | 'decline' | 'spike' | 'stable' = 'stable';
  if (changePercentage > 50) {
    trendType = 'spike';
  } else if (changePercentage > 10) {
    trendType = 'growth';
  } else if (changePercentage < -10) {
    trendType = 'decline';
  }
  
  if (Math.abs(changePercentage) > 5) {
    const trend: CompetitorTrend = {
      id: '',
      userId,
      competitorName,
      trendType,
      periodStart: snapshots[snapshots.length - 2].snapshotDate,
      periodEnd: snapshots[snapshots.length - 1].snapshotDate,
      metric: 'event_count',
      value: latestCount,
      changePercentage,
      description: `${trendType === 'growth' ? 'Increased' : trendType === 'decline' ? 'Decreased' : 'Spike in'} event participation by ${Math.abs(changePercentage).toFixed(0)}%`
    };
    
    // Store trend
    const { data: storedTrend, error } = await supabase
      .from('competitor_trends')
      .upsert({
        user_id: userId,
        competitor_name: competitorName,
        trend_type: trendType,
        period_start: trend.periodStart.toISOString().split('T')[0],
        period_end: trend.periodEnd.toISOString().split('T')[0],
        metric: 'event_count',
        value: latestCount,
        change_percentage: changePercentage,
        description: trend.description
      }, {
        onConflict: 'user_id,competitor_name,trend_type,period_start,period_end,metric'
      })
      .select()
      .single();
    
    if (!error && storedTrend) {
      trend.id = storedTrend.id;
      trends.push(trend);
    }
  }
  
  return trends;
}

// Helper functions
function getPeriodStart(date: Date, periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly'): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  
  if (periodType === 'daily') {
    return d;
  } else if (periodType === 'weekly') {
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  } else if (periodType === 'monthly') {
    d.setDate(1);
    return d;
  } else { // quarterly
    const month = d.getMonth();
    const quarterStart = Math.floor(month / 3) * 3;
    d.setMonth(quarterStart, 1);
    return d;
  }
}

function getPeriodEnd(date: Date, periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly'): Date {
  const start = getPeriodStart(date, periodType);
  const end = new Date(start);
  
  if (periodType === 'daily') {
    end.setDate(end.getDate() + 1);
  } else if (periodType === 'weekly') {
    end.setDate(end.getDate() + 7);
  } else if (periodType === 'monthly') {
    end.setMonth(end.getMonth() + 1);
  } else { // quarterly
    end.setMonth(end.getMonth() + 3);
  }
  
  return end;
}

function getPreviousPeriodStart(currentStart: Date, periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly'): Date {
  const prev = new Date(currentStart);
  
  if (periodType === 'daily') {
    prev.setDate(prev.getDate() - 1);
  } else if (periodType === 'weekly') {
    prev.setDate(prev.getDate() - 7);
  } else if (periodType === 'monthly') {
    prev.setMonth(prev.getMonth() - 1);
  } else { // quarterly
    prev.setMonth(prev.getMonth() - 3);
  }
  
  return prev;
}

function normalizeCompanyName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+(inc|llc|gmbh|ltd|limited|corp|corporation|ag|sa|plc|pvt|private|co|company|group|holdings|technologies|tech|solutions|systems|services|consulting|consultants|partners|partnership|associates|associations?)$/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

