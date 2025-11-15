/**
 * Insight Scoring Service
 * 
 * Calculates comprehensive insight scores based on:
 * - Relevance (30%): User profile match, industry alignment, ICP match
 * - Impact (30%): Business value, ROI, market size, competitive advantage
 * - Urgency (20%): Time sensitivity, deadlines, market timing
 * - Confidence (20%): Data quality, statistical significance, source reliability
 * 
 * Phase 2B Implementation: Insight Scoring System
 */

import { EventData, UserProfile } from '@/lib/types/core';
import { EventIntelligence } from './event-intelligence-service';
import { OpportunityScore, UrgencyIndicators } from './opportunity-scoring-service';
import { TrendSignificance } from './statistical-analysis-service';

/**
 * Scoring weights (can be customized per user)
 */
export interface ScoringWeights {
  relevance: number; // Default: 0.3
  impact: number; // Default: 0.3
  urgency: number; // Default: 0.2
  confidence: number; // Default: 0.2
}

/**
 * Score breakdown for transparency
 */
export interface ScoreBreakdown {
  relevance: number; // 0-1
  impact: number; // 0-1
  urgency: number; // 0-1
  confidence: number; // 0-1
  factors: {
    relevance: {
      userProfileMatch: number;
      industryAlignment: number;
      icpMatch: number;
    };
    impact: {
      businessValue: number;
      roiEstimate: number;
      marketSize: number;
      competitiveAdvantage: number;
    };
    urgency: {
      timeSensitivity: number;
      deadlineProximity: number;
      marketTiming: number;
    };
    confidence: {
      dataQuality: number;
      statisticalSignificance: number;
      sourceReliability: number;
    };
  };
}

/**
 * Complete insight score
 */
export interface InsightScore {
  overallScore: number; // 0-1, weighted combination
  breakdown: ScoreBreakdown;
  weights: ScoringWeights;
  calculatedAt: string;
}

/**
 * Default scoring weights
 */
const DEFAULT_WEIGHTS: ScoringWeights = {
  relevance: 0.3,
  impact: 0.3,
  urgency: 0.2,
  confidence: 0.2
};

/**
 * Calculate insight score for an event
 */
export function calculateInsightScore(
  event: EventData,
  intelligence: EventIntelligence,
  userProfile?: UserProfile,
  customWeights?: Partial<ScoringWeights>,
  trendSignificance?: TrendSignificance
): InsightScore {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };
  
  // Normalize weights to ensure they sum to 1.0
  const totalWeight = weights.relevance + weights.impact + weights.urgency + weights.confidence;
  if (totalWeight > 0) {
    weights.relevance /= totalWeight;
    weights.impact /= totalWeight;
    weights.urgency /= totalWeight;
    weights.confidence /= totalWeight;
  }

  // Calculate each factor
  const relevanceScore = calculateRelevanceScore(event, intelligence, userProfile);
  const impactScore = calculateImpactScore(event, intelligence);
  const urgencyScore = calculateUrgencyScore(event, intelligence);
  const confidenceScore = calculateConfidenceScore(event, intelligence, trendSignificance);

  // Create breakdown
  const breakdown: ScoreBreakdown = {
    relevance: relevanceScore.overall,
    impact: impactScore.overall,
    urgency: urgencyScore.overall,
    confidence: confidenceScore.overall,
    factors: {
      relevance: relevanceScore.factors,
      impact: impactScore.factors,
      urgency: urgencyScore.factors,
      confidence: confidenceScore.factors
    }
  };

  // Calculate weighted overall score
  const overallScore = (
    relevanceScore.overall * weights.relevance +
    impactScore.overall * weights.impact +
    urgencyScore.overall * weights.urgency +
    confidenceScore.overall * weights.confidence
  );

  return {
    overallScore: Math.min(1, Math.max(0, overallScore)), // Clamp to 0-1
    breakdown,
    weights,
    calculatedAt: new Date().toISOString()
  };
}

/**
 * Calculate relevance score (30% weight)
 */
function calculateRelevanceScore(
  event: EventData,
  intelligence: EventIntelligence,
  userProfile?: UserProfile
): { overall: number; factors: ScoreBreakdown['factors']['relevance'] } {
  if (!userProfile) {
    // Without user profile, use default relevance
    return {
      overall: 0.5,
      factors: {
        userProfileMatch: 0.5,
        industryAlignment: 0.5,
        icpMatch: 0.5
      }
    };
  }

  // User profile match (industry terms)
  const userProfileMatch = calculateUserProfileMatch(event, userProfile);

  // Industry alignment
  const industryAlignment = calculateIndustryAlignment(event, userProfile);

  // ICP match (from opportunity score if available, otherwise calculate)
  let icpMatch = 0.5;
  if (intelligence.opportunityScore) {
    icpMatch = intelligence.opportunityScore.icpMatchScore;
  } else {
    // Fallback calculation
    icpMatch = calculateICPMatch(event, userProfile);
  }

  // Weighted combination: ICP match is most important (50%), then industry (30%), then profile (20%)
  const overall = (
    icpMatch * 0.5 +
    industryAlignment * 0.3 +
    userProfileMatch * 0.2
  );

  return {
    overall: Math.min(1, Math.max(0, overall)),
    factors: {
      userProfileMatch,
      industryAlignment,
      icpMatch
    }
  };
}

/**
 * Calculate user profile match
 */
function calculateUserProfileMatch(event: EventData, userProfile: UserProfile): number {
  if (!userProfile.industry_terms || userProfile.industry_terms.length === 0) {
    return 0.5;
  }

  const industryTerms = userProfile.industry_terms.map(t => t.toLowerCase());
  const eventText = `${event.title || ''} ${event.description || ''} ${(event.topics || []).join(' ')}`.toLowerCase();

  let matchCount = 0;
  industryTerms.forEach(term => {
    if (eventText.includes(term.toLowerCase())) {
      matchCount++;
    }
  });

  // Normalize: 0 matches = 0, all matches = 1
  return Math.min(1, matchCount / industryTerms.length);
}

/**
 * Calculate industry alignment
 */
function calculateIndustryAlignment(event: EventData, userProfile: UserProfile): number {
  // Similar to user profile match but with different weighting
  return calculateUserProfileMatch(event, userProfile);
}

/**
 * Calculate ICP match (fallback if not in opportunity score)
 */
function calculateICPMatch(event: EventData, userProfile: UserProfile): number {
  if (!userProfile.icp_terms || userProfile.icp_terms.length === 0) {
    return 0.5;
  }

  const icpTerms = userProfile.icp_terms.map(t => t.toLowerCase());
  const eventText = `${event.title || ''} ${event.description || ''} ${(event.topics || []).join(' ')}`.toLowerCase();

  let matchCount = 0;
  icpTerms.forEach(term => {
    if (eventText.includes(term.toLowerCase())) {
      matchCount++;
    }
  });

  return Math.min(1, matchCount / icpTerms.length);
}

/**
 * Calculate impact score (30% weight)
 */
function calculateImpactScore(
  event: EventData,
  intelligence: EventIntelligence
): { overall: number; factors: ScoreBreakdown['factors']['impact'] } {
  // Business value (from opportunity score)
  let businessValue = 0.5;
  if (intelligence.opportunityScore) {
    businessValue = intelligence.opportunityScore.overallScore;
  }

  // ROI estimate (from opportunity score)
  let roiEstimate = 0.5;
  if (intelligence.opportunityScore) {
    switch (intelligence.opportunityScore.roiEstimate) {
      case 'high':
        roiEstimate = 0.9;
        break;
      case 'medium':
        roiEstimate = 0.6;
        break;
      case 'low':
        roiEstimate = 0.3;
        break;
      default:
        roiEstimate = 0.5;
    }
  }

  // Market size (based on event characteristics)
  const marketSize = calculateMarketSize(event, intelligence);

  // Competitive advantage (based on sponsor analysis)
  const competitiveAdvantage = calculateCompetitiveAdvantage(event, intelligence);

  // Weighted combination
  const overall = (
    businessValue * 0.4 +
    roiEstimate * 0.3 +
    marketSize * 0.2 +
    competitiveAdvantage * 0.1
  );

  return {
    overall: Math.min(1, Math.max(0, overall)),
    factors: {
      businessValue,
      roiEstimate,
      marketSize,
      competitiveAdvantage
    }
  };
}

/**
 * Calculate market size indicator
 */
function calculateMarketSize(event: EventData, intelligence: EventIntelligence): number {
  let score = 0.5; // Base score

  // Event size indicators
  if (intelligence.sponsors?.tiers && intelligence.sponsors.tiers.length > 0) {
    // More sponsor tiers = larger market
    score += Math.min(0.3, intelligence.sponsors.tiers.length * 0.1);
  }

  if (event.speakers && event.speakers.length > 10) {
    score += 0.1; // Large speaker lineup
  }

  if (intelligence.sponsors?.strategicSignificance) {
    score += intelligence.sponsors.strategicSignificance * 0.1;
  }

  return Math.min(1, score);
}

/**
 * Calculate competitive advantage
 */
function calculateCompetitiveAdvantage(event: EventData, intelligence: EventIntelligence): number {
  // Based on sponsor analysis and strategic significance
  if (intelligence.sponsors?.strategicSignificance) {
    return intelligence.sponsors.strategicSignificance;
  }

  // Fallback: presence of sponsors indicates competitive value
  if (event.sponsors && event.sponsors.length > 0) {
    return 0.6;
  }

  return 0.5;
}

/**
 * Calculate urgency score (20% weight)
 */
function calculateUrgencyScore(
  event: EventData,
  intelligence: EventIntelligence
): { overall: number; factors: ScoreBreakdown['factors']['urgency'] } {
  // Time sensitivity (from urgency indicators)
  let timeSensitivity = 0.5;
  let deadlineProximity = 0.5;
  let marketTiming = 0.5;

  if (intelligence.urgencyIndicators) {
    timeSensitivity = intelligence.urgencyIndicators.urgencyScore;

    // Deadline proximity based on days until event
    if (intelligence.urgencyIndicators.daysUntilEvent !== undefined) {
      const daysUntil = intelligence.urgencyIndicators.daysUntilEvent;
      if (daysUntil <= 7) {
        deadlineProximity = 1.0; // Very urgent
      } else if (daysUntil <= 30) {
        deadlineProximity = 0.8; // High urgency
      } else if (daysUntil <= 90) {
        deadlineProximity = 0.6; // Medium urgency
      } else {
        deadlineProximity = 0.4; // Low urgency
      }
    }

    // Market timing based on urgency level
    switch (intelligence.urgencyIndicators.urgencyLevel) {
      case 'critical':
        marketTiming = 1.0;
        break;
      case 'high':
        marketTiming = 0.8;
        break;
      case 'medium':
        marketTiming = 0.6;
        break;
      case 'low':
        marketTiming = 0.4;
        break;
      default:
        marketTiming = 0.5;
    }
  } else {
    // Fallback: calculate from event dates
    if (event.starts_at) {
      const eventDate = new Date(event.starts_at);
      const now = new Date();
      const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntil > 0 && daysUntil <= 30) {
        timeSensitivity = 0.8;
        deadlineProximity = 0.8;
      } else if (daysUntil > 30 && daysUntil <= 90) {
        timeSensitivity = 0.6;
        deadlineProximity = 0.6;
      }
    }
  }

  // Weighted combination
  const overall = (
    timeSensitivity * 0.5 +
    deadlineProximity * 0.3 +
    marketTiming * 0.2
  );

  return {
    overall: Math.min(1, Math.max(0, overall)),
    factors: {
      timeSensitivity,
      deadlineProximity,
      marketTiming
    }
  };
}

/**
 * Calculate confidence score (20% weight)
 */
function calculateConfidenceScore(
  event: EventData,
  intelligence: EventIntelligence,
  trendSignificance?: TrendSignificance
): { overall: number; factors: ScoreBreakdown['factors']['confidence'] } {
  // Data quality (from event data completeness)
  const dataQuality = event.data_completeness || calculateDataQuality(event);

  // Statistical significance (from trend analysis if available)
  let statisticalSignificance = 0.5;
  if (trendSignificance) {
    statisticalSignificance = trendSignificance.significanceScore || 0.5;
  } else if (intelligence.confidence) {
    // Use intelligence confidence as proxy
    statisticalSignificance = intelligence.confidence;
  }

  // Source reliability (based on event verification and data sources)
  const sourceReliability = calculateSourceReliability(event, intelligence);

  // Weighted combination
  const overall = (
    dataQuality * 0.4 +
    statisticalSignificance * 0.4 +
    sourceReliability * 0.2
  );

  return {
    overall: Math.min(1, Math.max(0, overall)),
    factors: {
      dataQuality,
      statisticalSignificance,
      sourceReliability
    }
  };
}

/**
 * Calculate data quality from event data
 */
function calculateDataQuality(event: EventData): number {
  let score = 0;
  let checks = 0;

  // Title
  if (event.title) {
    score += 0.1;
  }
  checks++;

  // Description
  if (event.description && event.description.length > 50) {
    score += 0.2;
  }
  checks++;

  // Topics
  if (event.topics && event.topics.length > 0) {
    score += 0.15;
  }
  checks++;

  // Speakers
  if (event.speakers && event.speakers.length > 0) {
    score += 0.15;
  }
  checks++;

  // Sponsors
  if (event.sponsors && event.sponsors.length > 0) {
    score += 0.1;
  }
  checks++;

  // Location
  if (event.city && event.country) {
    score += 0.1;
  }
  checks++;

  // Dates
  if (event.starts_at) {
    score += 0.1;
  }
  checks++;

  // Organizer
  if (event.organizer) {
    score += 0.1;
  }
  checks++;

  return Math.min(1, score);
}

/**
 * Calculate source reliability
 */
function calculateSourceReliability(event: EventData, intelligence: EventIntelligence): number {
  let score = 0.5; // Base score

  // Verification status
  if (event.verification_status === 'verified') {
    score = 0.9;
  } else if (event.verification_status === 'outdated') {
    score = 0.3;
  }

  // Confidence from intelligence
  if (intelligence.confidence) {
    score = (score + intelligence.confidence) / 2;
  }

  // Source URL presence
  if (event.source_url) {
    score += 0.1;
  }

  return Math.min(1, score);
}

/**
 * Filter insights by minimum score
 */
export function filterInsightsByScore<T extends { insightScore?: InsightScore }>(
  insights: T[],
  minScore: number = 0.3
): T[] {
  return insights.filter(insight => {
    if (!insight.insightScore) return false;
    return insight.insightScore.overallScore >= minScore;
  });
}

/**
 * Sort insights by score
 */
export function sortInsightsByScore<T extends { insightScore?: InsightScore }>(
  insights: T[],
  direction: 'asc' | 'desc' = 'desc'
): T[] {
  return [...insights].sort((a, b) => {
    const scoreA = a.insightScore?.overallScore || 0;
    const scoreB = b.insightScore?.overallScore || 0;
    
    if (direction === 'desc') {
      return scoreB - scoreA;
    } else {
      return scoreA - scoreB;
    }
  });
}

/**
 * Get personalized weights based on user preferences
 * (Future: can be stored in user profile)
 */
export function getPersonalizedWeights(
  userProfile?: UserProfile
): Partial<ScoringWeights> | undefined {
  // For now, return default weights
  // In future, can customize based on user behavior/preferences
  return undefined;
}

