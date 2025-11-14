/**
 * Opportunity Scoring Service
 * 
 * Calculates quantified opportunity scores for events including:
 * - ICP Match Score
 * - Attendee Quality Score
 * - ROI Estimation
 * - Urgency Indicators
 * 
 * Phase 1B Implementation: Quantified Opportunity Scoring
 */

import { EventData, UserProfile } from '@/lib/types/core';
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface OpportunityScore {
  icpMatchScore: number; // 0-1, percentage match with user's ICP
  attendeeQualityScore: number; // 0-1, quality compared to similar events
  roiEstimate: 'high' | 'medium' | 'low' | 'unknown';
  urgencyScore: number; // 0-1, based on deadlines and timing
  overallScore: number; // 0-1, weighted combination
  confidence: number; // 0-1, confidence in the scores
}

export interface UrgencyIndicators {
  urgencyScore: number; // 0-1
  daysUntilEvent?: number;
  daysUntilEarlyBird?: number;
  daysUntilRegistrationDeadline?: number;
  hasEarlyBirdPricing: boolean;
  registrationLimit?: number;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  recommendedAction: string;
}

/**
 * Calculate ICP Match Score
 * Compares event characteristics with user's ICP terms
 */
export function calculateICPMatchScore(
  event: EventData,
  userProfile?: UserProfile
): number {
  if (!userProfile || !userProfile.icp_terms || userProfile.icp_terms.length === 0) {
    return 0.5; // Default score if no ICP defined
  }

  const icpTerms = userProfile.icp_terms.map(term => term.toLowerCase());
  let matchCount = 0;
  let totalChecks = 0;

  // Check title
  if (event.title) {
    totalChecks++;
    const titleLower = event.title.toLowerCase();
    if (icpTerms.some(term => titleLower.includes(term))) {
      matchCount++;
    }
  }

  // Check description
  if (event.description) {
    totalChecks++;
    const descLower = event.description.toLowerCase();
    if (icpTerms.some(term => descLower.includes(term))) {
      matchCount++;
    }
  }

  // Check topics
  if (event.topics && event.topics.length > 0) {
    totalChecks++;
    const topicsLower = event.topics.map(t => t.toLowerCase());
    if (icpTerms.some(term => topicsLower.some(topic => topic.includes(term)))) {
      matchCount++;
    }
  }

  // Check speakers' organizations
  if (event.speakers && event.speakers.length > 0) {
    totalChecks++;
    const speakerOrgs = event.speakers
      .map(s => s.org?.toLowerCase())
      .filter(Boolean) as string[];
    if (icpTerms.some(term => speakerOrgs.some(org => org && org.includes(term)))) {
      matchCount++;
    }
  }

  // Check sponsors
  if (event.sponsors && event.sponsors.length > 0) {
    totalChecks++;
    const sponsorNames = event.sponsors.map(s => {
      const name = typeof s === 'string' ? s : s.name;
      return name?.toLowerCase();
    }).filter(Boolean) as string[];
    if (icpTerms.some(term => sponsorNames.some(name => name && name.includes(term)))) {
      matchCount++;
    }
  }

  // Check participating organizations
  if (event.participating_organizations && event.participating_organizations.length > 0) {
    totalChecks++;
    const orgsLower = event.participating_organizations.map(o => o.toLowerCase());
    if (icpTerms.some(term => orgsLower.some(org => org.includes(term)))) {
      matchCount++;
    }
  }

  // Calculate score: percentage of checks that matched
  const baseScore = totalChecks > 0 ? matchCount / totalChecks : 0;

  // Boost score if multiple ICP terms match
  const matchingTerms = icpTerms.filter(term => {
    const eventText = `${event.title || ''} ${event.description || ''} ${(event.topics || []).join(' ')}`.toLowerCase();
    return eventText.includes(term);
  }).length;

  const termMatchBoost = Math.min(matchingTerms / icpTerms.length, 0.3); // Max 30% boost

  return Math.min(1, baseScore + termMatchBoost);
}

/**
 * Calculate Attendee Quality Score
 * Compares event characteristics to similar events in the database
 */
export async function calculateAttendeeQualityScore(
  event: EventData
): Promise<number> {
  try {
    const supabase = supabaseAdmin();

    // Find similar events (same category/industry, similar timeframe)
    const eventText = `${event.title || ''} ${event.description || ''}`.toLowerCase();
    
    // Extract potential categories
    const categories = ['conference', 'summit', 'workshop', 'seminar', 'webinar'];
    const eventCategory = categories.find(cat => eventText.includes(cat)) || 'conference';

    // Get similar events from last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { data: similarEvents, error } = await supabase
      .from('collected_events')
      .select('speakers, sponsors, participating_organizations, confidence')
      .gte('starts_at', twelveMonthsAgo.toISOString())
      .or(`title.ilike.%${eventCategory}%,description.ilike.%${eventCategory}%`)
      .limit(100);

    if (error || !similarEvents || similarEvents.length === 0) {
      // Not enough data - return default score
      return 0.5;
    }

    // Calculate metrics for similar events
    const speakerCounts = similarEvents.map(e => (e.speakers as any[])?.length || 0);
    const sponsorCounts = similarEvents.map(e => {
      const sponsors = e.sponsors as any[];
      return Array.isArray(sponsors) ? sponsors.length : 0;
    });
    const orgCounts = similarEvents.map(e => {
      const orgs = e.participating_organizations as any[];
      return Array.isArray(orgs) ? orgs.length : 0;
    });

    // Calculate percentiles
    const currentSpeakerCount = (event.speakers?.length || 0);
    const currentSponsorCount = Array.isArray(event.sponsors) ? event.sponsors.length : 0;
    const currentOrgCount = (event.participating_organizations?.length || 0);

    const speakerPercentile = calculatePercentile(currentSpeakerCount, speakerCounts);
    const sponsorPercentile = calculatePercentile(currentSponsorCount, sponsorCounts);
    const orgPercentile = calculatePercentile(currentOrgCount, orgCounts);

    // Weighted average (speakers are most important)
    const qualityScore = (
      speakerPercentile * 0.5 +
      sponsorPercentile * 0.3 +
      orgPercentile * 0.2
    );

    return qualityScore;
  } catch (error) {
    console.error('[OpportunityScoring] Error calculating attendee quality:', error);
    return 0.5; // Default score on error
  }
}

/**
 * Calculate percentile of a value in an array
 */
function calculatePercentile(value: number, array: number[]): number {
  if (array.length === 0) return 0.5;

  const sorted = [...array].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;
  const equal = sorted.filter(v => v === value).length;

  return (below + equal / 2) / sorted.length;
}

/**
 * Estimate ROI based on event characteristics and historical data
 */
export async function estimateROI(
  event: EventData,
  userProfile?: UserProfile
): Promise<'high' | 'medium' | 'low' | 'unknown'> {
  try {
    const supabase = supabaseAdmin();

    // Factors that indicate high ROI:
    // 1. High ICP match
    const icpMatch = calculateICPMatchScore(event, userProfile);
    
    // 2. High attendee quality
    const attendeeQuality = await calculateAttendeeQualityScore(event);
    
    // 3. Event size (more speakers/sponsors = bigger event = more opportunities)
    const speakerCount = event.speakers?.length || 0;
    const sponsorCount = Array.isArray(event.sponsors) ? event.sponsors.length : 0;
    const eventSize = speakerCount + sponsorCount * 2; // Sponsors weighted more

    // 4. Event type (conferences/summits typically higher ROI than webinars)
    const eventText = `${event.title || ''} ${event.description || ''}`.toLowerCase();
    const isHighValueType = eventText.includes('conference') || 
                            eventText.includes('summit') ||
                            eventText.includes('forum');
    const typeScore = isHighValueType ? 1 : 0.5;

    // 5. Data completeness (more complete data = more reliable)
    const dataCompleteness = event.data_completeness || 0.5;

    // Calculate composite score
    const compositeScore = (
      icpMatch * 0.3 +
      attendeeQuality * 0.3 +
      Math.min(eventSize / 20, 1) * 0.2 + // Normalize to 20 as "large"
      typeScore * 0.1 +
      dataCompleteness * 0.1
    );

    // Classify ROI
    if (compositeScore >= 0.7) return 'high';
    if (compositeScore >= 0.4) return 'medium';
    if (compositeScore >= 0.2) return 'low';
    return 'unknown';
  } catch (error) {
    console.error('[OpportunityScoring] Error estimating ROI:', error);
    return 'unknown';
  }
}

/**
 * Calculate urgency indicators based on deadlines and timing
 */
export function calculateUrgencyIndicators(
  event: EventData
): UrgencyIndicators {
  const now = new Date();
  const urgencyFactors: number[] = [];
  let daysUntilEvent: number | undefined;
  let daysUntilEarlyBird: number | undefined;
  let daysUntilRegistrationDeadline: number | undefined;
  let hasEarlyBirdPricing = false;
  let registrationLimit: number | undefined;

  // Calculate days until event
  if (event.starts_at) {
    const eventDate = new Date(event.starts_at);
    daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilEvent > 0 && daysUntilEvent <= 30) {
      // Urgent if event is within 30 days
      urgencyFactors.push(1 - (daysUntilEvent / 30));
    } else if (daysUntilEvent > 0 && daysUntilEvent <= 90) {
      // Moderate urgency if within 90 days
      urgencyFactors.push(0.5 - ((daysUntilEvent - 30) / 120));
    }
  }

  // Check for early bird pricing (heuristic: look for "early bird" in description)
  if (event.description) {
    const descLower = event.description.toLowerCase();
    hasEarlyBirdPricing = descLower.includes('early bird') || 
                         descLower.includes('early-bird') ||
                         descLower.includes('early registration');
    
    if (hasEarlyBirdPricing) {
      // Assume early bird ends 30 days before event (heuristic)
      if (daysUntilEvent && daysUntilEvent > 30) {
        daysUntilEarlyBird = daysUntilEvent - 30;
        if (daysUntilEarlyBird <= 7) {
          urgencyFactors.push(0.8); // Very urgent
        } else if (daysUntilEarlyBird <= 14) {
          urgencyFactors.push(0.5); // Moderately urgent
        }
      }
    }
  }

  // Check for registration deadlines (heuristic: look for "deadline" or "register by")
  if (event.description) {
    const descLower = event.description.toLowerCase();
    if (descLower.includes('deadline') || descLower.includes('register by')) {
      // Extract date if possible (simplified - would need better parsing)
      // For now, assume deadline is 14 days before event
      if (daysUntilEvent && daysUntilEvent > 14) {
        daysUntilRegistrationDeadline = daysUntilEvent - 14;
        if (daysUntilRegistrationDeadline <= 3) {
          urgencyFactors.push(1.0); // Critical
        } else if (daysUntilRegistrationDeadline <= 7) {
          urgencyFactors.push(0.7); // High urgency
        }
      }
    }
  }

  // Calculate urgency score (0-1)
  const urgencyScore = urgencyFactors.length > 0
    ? Math.min(1, urgencyFactors.reduce((sum, factor) => sum + factor, 0) / urgencyFactors.length)
    : 0;

  // Determine urgency level
  let urgencyLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  if (urgencyScore >= 0.8) {
    urgencyLevel = 'critical';
  } else if (urgencyScore >= 0.6) {
    urgencyLevel = 'high';
  } else if (urgencyScore >= 0.4) {
    urgencyLevel = 'medium';
  } else if (urgencyScore >= 0.2) {
    urgencyLevel = 'low';
  } else {
    urgencyLevel = 'none';
  }

  // Generate recommended action
  let recommendedAction = 'Consider this event for future planning';
  if (urgencyLevel === 'critical') {
    recommendedAction = 'Act immediately - deadlines approaching';
  } else if (urgencyLevel === 'high') {
    recommendedAction = 'Act soon - time-sensitive opportunity';
  } else if (urgencyLevel === 'medium') {
    recommendedAction = 'Plan action within next 2 weeks';
  } else if (urgencyLevel === 'low') {
    recommendedAction = 'Add to consideration list';
  }

  return {
    urgencyScore,
    daysUntilEvent,
    daysUntilEarlyBird,
    daysUntilRegistrationDeadline,
    hasEarlyBirdPricing,
    registrationLimit,
    urgencyLevel,
    recommendedAction
  };
}

/**
 * Calculate comprehensive opportunity score
 */
export async function calculateOpportunityScore(
  event: EventData,
  userProfile?: UserProfile
): Promise<OpportunityScore> {
  // Calculate all components
  const icpMatchScore = calculateICPMatchScore(event, userProfile);
  const attendeeQualityScore = await calculateAttendeeQualityScore(event);
  const roiEstimate = await estimateROI(event, userProfile);
  const urgencyIndicators = calculateUrgencyIndicators(event);

  // Convert ROI estimate to numeric score
  const roiScore = roiEstimate === 'high' ? 0.9 :
                   roiEstimate === 'medium' ? 0.6 :
                   roiEstimate === 'low' ? 0.3 : 0.5;

  // Calculate overall score (weighted combination)
  const overallScore = (
    icpMatchScore * 0.3 +
    attendeeQualityScore * 0.25 +
    roiScore * 0.25 +
    urgencyIndicators.urgencyScore * 0.2
  );

  // Calculate confidence based on data completeness
  const dataCompleteness = event.data_completeness || 0.5;
  const hasRequiredFields = !!(event.title && event.description && event.starts_at);
  const confidence = hasRequiredFields 
    ? Math.min(1, dataCompleteness * 0.8 + 0.2)
    : dataCompleteness * 0.5;

  return {
    icpMatchScore,
    attendeeQualityScore,
    roiEstimate,
    urgencyScore: urgencyIndicators.urgencyScore,
    overallScore,
    confidence
  };
}

