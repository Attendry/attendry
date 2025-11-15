/**
 * Trend Analysis Service
 * 
 * Analyzes events across categories to identify personalized trends and hot topics
 * based on user's industry/categories
 */

import { EventData, UserProfile } from '@/lib/types/core';
import { LLMService } from './llm-service';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { normalizeTopics, TAXONOMY_VERSION } from '@/lib/utils/topic-normalizer';
import { normalizeOrg } from '@/lib/utils/org-normalizer';
import { calculateInsightScore, getPersonalizedWeights, type InsightScore } from './insight-scoring-service';
import { getEventIntelligence, generateEventIntelligence } from './event-intelligence-service';

export interface HotTopic {
  topic: string;
  mentionCount: number;
  growthRate: number;
  momentum: number;
  relatedEvents: string[];
  category: string;
  relevanceScore: number;
  // Phase 1A enhancements
  geographicDistribution?: string[]; // Top countries/cities
  industryBreakdown?: Record<string, number>; // Industry -> count
  growthTrajectory?: 'rising' | 'stable' | 'declining';
  validationScore?: number; // 0-1, based on cross-event validation
  businessRelevance?: 'high' | 'medium' | 'low';
  // Phase 2B: Insight Scoring
  insightScore?: InsightScore;
}

export interface EmergingTheme {
  theme: string;
  description: string;
  growth: number;
  events: EventData[];
  relevanceScore: number;
  // Phase 2B: Insight Scoring
  insightScore?: InsightScore;
}

export interface TrendAnalysisResult {
  hotTopics: HotTopic[];
  emergingThemes: EmergingTheme[];
  analyzedEventCount: number;
  filteredEventCount: number;
  confidence: number;
}

/**
 * Generate hash for user profile (for cache keys)
 */
function hashUserProfile(userProfile?: UserProfile): string {
  if (!userProfile) return 'global';
  
  const profileString = JSON.stringify({
    industry: userProfile.industry_terms?.sort() || [],
    icp: userProfile.icp_terms?.sort() || [],
    competitors: userProfile.competitors?.sort() || []
  });
  
  return crypto.createHash('sha256').update(profileString).digest('hex').substring(0, 16);
}

/**
 * Filter events by user profile
 */
export function filterEventsByUserProfile(
  events: EventData[],
  userProfile?: UserProfile
): EventData[] {
  if (!userProfile || (!userProfile.industry_terms?.length && !userProfile.icp_terms?.length)) {
    return events;
  }

  const industryTerms = userProfile.industry_terms || [];
  const icpTerms = userProfile.icp_terms || [];
  const competitors = userProfile.competitors || [];

  return events.filter(event => {
    const eventText = `${event.title || ''} ${event.description || ''} ${(event.topics || []).join(' ')}`.toLowerCase();
    
    // Check industry terms
    const matchesIndustry = industryTerms.some(term => 
      eventText.includes(term.toLowerCase())
    );
    
    // Check ICP terms
    const matchesICP = icpTerms.some(term => 
      eventText.includes(term.toLowerCase())
    );
    
    // Check competitors (speakers, sponsors, organizations)
    const matchesCompetitor = competitors.some(competitor => {
      const competitorLower = competitor.toLowerCase();
      return eventText.includes(competitorLower) ||
             event.speakers?.some(s => s.org?.toLowerCase().includes(competitorLower)) ||
             event.sponsors?.some(s => {
               const sponsorName = typeof s === 'string' ? s : s.name;
               return sponsorName?.toLowerCase().includes(competitorLower);
             }) ||
             event.participating_organizations?.some(org => org.toLowerCase().includes(competitorLower));
    });
    
    return matchesIndustry || matchesICP || matchesCompetitor;
  });
}

/**
 * Analyze category trends with growth patterns
 */
export async function analyzeCategoryTrends(
  events: EventData[],
  timeWindow: string,
  userProfile?: UserProfile
): Promise<{ categories: Array<{ name: string; count: number; growth: number }> }> {
  // Filter events by user profile
  const filteredEvents = filterEventsByUserProfile(events, userProfile);
  
  // Group by categories (industry and event type)
  const categoryCounts: Map<string, number> = new Map();
  
  filteredEvents.forEach(event => {
    // Extract categories from topics, title, description
    const text = `${event.title || ''} ${event.description || ''} ${(event.topics || []).join(' ')}`.toLowerCase();
    
    // Industry categories
    const industryCategories = [
      'legal', 'compliance', 'fintech', 'healthcare', 'technology',
      'finance', 'insurance', 'banking', 'regulatory', 'risk management',
      'data protection', 'cybersecurity', 'esg', 'governance'
    ];
    
    industryCategories.forEach(cat => {
      if (text.includes(cat)) {
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }
    });
    
    // Event type categories
    const eventTypes = [
      'conference', 'summit', 'workshop', 'seminar', 'webinar',
      'training', 'certification', 'networking', 'exhibition', 'forum'
    ];
    
    eventTypes.forEach(type => {
      if (text.includes(type)) {
        categoryCounts.set(type, (categoryCounts.get(type) || 0) + 1);
      }
    });
  });
  
  // Convert to array and calculate growth (simplified - would need historical data)
  const categories = Array.from(categoryCounts.entries()).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count,
    growth: 0 // Would need previous period data to calculate
  }));
  
  return { categories };
}

/**
 * Extract hot topics from events using LLM
 */
export async function extractHotTopics(
  events: EventData[],
  userProfile?: UserProfile,
  category?: string
): Promise<HotTopic[]> {
  // Filter events by user profile and category
  let filteredEvents = filterEventsByUserProfile(events, userProfile);
  
  if (category) {
    const categoryLower = category.toLowerCase();
    filteredEvents = filteredEvents.filter(event => {
      const text = `${event.title || ''} ${event.description || ''} ${(event.topics || []).join(' ')}`.toLowerCase();
      return text.includes(categoryLower);
    });
  }
  
  if (filteredEvents.length === 0) {
    return [];
  }
  
  // Prepare event summaries for LLM
  const eventSummaries = filteredEvents.slice(0, 50).map(event => ({
    title: event.title,
    description: event.description?.substring(0, 200),
    topics: event.topics || [],
    url: event.source_url
  }));
  
  const prompt = `You are analyzing professional events to identify hot topics that are valuable for business intelligence and strategic decision-making.

EVENTS TO ANALYZE:
${JSON.stringify(eventSummaries, null, 2)}

USER CONTEXT:
${userProfile ? JSON.stringify({
  industry: userProfile.industry_terms,
  icp: userProfile.icp_terms,
  competitors: userProfile.competitors
}, null, 2) : 'No specific user context - provide general business-relevant topics'}

EXTRACTION REQUIREMENTS:
1. Extract topics that are mentioned across MULTIPLE events (minimum 2-3 events)
2. Focus on BUSINESS-RELEVANT topics:
   - Industry trends and technologies
   - Regulatory and compliance topics
   - Market opportunities and challenges
   - Professional skills and certifications
   - Strategic business themes
3. AVOID generic topics like "networking", "conference", "event" unless they represent a significant trend
4. Prioritize topics that are:
   - Emerging or growing in importance
   - Actionable for business decisions
   - Relevant to the user's industry/ICP (if provided)
   - Mentioned in event titles, descriptions, or topics

VALIDATION RULES:
- Each topic must appear in at least 2 different events
- Topics should be specific enough to be actionable (not too broad)
- Topics should represent genuine business interest, not just event logistics

Return a JSON array of hot topics with this EXACT structure:
[
  {
    "topic": "string - specific, actionable topic name (e.g., 'AI in Legal Practice', not just 'AI')",
    "mentionCount": number - actual count of events mentioning this topic (must be >= 2),
    "growthRate": number - estimated growth rate (0-100) based on frequency across events,
    "momentum": number - momentum score (0-1) indicating how rapidly this topic is gaining attention,
    "relatedEvents": ["url1", "url2"] - URLs of events that mention this topic,
    "category": "string - primary business category (e.g., 'Technology', 'Compliance', 'Market Trends')",
    "relevanceScore": number - relevance to user's context (0-1),
    "businessRelevance": "high" | "medium" | "low" - how actionable this topic is for business decisions
  }
]

Return ONLY the JSON array, no additional text, no markdown formatting, no explanations.`;

  try {
    const response = await LLMService.extractTopics(prompt, { events: eventSummaries });
    
    let hotTopics: HotTopic[] = [];
    if (Array.isArray(response.content)) {
      hotTopics = response.content;
    } else if (response.content && Array.isArray(response.content.topics)) {
      hotTopics = response.content.topics;
    }
    
    // Phase 1A: Enhanced validation and filtering
    const validatedTopics = validateHotTopics(hotTopics, filteredEvents);
    
    if (validatedTopics.length === 0) {
      console.warn('[TrendAnalysis] No valid hot topics found after validation');
      return []; // Return empty array instead of fallback
    }
    
    // Enrich topics with additional data
    const enrichedTopics = await enrichHotTopics(validatedTopics, filteredEvents);
    
    // Sort by combined score (momentum * relevance * validation)
    return enrichedTopics
      .sort((a, b) => {
        const scoreA = (a.momentum || 0) * (a.relevanceScore || 0) * (a.validationScore || 0.5);
        const scoreB = (b.momentum || 0) * (b.relevanceScore || 0) * (b.validationScore || 0.5);
        return scoreB - scoreA;
      })
      .slice(0, 20); // Limit to top 20
      
  } catch (error) {
    console.error('[TrendAnalysis] Failed to extract hot topics:', error);
    // Phase 1A: Remove fallback - return empty array instead
    // This ensures we only show high-quality, LLM-extracted topics
    return [];
  }
}

/**
 * Calculate a quick score estimate for a topic based on characteristics
 * (used when full event intelligence is not available)
 */
function calculateTopicScoreEstimate(
  topic: HotTopic,
  event: EventData,
  userProfile?: UserProfile
): number {
  let score = 0.5; // Base score
  
  // Relevance from topic relevance score
  score += topic.relevanceScore * 0.3;
  
  // Impact from momentum and business relevance
  const impactScore = topic.momentum || 0.5;
  const businessRelevanceScore = topic.businessRelevance === 'high' ? 0.9 : 
                                  topic.businessRelevance === 'medium' ? 0.6 : 0.3;
  score += (impactScore * 0.5 + businessRelevanceScore * 0.5) * 0.3;
  
  // Urgency from growth rate
  const urgencyScore = Math.min(1, (topic.growthRate || 0) / 100);
  score += urgencyScore * 0.2;
  
  // Confidence from validation score
  score += (topic.validationScore || 0.5) * 0.2;
  
  return Math.min(1, score);
}

/**
 * Calculate a quick score estimate for an emerging theme
 */
function calculateThemeScoreEstimate(
  theme: EmergingTheme,
  event: EventData,
  userProfile?: UserProfile
): number {
  let score = 0.5; // Base score
  
  // Relevance
  score += theme.relevanceScore * 0.3;
  
  // Impact from growth
  const impactScore = Math.min(1, (theme.growth || 0) / 100);
  score += impactScore * 0.3;
  
  // Urgency from growth rate
  const urgencyScore = Math.min(1, (theme.growth || 0) / 200);
  score += urgencyScore * 0.2;
  
  // Confidence (moderate for emerging themes)
  score += 0.7 * 0.2;
  
  return Math.min(1, score);
}

/**
 * Validate hot topics extracted by LLM
 * Phase 1A: Enhanced validation with minimum mention threshold and cross-event validation
 */
function validateHotTopics(
  topics: HotTopic[],
  events: EventData[]
): HotTopic[] {
  const MIN_MENTION_THRESHOLD = 2; // Topic must appear in at least 2 events
  const MIN_VALIDATION_SCORE = 0.3; // Minimum validation score to keep
  
  return topics
    .filter(topic => {
      // Basic validation
      if (!topic.topic || topic.topic.trim().length === 0) {
        return false;
      }
      
      // Minimum mention threshold
      if (topic.mentionCount < MIN_MENTION_THRESHOLD) {
        return false;
      }
      
      // Cross-event validation: verify topic actually appears in multiple events
      const topicLower = topic.topic.toLowerCase();
      let actualMentions = 0;
      
      events.forEach(event => {
        const eventText = `${event.title || ''} ${event.description || ''} ${(event.topics || []).join(' ')}`.toLowerCase();
        if (eventText.includes(topicLower)) {
          actualMentions++;
        }
      });
      
      // Calculate validation score based on actual mentions vs reported mentions
      const validationScore = actualMentions >= MIN_MENTION_THRESHOLD
        ? Math.min(actualMentions / topic.mentionCount, 1.0)
        : 0;
      
      topic.validationScore = validationScore;
      
      // Update mention count to actual count
      topic.mentionCount = actualMentions;
      
      return validationScore >= MIN_VALIDATION_SCORE && actualMentions >= MIN_MENTION_THRESHOLD;
    });
}

/**
 * Enrich hot topics with additional data
 * Phase 1A: Add geographic distribution, industry breakdown, growth trajectory
 */
async function enrichHotTopics(
  topics: HotTopic[],
  events: EventData[]
): Promise<HotTopic[]> {
  return topics.map(topic => {
    const topicLower = topic.topic.toLowerCase();
    
    // Find events that mention this topic
    const relatedEvents = events.filter(event => {
      const eventText = `${event.title || ''} ${event.description || ''} ${(event.topics || []).join(' ')}`.toLowerCase();
      return eventText.includes(topicLower);
    });
    
    // Geographic distribution
    const countries = new Map<string, number>();
    const cities = new Map<string, number>();
    relatedEvents.forEach(event => {
      if (event.country) {
        countries.set(event.country, (countries.get(event.country) || 0) + 1);
      }
      if (event.city) {
        cities.set(event.city, (cities.get(event.city) || 0) + 1);
      }
    });
    
    const topCountries = Array.from(countries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([country]) => country);
    
    // Industry breakdown (simplified - based on event topics/descriptions)
    const industryCounts: Record<string, number> = {};
    const industryKeywords: Record<string, string[]> = {
      'Legal': ['legal', 'law', 'compliance', 'regulatory', 'governance'],
      'FinTech': ['fintech', 'financial technology', 'banking', 'finance'],
      'Healthcare': ['healthcare', 'medical', 'health', 'pharma'],
      'Technology': ['technology', 'tech', 'software', 'digital', 'ai', 'artificial intelligence'],
      'Finance': ['finance', 'banking', 'investment', 'trading'],
      'Insurance': ['insurance', 'risk management', 'actuarial'],
    };
    
    relatedEvents.forEach(event => {
      const eventText = `${event.title || ''} ${event.description || ''}`.toLowerCase();
      Object.entries(industryKeywords).forEach(([industry, keywords]) => {
        if (keywords.some(keyword => eventText.includes(keyword))) {
          industryCounts[industry] = (industryCounts[industry] || 0) + 1;
        }
      });
    });
    
    // Growth trajectory (simplified - would need historical data for accurate calculation)
    // For now, use momentum as proxy
    const growthTrajectory: 'rising' | 'stable' | 'declining' = 
      (topic.momentum || 0) > 0.7 ? 'rising' :
      (topic.momentum || 0) > 0.4 ? 'stable' : 'declining';
    
    return {
      ...topic,
      geographicDistribution: topCountries,
      industryBreakdown: industryCounts,
      growthTrajectory,
      relatedEvents: relatedEvents.map(e => e.source_url).slice(0, 10) // Limit to 10 URLs
    };
  });
}

/**
 * Identify emerging themes by comparing current vs previous period
 */
export async function identifyEmergingThemes(
  events: EventData[],
  previousPeriod: EventData[],
  userProfile?: UserProfile
): Promise<EmergingTheme[]> {
  const currentFiltered = filterEventsByUserProfile(events, userProfile);
  const previousFiltered = filterEventsByUserProfile(previousPeriod, userProfile);
  
  if (currentFiltered.length === 0) {
    return [];
  }
  
  // Extract themes from current events
  const currentThemes = extractThemesFromEvents(currentFiltered);
  const previousThemes = extractThemesFromEvents(previousFiltered);
  
  // Calculate growth for each theme
  const emergingThemes: EmergingTheme[] = [];
  
  currentThemes.forEach((currentCount, theme) => {
    const previousCount = previousThemes.get(theme) || 0;
    const growth = previousCount > 0 
      ? ((currentCount - previousCount) / previousCount) * 100
      : 100;
    
    if (growth > 20 || (growth > 0 && currentCount >= 3)) {
      const relatedEvents = currentFiltered
        .filter(e => {
          const text = `${e.title || ''} ${e.description || ''}`.toLowerCase();
          return text.includes(theme.toLowerCase());
        })
        .slice(0, 5);
      
      emergingThemes.push({
        theme,
        description: `Emerging theme with ${currentCount} events (${growth > 0 ? '+' : ''}${growth.toFixed(1)}% growth)`,
        growth,
        events: relatedEvents,
        relevanceScore: userProfile ? 0.8 : 0.6
      });
    }
  });
  
  // Phase 2B: Calculate insight scores for emerging themes
  const themesWithScores = await Promise.all(
    emergingThemes.map(async (theme) => {
      try {
        if (theme.events.length > 0) {
          // Calculate aggregate insight score from related events
          const scores = await Promise.all(
            theme.events.slice(0, 5).map(async (event) => {
              try {
                const intelligence = await getEventIntelligence(
                  event.id || event.source_url,
                  userProfile
                ).catch(() => null);
                
                if (intelligence && intelligence.insightScore) {
                  return intelligence.insightScore.overallScore;
                }
                
                // Estimate score based on theme characteristics
                return calculateThemeScoreEstimate(theme, event, userProfile);
              } catch {
                return 0.5;
              }
            })
          );
          
          const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
          
          // Create insight score for the theme
          const themeInsightScore: InsightScore = {
            overallScore: avgScore,
            breakdown: {
              relevance: theme.relevanceScore,
              impact: Math.min(1, (theme.growth || 0) / 100),
              urgency: Math.min(1, (theme.growth || 0) / 200), // Growth indicates urgency
              confidence: 0.7, // Emerging themes have moderate confidence
              factors: {
                relevance: {
                  userProfileMatch: theme.relevanceScore,
                  industryAlignment: theme.relevanceScore,
                  icpMatch: theme.relevanceScore
                },
                impact: {
                  businessValue: Math.min(1, (theme.growth || 0) / 100),
                  roiEstimate: 0.6,
                  marketSize: Math.min(1, theme.events.length / 10),
                  competitiveAdvantage: 0.5
                },
                urgency: {
                  timeSensitivity: Math.min(1, (theme.growth || 0) / 200),
                  deadlineProximity: 0.5,
                  marketTiming: theme.growth > 50 ? 0.8 : 0.5
                },
                confidence: {
                  dataQuality: 0.7,
                  statisticalSignificance: 0.6,
                  sourceReliability: 0.7
                }
              }
            },
            weights: {
              relevance: 0.3,
              impact: 0.3,
              urgency: 0.2,
              confidence: 0.2
            },
            calculatedAt: new Date().toISOString()
          };
          
          return { ...theme, insightScore: themeInsightScore };
        }
        
        return theme;
      } catch (error) {
        console.error('[TrendAnalysis] Error calculating insight score for theme:', error);
        return theme;
      }
    })
  );
  
  // Sort by insight score (if available), then by growth
  return themesWithScores
    .sort((a, b) => {
      const scoreA = a.insightScore?.overallScore ?? (a.growth / 100);
      const scoreB = b.insightScore?.overallScore ?? (b.growth / 100);
      return scoreB - scoreA;
    })
    .slice(0, 10);
}

/**
 * Extract themes from events (simplified keyword-based)
 */
function extractThemesFromEvents(events: EventData[]): Map<string, number> {
  const themes: Map<string, number> = new Map();
  
  // Common business themes
  const themeKeywords = [
    'ai', 'artificial intelligence', 'machine learning',
    'digital transformation', 'cloud', 'cybersecurity',
    'sustainability', 'esg', 'compliance', 'regulation',
    'innovation', 'startup', 'fintech', 'blockchain',
    'data privacy', 'gdpr', 'remote work', 'hybrid'
  ];
  
  events.forEach(event => {
    const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
    
    themeKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        themes.set(keyword, (themes.get(keyword) || 0) + 1);
      }
    });
  });
  
  return themes;
}

/**
 * Get cached trend analysis or generate new
 */
export async function getTrendAnalysis(
  timeWindow: string,
  userProfile?: UserProfile
): Promise<TrendAnalysisResult | null> {
  const profileHash = hashUserProfile(userProfile);
  const cacheKey = `trends:${timeWindow}:${profileHash}`;
  
  const supabase = supabaseAdmin();
  
  // Check cache
  const { data: cached } = await supabase
    .from('trend_analysis_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (cached) {
    return {
      hotTopics: cached.hot_topics || [],
      emergingThemes: cached.emerging_themes || [],
      analyzedEventCount: 0,
      filteredEventCount: 0,
      confidence: 0.8
    };
  }
  
  return null;
}

/**
 * Cache trend analysis result
 */
export async function cacheTrendAnalysis(
  timeWindow: string,
  result: TrendAnalysisResult,
  userProfile?: UserProfile,
  ttlHours: number = 6
): Promise<void> {
  const profileHash = hashUserProfile(userProfile);
  const cacheKey = `trends:${timeWindow}:${profileHash}`;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  
  const supabase = supabaseAdmin();
  
  await supabase
    .from('trend_analysis_cache')
    .upsert({
      cache_key: cacheKey,
      time_window: timeWindow,
      user_profile_hash: profileHash,
      hot_topics: result.hotTopics,
      emerging_themes: result.emergingThemes,
      generated_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    }, {
      onConflict: 'cache_key'
    });
}

// ============================================================================
// PHASE 2 OPTIMIZATION: Trend Snapshot Rollups
// ============================================================================

export interface TrendSnapshot {
  id: string;
  snapshot_date: string;
  time_window: 'week' | 'month' | 'quarter' | 'year';
  taxonomy_version: string;
  topic_frequencies: Record<string, number>;
  topic_growth_rates: Record<string, number>;
  sponsor_tiers: Record<string, number>;
  sponsor_industries: Record<string, number>;
  org_types: Record<string, number>;
  org_sectors: Record<string, number>;
  event_count: number;
  avg_attendees: number | null;
  avg_speakers_per_event: number | null;
  top_cities: Array<{ city: string; count: number }>;
  top_countries: Array<{ country: string; count: number }>;
  created_at: string;
}

/**
 * Generate a trend snapshot for a given time window
 */
export async function generateTrendSnapshot(
  timeWindow: 'week' | 'month' | 'quarter' | 'year',
  taxonomyVersion: string = TAXONOMY_VERSION,
  events?: EventData[]
): Promise<TrendSnapshot | null> {
  try {
    const supabase = supabaseAdmin();
    
    if (!events) {
      const { data: eventsData, error } = await supabase
        .from('collected_events')
        .select('*')
        .not('starts_at', 'is', null)
        .gte('starts_at', getTimeWindowStart(timeWindow))
        .lte('starts_at', getTimeWindowEnd(timeWindow));
      
      if (error) {
        console.error('[trend-analysis] Error fetching events:', error);
        return null;
      }
      
      events = (eventsData || []) as EventData[];
    }
    
    const snapshotDate = getTimeWindowEnd(timeWindow);
    const topicFrequencies: Record<string, number> = {};
    
    events.forEach(event => {
      const normalizedTopics = normalizeTopics(event.topics || [], taxonomyVersion);
      normalizedTopics.forEach(topic => {
        if (topic !== 'unknown') {
          topicFrequencies[topic] = (topicFrequencies[topic] || 0) + 1;
        }
      });
    });
    
    const previousSnapshot = await getPreviousSnapshot(timeWindow);
    const topicGrowthRates: Record<string, number> = {};
    Object.keys(topicFrequencies).forEach(topic => {
      const currentCount = topicFrequencies[topic];
      const previousCount = previousSnapshot?.topic_frequencies[topic] || 0;
      const growthRate = previousCount > 0
        ? ((currentCount - previousCount) / previousCount) * 100
        : currentCount > 0 ? 100 : 0;
      topicGrowthRates[topic] = Math.round(growthRate * 100) / 100;
    });
    
    const sponsorTiers: Record<string, number> = {};
    events.forEach(event => {
      const sponsors = event.sponsors || [];
      sponsors.forEach(sponsor => {
        const level = typeof sponsor === 'string' ? 'unknown' : (sponsor.level || 'unknown');
        sponsorTiers[level.toLowerCase()] = (sponsorTiers[level.toLowerCase()] || 0) + 1;
      });
    });
    
    const sponsorIndustries: Record<string, number> = {};
    events.forEach(event => {
      const sponsors = event.sponsors || [];
      sponsors.forEach(sponsor => {
        const orgName = typeof sponsor === 'string' ? sponsor : (sponsor.name || '');
        if (orgName) {
          const normalized = normalizeOrg(orgName);
          const industry = detectIndustry(normalized);
          sponsorIndustries[industry] = (sponsorIndustries[industry] || 0) + 1;
        }
      });
    });
    
    const cityCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    events.forEach(event => {
      if (event.city) cityCounts[event.city] = (cityCounts[event.city] || 0) + 1;
      if (event.country) countryCounts[event.country] = (countryCounts[event.country] || 0) + 1;
    });
    
    const topCities = Object.entries(cityCounts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    const topCountries = Object.entries(countryCounts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    const totalSpeakers = events.reduce((sum, event) => sum + (event.speakers?.length || 0), 0);
    const avgSpeakersPerEvent = events.length > 0 
      ? Math.round((totalSpeakers / events.length) * 100) / 100
      : null;
    
    const snapshot: Omit<TrendSnapshot, 'id' | 'created_at'> = {
      snapshot_date: snapshotDate,
      time_window: timeWindow,
      taxonomy_version: taxonomyVersion,
      topic_frequencies: topicFrequencies,
      topic_growth_rates: topicGrowthRates,
      sponsor_tiers: sponsorTiers,
      sponsor_industries: sponsorIndustries,
      org_types: {},
      org_sectors: {},
      event_count: events.length,
      avg_attendees: null,
      avg_speakers_per_event: avgSpeakersPerEvent,
      top_cities: topCities,
      top_countries: topCountries,
    };
    
    const { data, error } = await supabase
      .from('trend_snapshots')
      .upsert(snapshot, { onConflict: 'snapshot_date,time_window' })
      .select()
      .single();
    
    if (error) {
      console.error('[trend-analysis] Error creating snapshot:', error);
      return null;
    }
    
    return data as TrendSnapshot;
  } catch (error) {
    console.error('[trend-analysis] Exception generating snapshot:', error);
    return null;
  }
}

async function getPreviousSnapshot(timeWindow: 'week' | 'month' | 'quarter' | 'year'): Promise<TrendSnapshot | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('trend_snapshots')
      .select('*')
      .eq('time_window', timeWindow)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) return null;
    return data as TrendSnapshot;
  } catch (error) {
    console.error('[trend-analysis] Error fetching previous snapshot:', error);
    return null;
  }
}

function getTimeWindowStart(timeWindow: 'week' | 'month' | 'quarter' | 'year'): string {
  const now = new Date();
  let start = new Date();
  switch (timeWindow) {
    case 'week': start.setDate(now.getDate() - 7); break;
    case 'month': start.setMonth(now.getMonth() - 1); break;
    case 'quarter': start.setMonth(now.getMonth() - 3); break;
    case 'year': start.setFullYear(now.getFullYear() - 1); break;
  }
  return start.toISOString().split('T')[0];
}

function getTimeWindowEnd(timeWindow: 'week' | 'month' | 'quarter' | 'year'): string {
  return new Date().toISOString().split('T')[0];
}

function detectIndustry(orgName: string): string {
  const nameLower = orgName.toLowerCase();
  if (nameLower.includes('law') || nameLower.includes('legal')) return 'legal';
  if (nameLower.includes('bank') || nameLower.includes('finance') || nameLower.includes('financial')) return 'finance';
  if (nameLower.includes('tech') || nameLower.includes('software') || nameLower.includes('technology')) return 'technology';
  if (nameLower.includes('health') || nameLower.includes('medical') || nameLower.includes('pharma')) return 'healthcare';
  if (nameLower.includes('consulting') || nameLower.includes('advisory')) return 'consulting';
  return 'other';
}

