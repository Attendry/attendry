/**
 * Competitive Intelligence Service
 * 
 * Phase 2C: Tracks competitors in events, compares user activity vs. competitors,
 * identifies gaps, and generates competitive alerts.
 * 
 * Features:
 * - Competitor detection in events (speakers, sponsors, attendees)
 * - Activity comparison (user vs. competitors)
 * - Competitive gap identification
 * - Alert generation for high-value competitive events
 */

import { EventData, SpeakerData, SponsorData, UserProfile } from '@/lib/types/core';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Competitor match in an event
 */
export interface CompetitorMatch {
  competitorName: string;
  matchType: 'speaker' | 'sponsor' | 'attendee' | 'organizer';
  matchConfidence: number; // 0-1
  matchDetails: {
    eventId: string;
    eventTitle: string;
    eventDate: string;
    role: string; // e.g., "Keynote Speaker", "Gold Sponsor"
    organization?: string;
    speakerName?: string;
  };
}

/**
 * Competitive context for an event or user
 */
export interface CompetitiveContext {
  competitorsPresent: CompetitorMatch[];
  competitorCount: number;
  highValueCompetitors: string[]; // Competitors in high-value events
  competitiveGaps: {
    competitorName: string;
    eventsAttending: string[];
    eventsUserNotAttending: string[];
  }[];
  activityComparison: {
    competitorName: string;
    userEventCount: number;
    competitorEventCount: number;
    growthRate: number; // Competitor's growth rate
    gapCount: number; // Events competitor is in, user isn't
  }[];
}

/**
 * Competitive alert
 */
export interface CompetitiveAlert {
  id: string;
  type: 'high_value_event' | 'activity_spike' | 'competitive_gap' | 'new_competitor';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  eventId?: string;
  competitorName: string;
  recommendedAction: string;
  createdAt: string;
}

/**
 * Normalize company name for matching
 */
function normalizeCompanyName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove common suffixes
    .replace(/\s+(inc|llc|gmbh|ltd|limited|corp|corporation|ag|sa|plc|pvt|private|co|company|group|holdings|technologies|tech|solutions|systems|services|consulting|consultants|partners|partnership|associates|associations?)$/i, '')
    // Remove special characters
    .replace(/[^\w\s]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const normalized1 = normalizeCompanyName(name1);
  const normalized2 = normalizeCompanyName(name2);
  
  if (normalized1 === normalized2) return 1.0;
  if (normalized1.length === 0 || normalized2.length === 0) return 0;
  
  // Check if one contains the other (after normalization)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.9;
  }
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const similarity = 1 - (distance / maxLength);
  
  return Math.max(0, similarity);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Match competitor in speakers
 */
function matchCompetitorInSpeakers(
  competitorName: string,
  speakers: SpeakerData[],
  eventId: string,
  eventTitle: string,
  eventDate: string
): CompetitorMatch[] {
  const matches: CompetitorMatch[] = [];
  
  if (!speakers || speakers.length === 0) return matches;
  
  for (const speaker of speakers) {
    // Check speaker organization
    if (speaker.org) {
      const similarity = calculateNameSimilarity(competitorName, speaker.org);
      if (similarity >= 0.5) {
        matches.push({
          competitorName,
          matchType: 'speaker',
          matchConfidence: similarity,
          matchDetails: {
            eventId,
            eventTitle,
            eventDate,
            role: speaker.title || 'Speaker',
            organization: speaker.org,
            speakerName: speaker.name
          }
        });
      }
    }
    
    // Check speaker name (if competitor name matches speaker name)
    if (speaker.name) {
      const nameSimilarity = calculateNameSimilarity(competitorName, speaker.name);
      if (nameSimilarity >= 0.7) {
        matches.push({
          competitorName,
          matchType: 'speaker',
          matchConfidence: nameSimilarity * 0.8, // Slightly lower confidence for name-only match
          matchDetails: {
            eventId,
            eventTitle,
            eventDate,
            role: speaker.title || 'Speaker',
            organization: speaker.org,
            speakerName: speaker.name
          }
        });
      }
    }
  }
  
  return matches;
}

/**
 * Match competitor in sponsors
 */
function matchCompetitorInSponsors(
  competitorName: string,
  sponsors: SponsorData[],
  eventId: string,
  eventTitle: string,
  eventDate: string
): CompetitorMatch[] {
  const matches: CompetitorMatch[] = [];
  
  if (!sponsors || sponsors.length === 0) return matches;
  
  for (const sponsor of sponsors) {
    const sponsorName = typeof sponsor === 'string' ? sponsor : sponsor.name;
    if (!sponsorName) continue;
    
    const similarity = calculateNameSimilarity(competitorName, sponsorName);
    if (similarity >= 0.5) {
      const level = typeof sponsor === 'object' && sponsor.level 
        ? sponsor.level 
        : 'unknown';
      
      matches.push({
        competitorName,
        matchType: 'sponsor',
        matchConfidence: similarity,
        matchDetails: {
          eventId,
          eventTitle,
          eventDate,
          role: `${level} sponsor`,
          organization: sponsorName
        }
      });
    }
  }
  
  return matches;
}

/**
 * Match competitor in attendees/organizations
 */
function matchCompetitorInAttendees(
  competitorName: string,
  organizations: string[],
  eventId: string,
  eventTitle: string,
  eventDate: string
): CompetitorMatch[] {
  const matches: CompetitorMatch[] = [];
  
  if (!organizations || organizations.length === 0) return matches;
  
  for (const org of organizations) {
    const similarity = calculateNameSimilarity(competitorName, org);
    if (similarity >= 0.5) {
      matches.push({
        competitorName,
        matchType: 'attendee',
        matchConfidence: similarity,
        matchDetails: {
          eventId,
          eventTitle,
          eventDate,
          role: 'Attendee',
          organization: org
        }
      });
    }
  }
  
  return matches;
}

/**
 * Match competitor in organizer
 */
function matchCompetitorInOrganizer(
  competitorName: string,
  organizer: string | null | undefined,
  eventId: string,
  eventTitle: string,
  eventDate: string
): CompetitorMatch[] {
  const matches: CompetitorMatch[] = [];
  
  if (!organizer) return matches;
  
  const similarity = calculateNameSimilarity(competitorName, organizer);
  if (similarity >= 0.5) {
    matches.push({
      competitorName,
      matchType: 'organizer',
      matchConfidence: similarity,
      matchDetails: {
        eventId,
        eventTitle,
        eventDate,
        role: 'Organizer',
        organization: organizer
      }
    });
  }
  
  return matches;
}

/**
 * Deduplicate competitor matches (keep highest confidence)
 */
function deduplicateMatches(matches: CompetitorMatch[]): CompetitorMatch[] {
  const seen = new Map<string, CompetitorMatch>();
  
  for (const match of matches) {
    const key = `${match.competitorName}-${match.matchType}-${match.matchDetails.eventId}`;
    const existing = seen.get(key);
    
    if (!existing || match.matchConfidence > existing.matchConfidence) {
      seen.set(key, match);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Detect competitors in an event
 * 
 * @param event Event data to analyze
 * @param competitors List of competitor names to match
 * @returns Array of competitor matches
 */
export async function detectCompetitorsInEvent(
  event: EventData,
  competitors: string[]
): Promise<CompetitorMatch[]> {
  if (!competitors || competitors.length === 0) {
    return [];
  }
  
  if (!event) {
    return [];
  }
  
  const eventId = event.id || event.source_url;
  const eventTitle = event.title || 'Unknown Event';
  const eventDate = event.starts_at || new Date().toISOString();
  
  const allMatches: CompetitorMatch[] = [];
  
  for (const competitor of competitors) {
    // Check speakers
    if (event.speakers && event.speakers.length > 0) {
      const speakerMatches = matchCompetitorInSpeakers(
        competitor,
        event.speakers,
        eventId,
        eventTitle,
        eventDate
      );
      allMatches.push(...speakerMatches);
    }
    
    // Check sponsors
    if (event.sponsors && event.sponsors.length > 0) {
      const sponsorMatches = matchCompetitorInSponsors(
        competitor,
        event.sponsors,
        eventId,
        eventTitle,
        eventDate
      );
      allMatches.push(...sponsorMatches);
    }
    
    // Check attendees/organizations
    if (event.participating_organizations && event.participating_organizations.length > 0) {
      const attendeeMatches = matchCompetitorInAttendees(
        competitor,
        event.participating_organizations,
        eventId,
        eventTitle,
        eventDate
      );
      allMatches.push(...attendeeMatches);
    }
    
    // Check organizer
    if (event.organizer) {
      const organizerMatches = matchCompetitorInOrganizer(
        competitor,
        event.organizer,
        eventId,
        eventTitle,
        eventDate
      );
      allMatches.push(...organizerMatches);
    }
  }
  
  // Deduplicate and filter by minimum confidence (0.5)
  const deduplicated = deduplicateMatches(allMatches);
  const filtered = deduplicated.filter(m => m.matchConfidence >= 0.5);
  
  // Sort by confidence (highest first)
  return filtered.sort((a, b) => b.matchConfidence - a.matchConfidence);
}

/**
 * Get user's events from board
 */
async function getUserEvents(
  userId: string,
  timeWindow?: { from: Date; to: Date }
): Promise<string[]> {
  try {
    const supabase = supabaseAdmin();
    let query = supabase
      .from('user_event_board')
      .select('event_id, event_data')
      .eq('user_id', userId);
    
    if (timeWindow) {
      // Filter by event date if available in event_data
      // For now, just get all events and filter in memory
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[CompetitiveIntelligence] Error getting user events:', error);
      return [];
    }
    
    if (!data) return [];
    
    // Extract event IDs and source URLs
    const eventIds = data
      .map(item => {
        if (item.event_id) return item.event_id;
        if (item.event_data && typeof item.event_data === 'object') {
          const eventData = item.event_data as any;
          return eventData.id || eventData.source_url;
        }
        return null;
      })
      .filter((id): id is string => id !== null);
    
    return eventIds;
  } catch (error) {
    console.error('[CompetitiveIntelligence] Exception getting user events:', error);
    return [];
  }
}

/**
 * Find events where a competitor is present
 */
async function findCompetitorEvents(
  competitorName: string,
  timeWindow?: { from: Date; to: Date }
): Promise<EventData[]> {
  try {
    const supabase = supabaseAdmin();
    
    // Search in collected_events for competitor mentions
    // This is a simplified version - in production, you might want to cache this
    let query = supabase
      .from('collected_events')
      .select('*')
      .limit(1000); // Limit for performance
    
    if (timeWindow) {
      query = query
        .gte('starts_at', timeWindow.from.toISOString())
        .lte('starts_at', timeWindow.to.toISOString());
    }
    
    const { data: events, error } = await query;
    
    if (error) {
      console.error('[CompetitiveIntelligence] Error finding competitor events:', error);
      return [];
    }
    
    if (!events) return [];
    
    // Filter events where competitor is present
    const competitorEvents: EventData[] = [];
    const normalizedCompetitor = normalizeCompanyName(competitorName);
    
    for (const event of events as EventData[]) {
      // Check speakers
      if (event.speakers) {
        const hasMatch = event.speakers.some(speaker => {
          if (speaker.org) {
            return normalizeCompanyName(speaker.org).includes(normalizedCompetitor) ||
                   normalizedCompetitor.includes(normalizeCompanyName(speaker.org));
          }
          return false;
        });
        if (hasMatch) {
          competitorEvents.push(event);
          continue;
        }
      }
      
      // Check sponsors
      if (event.sponsors) {
        const hasMatch = event.sponsors.some(sponsor => {
          const sponsorName = typeof sponsor === 'string' ? sponsor : sponsor.name;
          if (sponsorName) {
            return normalizeCompanyName(sponsorName).includes(normalizedCompetitor) ||
                   normalizedCompetitor.includes(normalizeCompanyName(sponsorName));
          }
          return false;
        });
        if (hasMatch) {
          competitorEvents.push(event);
          continue;
        }
      }
      
      // Check participating organizations
      if (event.participating_organizations) {
        const hasMatch = event.participating_organizations.some(org => {
          return normalizeCompanyName(org).includes(normalizedCompetitor) ||
                 normalizedCompetitor.includes(normalizeCompanyName(org));
        });
        if (hasMatch) {
          competitorEvents.push(event);
        }
      }
    }
    
    return competitorEvents;
  } catch (error) {
    console.error('[CompetitiveIntelligence] Exception finding competitor events:', error);
    return [];
  }
}

/**
 * Calculate competitive gaps
 */
function calculateCompetitiveGaps(
  userEvents: string[],
  competitorEvents: Record<string, string[]>
): CompetitiveContext['competitiveGaps'] {
  const gaps: CompetitiveContext['competitiveGaps'] = [];
  
  for (const [competitor, events] of Object.entries(competitorEvents)) {
    const eventsUserNotAttending = events.filter(
      eventId => !userEvents.includes(eventId)
    );
    
    if (eventsUserNotAttending.length > 0) {
      gaps.push({
        competitorName: competitor,
        eventsAttending: events,
        eventsUserNotAttending
      });
    }
  }
  
  return gaps;
}

/**
 * Calculate activity comparison
 */
async function calculateActivityComparison(
  userEvents: string[],
  competitorEvents: Record<string, string[]>,
  timeWindow?: { from: Date; to: Date }
): Promise<CompetitiveContext['activityComparison']> {
  const comparison: CompetitiveContext['activityComparison'] = [];
  
  // Get previous period for growth calculation
  const previousWindow = timeWindow ? {
    from: new Date(timeWindow.from.getTime() - (timeWindow.to.getTime() - timeWindow.from.getTime())),
    to: timeWindow.from
  } : undefined;
  
  for (const [competitor, events] of Object.entries(competitorEvents)) {
    const currentCount = events.length;
    
    // Get previous period count (simplified - in production, cache this)
    let previousCount = 0;
    if (previousWindow) {
      const previousEvents = await findCompetitorEvents(competitor, previousWindow);
      previousCount = previousEvents.length;
    }
    
    const growthRate = previousCount > 0
      ? ((currentCount - previousCount) / previousCount) * 100
      : currentCount > 0 ? 100 : 0;
    
    const gapCount = events.filter(e => !userEvents.includes(e)).length;
    
    comparison.push({
      competitorName: competitor,
      userEventCount: userEvents.length,
      competitorEventCount: currentCount,
      growthRate,
      gapCount
    });
  }
  
  return comparison;
}

/**
 * Identify high-value competitors
 */
function identifyHighValueCompetitors(
  competitorEvents: Record<string, string[]>,
  userEvents: string[]
): string[] {
  // For now, return competitors with most events
  // In production, could factor in event quality/opportunity scores
  const sorted = Object.entries(competitorEvents)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5); // Top 5
  
  return sorted.map(([competitor]) => competitor);
}

/**
 * Compare user activity vs. competitors
 * 
 * @param userId User ID
 * @param competitors List of competitor names
 * @param timeWindow Optional time window for comparison
 * @returns Competitive context
 */
export async function compareUserActivity(
  userId: string,
  competitors: string[],
  timeWindow?: { from: Date; to: Date }
): Promise<CompetitiveContext> {
  if (!competitors || competitors.length === 0) {
    return {
      competitorsPresent: [],
      competitorCount: 0,
      highValueCompetitors: [],
      competitiveGaps: [],
      activityComparison: []
    };
  }
  
  // Get user's events
  const userEvents = await getUserEvents(userId, timeWindow);
  
  // For each competitor, find their events
  const competitorEvents: Record<string, string[]> = {};
  for (const competitor of competitors) {
    const events = await findCompetitorEvents(competitor, timeWindow);
    competitorEvents[competitor] = events.map(e => e.id || e.source_url).filter((id): id is string => id !== null);
  }
  
  // Calculate gaps
  const gaps = calculateCompetitiveGaps(userEvents, competitorEvents);
  
  // Calculate activity comparison
  const activityComparison = await calculateActivityComparison(
    userEvents,
    competitorEvents,
    timeWindow
  );
  
  // Identify high-value competitors
  const highValueCompetitors = identifyHighValueCompetitors(
    competitorEvents,
    userEvents
  );
  
  return {
    competitorsPresent: [], // Will be populated in event intelligence
    competitorCount: competitors.length,
    highValueCompetitors,
    competitiveGaps: gaps,
    activityComparison
  };
}

/**
 * Generate competitive alerts
 * 
 * @param context Competitive context
 * @param eventIntelligence Event intelligence (for opportunity scores)
 * @param event Event data
 * @returns Array of competitive alerts
 */
export function generateCompetitiveAlerts(
  context: CompetitiveContext,
  eventIntelligence: any, // EventIntelligence type
  event: EventData
): CompetitiveAlert[] {
  const alerts: CompetitiveAlert[] = [];
  const alertId = () => `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // 1. High-value event alerts
  if (context.competitorsPresent.length > 0) {
    const opportunityScore = eventIntelligence?.opportunityScore?.overallScore || 0;
    
    if (opportunityScore >= 0.7) {
      alerts.push({
        id: alertId(),
        type: 'high_value_event',
        severity: 'high',
        title: `${context.competitorsPresent.length} competitor(s) in high-value event`,
        description: `Competitors ${context.competitorsPresent.map(c => c.competitorName).join(', ')} are present in this high-value event (${Math.round(opportunityScore * 100)}% opportunity score).`,
        eventId: event.id || event.source_url,
        competitorName: context.competitorsPresent[0].competitorName,
        recommendedAction: 'Consider attending or sponsoring to maintain competitive presence.',
        createdAt: new Date().toISOString()
      });
    }
  }
  
  // 2. Activity spike alerts
  for (const activity of context.activityComparison) {
    if (activity.growthRate > 50 && activity.competitorEventCount > 5) {
      alerts.push({
        id: alertId(),
        type: 'activity_spike',
        severity: 'medium',
        title: `${activity.competitorName} activity spike`,
        description: `${activity.competitorName} has increased event participation by ${activity.growthRate.toFixed(0)}% (${activity.competitorEventCount} events vs. your ${activity.userEventCount}).`,
        competitorName: activity.competitorName,
        recommendedAction: 'Review competitor strategy and consider matching their event presence.',
        createdAt: new Date().toISOString()
      });
    }
  }
  
  // 3. Competitive gap alerts
  for (const gap of context.competitiveGaps) {
    if (gap.eventsUserNotAttending.length >= 3) {
      alerts.push({
        id: alertId(),
        type: 'competitive_gap',
        severity: 'high',
        title: `Competitive gap: ${gap.competitorName}`,
        description: `${gap.competitorName} is attending ${gap.eventsUserNotAttending.length} events you're not. These may be valuable opportunities.`,
        competitorName: gap.competitorName,
        recommendedAction: `Review ${gap.eventsUserNotAttending.length} events where ${gap.competitorName} is present.`,
        createdAt: new Date().toISOString()
      });
    }
  }
  
  return alerts;
}

