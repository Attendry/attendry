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
import {
  getCachedCompetitorEvents,
  cacheCompetitorEvents,
  getCachedActivityComparison,
  cacheActivityComparison,
  getCachedUserEvents,
  cacheUserEvents
} from './competitive-intelligence-cache';

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
 * Get learned matching rules for a user
 */
async function getLearnedRules(
  userId: string | undefined,
  competitors: string[]
): Promise<Map<string, string[]>> {
  if (!userId) return new Map();
  
  try {
    const supabase = supabaseAdmin();
    const { data: rules } = await supabase
      .from('competitor_matching_rules')
      .select('competitor_name, learned_pattern, confidence, feedback_count')
      .in('competitor_name', competitors)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .gt('feedback_count', 0)
      .order('feedback_count', { ascending: false });
    
    if (!rules) return new Map();
    
    const rulesMap = new Map<string, string[]>();
    for (const rule of rules) {
      if (!rulesMap.has(rule.competitor_name)) {
        rulesMap.set(rule.competitor_name, []);
      }
      rulesMap.get(rule.competitor_name)!.push(rule.learned_pattern);
    }
    
    return rulesMap;
  } catch (error) {
    console.error('[CompetitiveIntelligence] Error getting learned rules:', error);
    return new Map();
  }
}

/**
 * Get user-specific exclusions
 */
async function getUserExclusions(
  userId: string | undefined,
  competitors: string[]
): Promise<Set<string>> {
  if (!userId) return new Set();
  
  try {
    const supabase = supabaseAdmin();
    const { data: exclusions } = await supabase
      .from('competitor_exclusions')
      .select('competitor_name, excluded_pattern')
      .eq('user_id', userId)
      .in('competitor_name', competitors);
    
    if (!exclusions) return new Set();
    
    const exclusionSet = new Set<string>();
    for (const exclusion of exclusions) {
      exclusionSet.add(`${exclusion.competitor_name}:${exclusion.excluded_pattern}`);
    }
    
    return exclusionSet;
  } catch (error) {
    console.error('[CompetitiveIntelligence] Error getting exclusions:', error);
    return new Set();
  }
}

/**
 * Check if a match should be excluded based on user feedback
 */
function isExcluded(
  competitorName: string,
  matchedName: string,
  exclusions: Set<string>
): boolean {
  return exclusions.has(`${competitorName}:${matchedName}`);
}

/**
 * Check learned rules for fast matching
 */
function checkLearnedRules(
  competitorName: string,
  matchedName: string,
  learnedRules: Map<string, string[]>
): boolean {
  const patterns = learnedRules.get(competitorName);
  if (!patterns) return false;
  
  return patterns.some(pattern => {
    const normalizedPattern = normalizeCompanyName(pattern);
    const normalizedMatched = normalizeCompanyName(matchedName);
    return normalizedPattern === normalizedMatched ||
           normalizedMatched.includes(normalizedPattern) ||
           normalizedPattern.includes(normalizedMatched);
  });
}

/**
 * Detect competitors in an event
 * 
 * @param event Event data to analyze
 * @param competitors List of competitor names to match
 * @param userId Optional user ID for personalized rules and exclusions
 * @returns Array of competitor matches
 */
export async function detectCompetitorsInEvent(
  event: EventData,
  competitors: string[],
  userId?: string
): Promise<CompetitorMatch[]> {
  if (!competitors || competitors.length === 0) {
    return [];
  }
  
  if (!event) {
    return [];
  }
  
  // Get learned rules and exclusions for user (if provided)
  const [learnedRules, exclusions] = await Promise.all([
    getLearnedRules(userId, competitors),
    getUserExclusions(userId, competitors)
  ]);
  
  const eventId = event.id || event.source_url;
  const eventTitle = event.title || 'Unknown Event';
  const eventDate = event.starts_at || new Date().toISOString();
  
  const allMatches: CompetitorMatch[] = [];
  
  for (const competitor of competitors) {
    // Check speakers
    if (event.speakers && event.speakers.length > 0) {
      for (const speaker of event.speakers) {
        if (speaker.org) {
          const matchedName = speaker.org;
          
          // Check exclusions first
          if (isExcluded(competitor, matchedName, exclusions)) {
            continue; // Skip this match
          }
          
          // Check learned rules (fast path)
          if (checkLearnedRules(competitor, matchedName, learnedRules)) {
            allMatches.push({
              competitorName: competitor,
              matchType: 'speaker',
              matchConfidence: 0.95, // High confidence for learned rules
              matchDetails: {
                eventId,
                eventTitle,
                eventDate,
                role: speaker.title || 'Speaker',
                organization: speaker.org,
                speakerName: speaker.name
              }
            });
            continue;
          }
          
          // Fall back to fuzzy matching
          const similarity = calculateNameSimilarity(competitor, matchedName);
          if (similarity >= 0.5) {
            allMatches.push({
              competitorName: competitor,
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
      }
    }
    
    // Check sponsors
    if (event.sponsors && event.sponsors.length > 0) {
      for (const sponsor of event.sponsors) {
        const sponsorName = typeof sponsor === 'string' ? sponsor : sponsor.name;
        if (!sponsorName) continue;
        
        // Check exclusions first
        if (isExcluded(competitor, sponsorName, exclusions)) {
          continue;
        }
        
        // Check learned rules
        if (checkLearnedRules(competitor, sponsorName, learnedRules)) {
          const level = typeof sponsor === 'object' && sponsor.level ? sponsor.level : 'unknown';
          allMatches.push({
            competitorName: competitor,
            matchType: 'sponsor',
            matchConfidence: 0.95,
            matchDetails: {
              eventId,
              eventTitle,
              eventDate,
              role: `${level} sponsor`,
              organization: sponsorName
            }
          });
          continue;
        }
        
        // Fall back to fuzzy matching
        const similarity = calculateNameSimilarity(competitor, sponsorName);
        if (similarity >= 0.5) {
          const level = typeof sponsor === 'object' && sponsor.level ? sponsor.level : 'unknown';
          allMatches.push({
            competitorName: competitor,
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
    }
    
    // Check attendees/organizations
    if (event.participating_organizations && event.participating_organizations.length > 0) {
      for (const org of event.participating_organizations) {
        // Check exclusions first
        if (isExcluded(competitor, org, exclusions)) {
          continue;
        }
        
        // Check learned rules
        if (checkLearnedRules(competitor, org, learnedRules)) {
          allMatches.push({
            competitorName: competitor,
            matchType: 'attendee',
            matchConfidence: 0.95,
            matchDetails: {
              eventId,
              eventTitle,
              eventDate,
              role: 'Attendee',
              organization: org
            }
          });
          continue;
        }
        
        // Fall back to fuzzy matching
        const similarity = calculateNameSimilarity(competitor, org);
        if (similarity >= 0.5) {
          allMatches.push({
            competitorName: competitor,
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
    }
    
    // Check organizer
    if (event.organizer) {
      // Check exclusions first
      if (!isExcluded(competitor, event.organizer, exclusions)) {
        // Check learned rules
        if (checkLearnedRules(competitor, event.organizer, learnedRules)) {
          allMatches.push({
            competitorName: competitor,
            matchType: 'organizer',
            matchConfidence: 0.95,
            matchDetails: {
              eventId,
              eventTitle,
              eventDate,
              role: 'Organizer',
              organization: event.organizer
            }
          });
        } else {
          // Fall back to fuzzy matching
          const similarity = calculateNameSimilarity(competitor, event.organizer);
          if (similarity >= 0.5) {
            allMatches.push({
              competitorName: competitor,
              matchType: 'organizer',
              matchConfidence: similarity,
              matchDetails: {
                eventId,
                eventTitle,
                eventDate,
                role: 'Organizer',
                organization: event.organizer
              }
            });
          }
        }
      }
    }
  }
  
  // Deduplicate and filter by minimum confidence (0.5)
  const deduplicated = deduplicateMatches(allMatches);
  const filtered = deduplicated.filter(m => m.matchConfidence >= 0.5);
  
  // Sort by confidence (highest first)
  return filtered.sort((a, b) => b.matchConfidence - a.matchConfidence);
}

/**
 * Get user's events from board (with caching)
 */
async function getUserEvents(
  userId: string,
  timeWindow?: { from: Date; to: Date }
): Promise<string[]> {
  // Check cache first
  const cached = await getCachedUserEvents(userId, timeWindow);
  if (cached) {
    return cached;
  }

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
    
    // Cache the result
    await cacheUserEvents(userId, eventIds, timeWindow);
    
    return eventIds;
  } catch (error) {
    console.error('[CompetitiveIntelligence] Exception getting user events:', error);
    return [];
  }
}

/**
 * Find events where a competitor is present (with caching and pagination)
 */
async function findCompetitorEvents(
  competitorName: string,
  timeWindow?: { from: Date; to: Date },
  options?: { page?: number; limit?: number }
): Promise<EventData[]> {
  // Check cache first
  const cached = await getCachedCompetitorEvents(competitorName, timeWindow);
  if (cached) {
    // Apply pagination to cached results
    const page = options?.page || 0;
    const limit = options?.limit || 100;
    const start = page * limit;
    const end = start + limit;
    return cached.slice(start, end);
  }

  try {
    const supabase = supabaseAdmin();
    
    // Use optimized query with indexes
    const limit = options?.limit || 100;
    const page = options?.page || 0;
    const offset = page * limit;
    
    let query = supabase
      .from('collected_events')
      .select('id, source_url, title, starts_at, ends_at, speakers, sponsors, participating_organizations, organizer')
      .limit(limit)
      .range(offset, offset + limit - 1);
    
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
    
    // Batch process events for better performance
    const batchSize = 50;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize) as EventData[];
      
      for (const event of batch) {
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
 * Compare user activity vs. competitors (with caching and batching)
 * 
 * @param userId User ID
 * @param competitors List of competitor names
 * @param timeWindow Optional time window for comparison
 * @param options Optional pagination and batching options
 * @returns Competitive context
 */
export async function compareUserActivity(
  userId: string,
  competitors: string[],
  timeWindow?: { from: Date; to: Date },
  options?: { page?: number; limit?: number; batchSize?: number }
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

  // Check cache first
  const cached = await getCachedActivityComparison(userId, competitors, timeWindow);
  if (cached) {
    return cached;
  }
  
  // Get user's events
  const userEvents = await getUserEvents(userId, timeWindow);
  
  // Process competitors in batches for better performance
  const batchSize = options?.batchSize || 5;
  const competitorEvents: Record<string, string[]> = {};
  
  for (let i = 0; i < competitors.length; i += batchSize) {
    const batch = competitors.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (competitor) => {
        const events = await findCompetitorEvents(competitor, timeWindow, {
          page: options?.page || 0,
          limit: options?.limit || 100
        });
        return {
          competitor,
          eventIds: events.map(e => e.id || e.source_url).filter((id): id is string => id !== null)
        };
      })
    );
    
    // Merge results
    for (const result of batchResults) {
      competitorEvents[result.competitor] = result.eventIds;
    }
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
  
  const result: CompetitiveContext = {
    competitorsPresent: [], // Will be populated in event intelligence
    competitorCount: competitors.length,
    highValueCompetitors,
    competitiveGaps: gaps,
    activityComparison
  };

  // Cache the result
  await cacheActivityComparison(userId, competitors, result, timeWindow);
  
  return result;
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

