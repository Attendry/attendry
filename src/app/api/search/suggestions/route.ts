/**
 * Search Suggestions API
 * 
 * This endpoint provides search suggestions based on user input,
 * including query suggestions, location suggestions, and industry terms.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCacheService, CACHE_CONFIGS } from '@/lib/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Search suggestion types
 */
interface SearchSuggestion {
  id: string;
  text: string;
  type: 'query' | 'location' | 'industry' | 'topic';
  popularity?: number;
}

/**
 * Search suggestions request
 */
interface SearchSuggestionsRequest {
  query: string;
  limit?: number;
}

/**
 * Search suggestions response
 */
interface SearchSuggestionsResponse {
  suggestions: SearchSuggestion[];
  total: number;
}

/**
 * GET /api/search/suggestions
 */
export async function POST(req: NextRequest): Promise<NextResponse<SearchSuggestionsResponse>> {
  try {
    const { query, limit = 10 }: SearchSuggestionsRequest = await req.json();

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        suggestions: [],
        total: 0,
      });
    }

    const cacheService = getCacheService();
    const cacheKey = `search_suggestions_${query.toLowerCase()}`;

    // Check cache first
    const cachedSuggestions = await cacheService.get<SearchSuggestion[]>(
      cacheKey,
      CACHE_CONFIGS.SEARCH_RESULTS
    );

    if (cachedSuggestions) {
      return NextResponse.json({
        suggestions: cachedSuggestions.slice(0, limit),
        total: cachedSuggestions.length,
      });
    }

    // Generate suggestions
    const suggestions = await generateSuggestions(query, limit);

    // Cache the suggestions
    await cacheService.set(cacheKey, suggestions, CACHE_CONFIGS.SEARCH_RESULTS);

    return NextResponse.json({
      suggestions,
      total: suggestions.length,
    });

  } catch (error) {
    console.error('Search suggestions error:', error);
    return NextResponse.json({
      suggestions: [],
      total: 0,
    }, { status: 500 });
  }
}

/**
 * Generate search suggestions
 */
async function generateSuggestions(query: string, limit: number): Promise<SearchSuggestion[]> {
  const suggestions: SearchSuggestion[] = [];
  const lowerQuery = query.toLowerCase();

  try {
    // Get popular search terms from database
    const supabase = supabaseAdmin();
    const { data: popularSearches } = await supabase
      .from('search_cache')
      .select('cache_key')
      .ilike('cache_key', `%${lowerQuery}%`)
      .limit(5);

    if (popularSearches) {
      popularSearches.forEach((search, index) => {
        const searchTerm = search.cache_key.split('|')[0];
        if (searchTerm && searchTerm.toLowerCase().includes(lowerQuery)) {
          suggestions.push({
            id: `popular-${index}`,
            text: searchTerm,
            type: 'query',
            popularity: 100 - index * 10,
          });
        }
      });
    }

    // Add location suggestions
    const locationSuggestions = getLocationSuggestions(lowerQuery);
    suggestions.push(...locationSuggestions);

    // Add industry suggestions
    const industrySuggestions = getIndustrySuggestions(lowerQuery);
    suggestions.push(...industrySuggestions);

    // Add topic suggestions
    const topicSuggestions = getTopicSuggestions(lowerQuery);
    suggestions.push(...topicSuggestions);

    // Sort by relevance and popularity
    suggestions.sort((a, b) => {
      const aRelevance = getRelevanceScore(a.text, lowerQuery);
      const bRelevance = getRelevanceScore(b.text, lowerQuery);
      
      if (aRelevance !== bRelevance) {
        return bRelevance - aRelevance;
      }
      
      return (b.popularity || 0) - (a.popularity || 0);
    });

    return suggestions.slice(0, limit);

  } catch (error) {
    console.error('Error generating suggestions:', error);
    return getFallbackSuggestions(lowerQuery, limit);
  }
}

/**
 * Get location suggestions
 */
function getLocationSuggestions(query: string): SearchSuggestion[] {
  const locations = [
    'Munich', 'Berlin', 'Frankfurt', 'Hamburg', 'Cologne',
    'Paris', 'London', 'Amsterdam', 'Brussels', 'Zurich',
    'Vienna', 'Prague', 'Warsaw', 'Stockholm', 'Copenhagen',
  ];

  return locations
    .filter(location => location.toLowerCase().includes(query))
    .map((location, index) => ({
      id: `location-${index}`,
      text: location,
      type: 'location' as const,
      popularity: 80 - index * 5,
    }));
}

/**
 * Get industry suggestions
 */
function getIndustrySuggestions(query: string): SearchSuggestion[] {
  const industries = [
    'Legal & Compliance', 'FinTech', 'Healthcare', 'Technology',
    'Finance', 'Insurance', 'Banking', 'Regulatory', 'Risk Management',
    'Data Protection', 'Cybersecurity', 'ESG', 'Governance',
  ];

  return industries
    .filter(industry => industry.toLowerCase().includes(query))
    .map((industry, index) => ({
      id: `industry-${index}`,
      text: industry,
      type: 'industry' as const,
      popularity: 70 - index * 5,
    }));
}

/**
 * Get topic suggestions
 */
function getTopicSuggestions(query: string): SearchSuggestion[] {
  const topics = [
    'Conference', 'Summit', 'Workshop', 'Seminar', 'Webinar',
    'Training', 'Certification', 'Networking', 'Exhibition',
    'Forum', 'Symposium', 'Masterclass', 'Bootcamp',
  ];

  return topics
    .filter(topic => topic.toLowerCase().includes(query))
    .map((topic, index) => ({
      id: `topic-${index}`,
      text: topic,
      type: 'topic' as const,
      popularity: 60 - index * 5,
    }));
}

/**
 * Get fallback suggestions
 */
function getFallbackSuggestions(query: string, limit: number): SearchSuggestion[] {
  const fallbackSuggestions = [
    { text: `${query} conference`, type: 'query' as const },
    { text: `${query} summit`, type: 'query' as const },
    { text: `${query} workshop`, type: 'query' as const },
    { text: `${query} training`, type: 'query' as const },
  ];

  return fallbackSuggestions
    .slice(0, limit)
    .map((suggestion, index) => ({
      id: `fallback-${index}`,
      text: suggestion.text,
      type: suggestion.type,
      popularity: 50 - index * 10,
    }));
}

/**
 * Calculate relevance score for a suggestion
 */
function getRelevanceScore(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match
  if (lowerText === lowerQuery) return 100;

  // Starts with query
  if (lowerText.startsWith(lowerQuery)) return 90;

  // Contains query
  if (lowerText.includes(lowerQuery)) return 70;

  // Word boundary match
  const words = lowerText.split(' ');
  const queryWords = lowerQuery.split(' ');
  
  let score = 0;
  for (const queryWord of queryWords) {
    for (const word of words) {
      if (word.startsWith(queryWord)) {
        score += 20;
      } else if (word.includes(queryWord)) {
        score += 10;
      }
    }
  }

  return score;
}
