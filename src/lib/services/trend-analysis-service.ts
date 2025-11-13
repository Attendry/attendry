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

export interface HotTopic {
  topic: string;
  mentionCount: number;
  growthRate: number;
  momentum: number;
  relatedEvents: string[];
  category: string;
  relevanceScore: number;
}

export interface EmergingTheme {
  theme: string;
  description: string;
  growth: number;
  events: EventData[];
  relevanceScore: number;
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
  
  const prompt = `Analyze the following events and extract the most discussed "hot topics" that are relevant for business discussion.

Events:
${JSON.stringify(eventSummaries, null, 2)}

User Context:
${userProfile ? JSON.stringify({
  industry: userProfile.industry_terms,
  icp: userProfile.icp_terms
}, null, 2) : 'No specific user context'}

Return a JSON array of hot topics with this structure:
[
  {
    "topic": "string - the topic name",
    "mentionCount": number - how many events mention this topic,
    "growthRate": number - estimated growth rate (0-100),
    "momentum": number - momentum score (0-1),
    "relatedEvents": ["url1", "url2"] - URLs of related events,
    "category": "string - primary category",
    "relevanceScore": number - relevance to user (0-1)
  }
]

Focus on topics that are:
1. Frequently mentioned across multiple events
2. Relevant to business/professional discussions
3. Emerging or growing in importance
4. Relevant to the user's industry/ICP if provided

Return only the JSON array, no other text.`;

  try {
    const response = await LLMService.extractTopics(prompt, { events: eventSummaries });
    
    let hotTopics: HotTopic[] = [];
    if (Array.isArray(response.content)) {
      hotTopics = response.content;
    } else if (response.content && Array.isArray(response.content.topics)) {
      hotTopics = response.content.topics;
    }
    
    // Validate and filter results
    return hotTopics
      .filter(topic => topic.topic && topic.mentionCount > 0)
      .slice(0, 20) // Limit to top 20
      .sort((a, b) => (b.momentum * b.relevanceScore) - (a.momentum * a.relevanceScore));
      
  } catch (error) {
    console.error('[TrendAnalysis] Failed to extract hot topics:', error);
    // Fallback to keyword-based extraction
    return extractHotTopicsFallback(filteredEvents, userProfile, category);
  }
}

/**
 * Fallback hot topic extraction using keyword analysis
 */
function extractHotTopicsFallback(
  events: EventData[],
  userProfile?: UserProfile,
  category?: string
): HotTopic[] {
  const topicMentions: Map<string, number> = new Map();
  const topicEvents: Map<string, Set<string>> = new Map();
  
  events.forEach(event => {
    const topics = event.topics || [];
    const url = event.source_url;
    
    topics.forEach(topic => {
      const topicLower = topic.toLowerCase();
      topicMentions.set(topicLower, (topicMentions.get(topicLower) || 0) + 1);
      
      if (!topicEvents.has(topicLower)) {
        topicEvents.set(topicLower, new Set());
      }
      topicEvents.get(topicLower)!.add(url);
    });
  });
  
  // Convert to HotTopic format
  const hotTopics: HotTopic[] = Array.from(topicMentions.entries())
    .map(([topic, count]) => ({
      topic: topic.charAt(0).toUpperCase() + topic.slice(1),
      mentionCount: count,
      growthRate: 0, // Would need historical data
      momentum: Math.min(count / events.length, 1),
      relatedEvents: Array.from(topicEvents.get(topic) || []),
      category: category || 'General',
      relevanceScore: 0.7 // Default relevance
    }))
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, 20);
  
  return hotTopics;
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
  
  return emergingThemes
    .sort((a, b) => b.growth - a.growth)
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

