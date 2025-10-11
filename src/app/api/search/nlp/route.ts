/**
 * Natural Language Processing API
 * 
 * This endpoint provides natural language processing for search queries
 * with intent recognition and entity extraction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { OptimizedAIService } from '@/lib/services/optimized-ai-service';

/**
 * Search intent interface
 */
interface SearchIntent {
  type: 'event_search' | 'location_search' | 'date_search' | 'industry_search' | 'speaker_search';
  confidence: number;
  entities: {
    location?: string[];
    date?: string[];
    industry?: string[];
    speaker?: string[];
    keywords?: string[];
  };
  originalQuery: string;
  processedQuery: string;
}

/**
 * NLP request
 */
interface NLPRequest {
  query: string;
}

/**
 * NLP response
 */
interface NLPResponse {
  intent: SearchIntent;
  suggestions: string[];
}

/**
 * POST /api/search/nlp
 */
export async function POST(req: NextRequest): Promise<NextResponse<NLPResponse | { error: string }>> {
  try {
    const { query }: NLPRequest = await req.json();

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query too short' },
        { status: 400 }
      );
    }

    // Process natural language query
    const intent = await processNaturalLanguageQuery(query);
    const suggestions = await generateSuggestions(query, intent);

    return NextResponse.json({
      intent,
      suggestions,
    });

  } catch (error) {
    console.error('NLP processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process natural language query' },
      { status: 500 }
    );
  }
}

/**
 * Process natural language query
 */
async function processNaturalLanguageQuery(query: string): Promise<SearchIntent> {
  try {
    // Use AI to analyze the query
    const aiResponse = await OptimizedAIService.processRequest<{
      intent: string;
      confidence: number;
      entities: {
        location?: string[];
        date?: string[];
        industry?: string[];
        speaker?: string[];
        keywords?: string[];
      };
      processedQuery: string;
    }>(
      'prioritize',
      `Analyze this search query and extract intent and entities: "${query}"

      Return a JSON object with:
      - intent: one of "event_search", "location_search", "date_search", "industry_search", "speaker_search"
      - confidence: number between 0 and 1
      - entities: object with arrays for location, date, industry, speaker, keywords
      - processedQuery: cleaned and normalized query

      Examples:
      - "Show me legal conferences in Munich next month" -> intent: "event_search", entities: {location: ["Munich"], date: ["next month"], industry: ["legal"]}
      - "Find FinTech events in London" -> intent: "event_search", entities: {location: ["London"], industry: ["FinTech"]}
      - "What events are happening in December?" -> intent: "date_search", entities: {date: ["December"]}
      - "Find speakers from Google" -> intent: "speaker_search", entities: {speaker: ["Google"]}`,
      {
        context: 'nlp_processing',
        originalQuery: query,
      },
      {
        useCache: true,
        useBatching: false,
      }
    );

    return {
      type: aiResponse.intent as SearchIntent['type'],
      confidence: aiResponse.confidence,
      entities: aiResponse.entities,
      originalQuery: query,
      processedQuery: aiResponse.processedQuery,
    };

  } catch (error) {
    console.error('Error processing natural language query:', error);
    
    // Fallback to simple keyword-based processing
    return fallbackIntentProcessing(query);
  }
}

/**
 * Fallback intent processing
 */
function fallbackIntentProcessing(query: string): SearchIntent {
  const lowerQuery = query.toLowerCase();
  
  // Simple keyword-based intent detection
  let intent: SearchIntent['type'] = 'event_search';
  let confidence = 0.5;
  
  if (lowerQuery.includes('where') || lowerQuery.includes('location') || lowerQuery.includes('in ')) {
    intent = 'location_search';
    confidence = 0.7;
  } else if (lowerQuery.includes('when') || lowerQuery.includes('date') || lowerQuery.includes('time')) {
    intent = 'date_search';
    confidence = 0.7;
  } else if (lowerQuery.includes('speaker') || lowerQuery.includes('presenter')) {
    intent = 'speaker_search';
    confidence = 0.7;
  } else if (lowerQuery.includes('industry') || lowerQuery.includes('sector')) {
    intent = 'industry_search';
    confidence = 0.7;
  }

  // Simple entity extraction
  const entities: SearchIntent['entities'] = {
    keywords: extractKeywords(query),
  };

  // Extract locations (simple heuristic)
  const locationKeywords = ['munich', 'berlin', 'london', 'paris', 'amsterdam', 'frankfurt', 'hamburg', 'cologne'];
  const locations = locationKeywords.filter(loc => lowerQuery.includes(loc));
  if (locations.length > 0) {
    entities.location = locations;
  }

  // Extract dates (simple heuristic)
  const dateKeywords = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'next month', 'this month', 'tomorrow', 'today'];
  const dates = dateKeywords.filter(date => lowerQuery.includes(date));
  if (dates.length > 0) {
    entities.date = dates;
  }

  // Extract industries (simple heuristic)
  const industryKeywords = ['legal', 'fintech', 'healthcare', 'technology', 'finance', 'insurance', 'banking', 'compliance', 'cybersecurity', 'esg'];
  const industries = industryKeywords.filter(industry => lowerQuery.includes(industry));
  if (industries.length > 0) {
    entities.industry = industries;
  }

  return {
    type: intent,
    confidence,
    entities,
    originalQuery: query,
    processedQuery: query,
  };
}

/**
 * Extract keywords from query
 */
function extractKeywords(query: string): string[] {
  // Simple keyword extraction
  const words = query.toLowerCase().split(/\s+/);
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'show', 'me', 'find', 'what', 'where', 'when', 'how'];
  
  return words
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .slice(0, 10); // Limit to 10 keywords
}

/**
 * Generate suggestions based on query and intent
 */
async function generateSuggestions(query: string, intent: SearchIntent): Promise<string[]> {
  const suggestions: string[] = [];

  // Generate suggestions based on intent type
  switch (intent.type) {
    case 'event_search':
      suggestions.push(
        'Show me all events',
        'Find conferences in my area',
        'What events are happening soon?',
        'Show me legal events',
        'Find FinTech conferences'
      );
      break;
    case 'location_search':
      suggestions.push(
        'Events in Munich',
        'Conferences in London',
        'Workshops in Berlin',
        'Events in Paris',
        'Meetups in Amsterdam'
      );
      break;
    case 'date_search':
      suggestions.push(
        'Events this month',
        'Conferences next week',
        'Workshops in December',
        'Events tomorrow',
        'What\'s happening today?'
      );
      break;
    case 'industry_search':
      suggestions.push(
        'Legal compliance events',
        'FinTech conferences',
        'Healthcare workshops',
        'Technology meetups',
        'Banking events'
      );
      break;
    case 'speaker_search':
      suggestions.push(
        'Events with Google speakers',
        'Microsoft presentations',
        'Industry expert talks',
        'Keynote speakers',
        'Panel discussions'
      );
      break;
  }

  // Add entity-specific suggestions
  if (intent.entities.location?.length) {
    intent.entities.location.forEach(location => {
      suggestions.push(`Events in ${location}`);
    });
  }

  if (intent.entities.industry?.length) {
    intent.entities.industry.forEach(industry => {
      suggestions.push(`${industry} events`);
    });
  }

  return suggestions.slice(0, 5); // Limit to 5 suggestions
}
