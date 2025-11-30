/**
 * Unified Query Builder
 * 
 * Consolidates query building logic from enhanced-orchestrator.ts and optimized-orchestrator.ts
 * into a single, comprehensive query builder with multi-language support and enhanced event types.
 */

import { loadActiveConfig, type ActiveConfig } from '../common/search/config';
import { getCountryContext } from './utils/country';

// Enhanced event types with multi-language support
const EVENT_TYPES = {
  'en': [
    'conference', 'event', 'summit', 'workshop', 'seminar', 'meeting', 'symposium', 'forum', 
    'exhibition', 'trade show', 'trade fair', 'convention', 'congress', 'webinar', 'meetup', 
    'bootcamp', 'hackathon', 'networking event', 'masterclass', 'roundtable', 'panel discussion', 
    'expo', 'agenda', 'speakers'
  ],
  'de': [
    'konferenz', 'event', 'gipfel', 'workshop', 'seminar', 'treffen', 'symposium', 'forum',
    'ausstellung', 'messe', 'handelsmesse', 'konvention', 'kongress', 'webinar', 'meetup',
    'bootcamp', 'hackathon', 'networking event', 'masterclass', 'rundtisch', 'panel diskussion',
    'expo', 'agenda', 'referenten'
  ],
  'fr': [
    'conférence', 'événement', 'sommet', 'atelier', 'séminaire', 'réunion', 'symposium', 'forum',
    'exposition', 'salon', 'foire commerciale', 'convention', 'congrès', 'webinaire', 'rencontre',
    'bootcamp', 'hackathon', 'événement de réseautage', 'masterclass', 'table ronde', 'discussion de panel',
    'expo', 'agenda', 'conférenciers'
  ]
};

// Enhanced temporal terms
const TEMPORAL_TERMS = {
  'en': [
    '2025', '2026', '2027', 'upcoming', 'next year', 'this year', 'soon',
    'register', 'registration', 'early bird', 'early registration',
    'limited time', 'save the date', 'mark your calendar', 'don\'t miss'
  ],
  'de': [
    '2025', '2026', '2027', 'kommend', 'nächstes jahr', 'dieses jahr', 'bald',
    'anmelden', 'anmeldung', 'frühbucher', 'frühanmeldung',
    'begrenzte zeit', 'termin vormerken', 'kalender markieren', 'nicht verpassen'
  ],
  'fr': [
    '2025', '2026', '2027', 'à venir', 'l\'année prochaine', 'cette année', 'bientôt',
    's\'inscrire', 'inscription', 'tarif préférentiel', 'inscription anticipée',
    'temps limité', 'réservez la date', 'marquez votre calendrier', 'ne manquez pas'
  ]
};

// Location terms by country
const LOCATION_TERMS = {
  'DE': {
    'en': ['Germany', 'Berlin', 'München', 'Frankfurt', 'Hamburg', 'Cologne', 'Stuttgart', 'Düsseldorf'],
    'de': ['Deutschland', 'Berlin', 'München', 'Frankfurt', 'Hamburg', 'Köln', 'Stuttgart', 'Düsseldorf'],
    'fr': ['Allemagne', 'Berlin', 'Munich', 'Francfort', 'Hambourg', 'Cologne', 'Stuttgart', 'Düsseldorf']
  },
  'FR': {
    'en': ['France', 'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg'],
    'de': ['Frankreich', 'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nizza', 'Nantes', 'Straßburg'],
    'fr': ['France', 'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg']
  },
  'GB': {
    'en': ['United Kingdom', 'UK', 'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh'],
    'de': ['Vereinigtes Königreich', 'UK', 'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh'],
    'fr': ['Royaume-Uni', 'UK', 'Londres', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh']
  },
  'IT': {
    'en': ['Italy', 'Rome', 'Milan', 'Naples', 'Turin', 'Florence', 'Bologna', 'Venice'],
    'de': ['Italien', 'Rom', 'Mailand', 'Neapel', 'Turin', 'Florenz', 'Bologna', 'Venedig'],
    'fr': ['Italie', 'Rome', 'Milan', 'Naples', 'Turin', 'Florence', 'Bologne', 'Venise']
  },
  'ES': {
    'en': ['Spain', 'Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao', 'Malaga', 'Zaragoza'],
    'de': ['Spanien', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Malaga', 'Saragossa'],
    'fr': ['Espagne', 'Madrid', 'Barcelone', 'Valence', 'Séville', 'Bilbao', 'Malaga', 'Saragosse']
  },
  'NL': {
    'en': ['Netherlands', 'Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen'],
    'de': ['Niederlande', 'Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen'],
    'fr': ['Pays-Bas', 'Amsterdam', 'Rotterdam', 'La Haye', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningue']
  }
};

export interface QueryBuilderParams {
  userText?: string;
  country?: string | null;
  dateFrom?: string;
  dateTo?: string;
  location?: string | null;
  timeframe?: string | null;
  locale?: string;
  language?: string;
  userProfile?: any; // Add user profile support
  skipProfileEnrichment?: boolean; // If true, skip profile-based query enrichment
}

export interface QueryBuilderResult {
  query: string;
  narrativeQuery?: string; // New narrative query for Firecrawl
  variations: string[];
  metadata: {
    eventTypes: string[];
    locationTerms: string[];
    temporalTerms: string[];
    language: string;
    country: string | null;
    queryStructure: 'enhanced' | 'simple';
  };
}

/**
 * Main unified query builder function
 */
export async function buildUnifiedQuery(params: QueryBuilderParams): Promise<QueryBuilderResult> {
  const {
    userText = '',
    country = null,
    dateFrom,
    dateTo,
    location,
    timeframe,
    locale = 'de',
    language = 'en',
    userProfile,
    skipProfileEnrichment = false
  } = params;

  // Load admin configuration
  const config = await loadActiveConfig();
  
  // Get country context
  const countryContext = getCountryContext(country);
  const targetCountry = countryContext.iso2 || 'DE';
  
  // Determine language for terms
  const termLanguage = language || 'en';
  
  // Get event types (prioritize admin config, fallback to enhanced list)
  const eventTypes = Array.isArray(config.eventTerms) && config.eventTerms.length
    ? config.eventTerms
    : EVENT_TYPES[termLanguage as keyof typeof EVENT_TYPES] || EVENT_TYPES.en;
  
  // Get location terms (ensure we always have an array)
  const countryLocationTerms = LOCATION_TERMS[targetCountry as keyof typeof LOCATION_TERMS];
  const locationTerms = (countryLocationTerms?.[termLanguage as keyof typeof countryLocationTerms] || 
                       LOCATION_TERMS.DE.en) || [];
  
  // Get temporal terms (ensure we always have an array)
  const temporalTerms = (TEMPORAL_TERMS[termLanguage as keyof typeof TEMPORAL_TERMS] || TEMPORAL_TERMS.en) || [];
  
  // Build base query with user profile integration (skip if flag is set)
  let baseQuery = userText.trim();
  
  // ALWAYS enrich with profile terms if available (even when user provides text)
  // This ensures profile terms are used in every search, not just when userText is empty
  if (!skipProfileEnrichment && userProfile) {
    const industryTerms = userProfile.industry_terms || [];
    const icpTerms = userProfile.icp_terms || [];
    
    if (industryTerms.length > 0 || icpTerms.length > 0) {
      const profileTerms = [];
      if (industryTerms.length > 0) {
        // Use top 2-3 industry terms
        profileTerms.push(...industryTerms.slice(0, 3));
      }
      if (icpTerms.length > 0) {
        // Use top 1-2 ICP terms
        profileTerms.push(...icpTerms.slice(0, 2));
      }
      
      if (baseQuery) {
        // Combine user text with profile terms
        // Remove duplicates (case-insensitive)
        const userTerms = baseQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const profileTermsLower = profileTerms.map(t => t.toLowerCase());
        const uniqueProfileTerms = profileTerms.filter(t => !userTerms.includes(t.toLowerCase()));
        
        if (uniqueProfileTerms.length > 0) {
          baseQuery = `${baseQuery} ${uniqueProfileTerms.join(' ')}`;
          console.log('[unified-query-builder] Enriched query with profile terms:', {
            original: userText,
            enriched: baseQuery,
            profileTerms: uniqueProfileTerms
          });
        }
      } else {
        // No user text - build from profile
        baseQuery = profileTerms.join(' ');
        console.log('[unified-query-builder] Built query from profile:', baseQuery);
      }
    }
  }
  
  if (!baseQuery) {
    baseQuery = config.baseQuery;
  }
  
  // Build enhanced query (like enhanced-orchestrator)
  const enhancedQuery = buildEnhancedQuery({
    baseQuery,
    eventTypes,
    locationTerms,
    temporalTerms,
    country,
    dateFrom,
    dateTo,
    timeframe,
    excludeTerms: config.excludeTerms || ''
  });
  
  // Build simple query (like optimized-orchestrator)
  const simpleQuery = buildSimpleQuery({
    baseQuery,
    eventTypes,
    locationTerms,
    temporalTerms
  });
  
  // Build narrative query for Firecrawl with user profile context (skip if flag is set)
  const narrativeQuery = buildNarrativeQuery({
    baseQuery,
    eventTypes,
    locationTerms,
    temporalTerms,
    country,
    dateFrom,
    dateTo,
    timeframe,
    excludeTerms: config.excludeTerms || '',
    language: termLanguage,
    userProfile: skipProfileEnrichment ? undefined : userProfile
  });
  
  // Generate query variations
  const variations = generateQueryVariations({
    baseQuery,
    eventTypes,
    locationTerms,
    temporalTerms,
    country,
    language: termLanguage
  });
  
  return {
    query: enhancedQuery,
    narrativeQuery, // New narrative query for Firecrawl
    variations: [enhancedQuery, simpleQuery, ...variations],
    metadata: {
      eventTypes,
      locationTerms,
      temporalTerms,
      language: termLanguage,
      country: targetCountry,
      queryStructure: 'enhanced'
    }
  };
}

/**
 * Build enhanced query (from enhanced-orchestrator logic)
 */
function buildEnhancedQuery(params: {
  baseQuery: string;
  eventTypes: string[];
  locationTerms: string[];
  temporalTerms: string[];
  country: string | null;
  dateFrom?: string;
  dateTo?: string;
  timeframe?: string | null;
  excludeTerms: string;
}): string {
  const { baseQuery, eventTypes, locationTerms, temporalTerms, excludeTerms } = params;
  
  // Build event query with proper OR logic
  const eventQuery = `(${eventTypes.slice(0, 10).join(' OR ')})`;
  
  // Build location query
  const locationQuery = locationTerms.length > 0 
    ? `(${locationTerms.slice(0, 5).map(quoteToken).join(' OR ')})`
    : '';
  
  // Build temporal query
  const temporalQuery = temporalTerms.length > 0
    ? `(${temporalTerms.slice(0, 5).map(quoteToken).join(' OR ')})`
    : '';
  
  // Combine segments
  const segments = [baseQuery, eventQuery];
  if (locationQuery) segments.push(locationQuery);
  if (temporalQuery) segments.push(temporalQuery);
  
  let query = segments.join(' ').replace(/\s+/g, ' ').trim();
  
  // Add exclude terms if present
  if (excludeTerms) {
    const excludeTokens = excludeTerms
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => t.startsWith('-') ? t : `-${t}`)
      .join(' ');
    query = `${query} ${excludeTokens}`.trim();
  }
  
  return query;
}

/**
 * Build simple query (from optimized-orchestrator logic)
 */
function buildSimpleQuery(params: {
  baseQuery: string;
  eventTypes: string[];
  locationTerms: string[];
  temporalTerms: string[];
}): string {
  const { baseQuery, eventTypes, locationTerms, temporalTerms } = params;
  
  // Simple concatenation approach
  const terms = [
    baseQuery,
    eventTypes?.[0], // First event type (safe access)
    locationTerms?.[0], // First location term (safe access)
    temporalTerms?.[0] // First temporal term (safe access)
  ].filter(Boolean);
  
  return terms.join(' ');
}

/**
 * Build narrative query for Firecrawl (natural language)
 * 
 * PHASE 1 OPTIMIZATION: Simplified to 80-120 characters
 * - Removed location details (use API location parameter instead)
 * - Removed temporal details (use API date parameters instead)
 * - Focus on core search terms only
 */
function buildNarrativeQuery(params: {
  baseQuery: string;
  eventTypes: string[];
  locationTerms: string[];
  temporalTerms: string[];
  country: string | null;
  dateFrom?: string;
  dateTo?: string;
  timeframe?: string | null;
  excludeTerms: string;
  language: string;
  userProfile?: any;
}): string {
  const { baseQuery, eventTypes, language, userProfile, dateFrom, dateTo } = params;
  
  // Extract year from date range for future dates (helps Firecrawl find events)
  let yearToInclude: string | null = null;
  if (dateFrom || dateTo) {
    const sourceDate = dateFrom || dateTo;
    if (sourceDate) {
      const parsedDate = new Date(sourceDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        const year = parsedDate.getFullYear();
        const currentYear = new Date().getFullYear();
        // Include year if it's in the future or different from current year
        if (year > currentYear || year < currentYear) {
          yearToInclude = year.toString();
        }
      }
    }
  }
  
  // PRIORITY: User's search term is PRIMARY
  const hasUserSearchTerm = baseQuery && baseQuery.trim() && 
    !baseQuery.includes(' OR ') && 
    !baseQuery.includes(' AND ') &&
    !baseQuery.includes('(') &&
    baseQuery.length < 100 &&
    baseQuery.trim().split(/\s+/).length <= 10;
  
  const userSearchTerm = hasUserSearchTerm ? baseQuery.trim().toLowerCase() : '';
  
  // Get primary industry terms (limit to 2-3 for brevity)
  const industryTerms = userProfile?.industry_terms || [];
  const primaryIndustry = industryTerms.slice(0, 2).join(' ').toLowerCase();
  
  // Get primary event type (just one, not a list)
  const primaryEventType = (eventTypes && eventTypes.length > 0) ? eventTypes[0] : 'conference';
  const eventTypeLower = primaryEventType.toLowerCase();
  
  // PHASE 1: Build concise query (80-120 characters target)
  // Location and dates are handled by API parameters, not query text
  // ENHANCEMENT: Always include profile terms if available, even with user search term
  
  // Helper function to build query with optional year
  const buildQueryWithYear = (query: string): string => {
    if (yearToInclude && !query.includes(yearToInclude)) {
      return `${query} ${yearToInclude}`;
    }
    return query;
  };
  
  if (language === 'de') {
    if (userSearchTerm) {
      // Check if event type is already in the search term
      const eventTypeInTerm = eventTypes.some(et => userSearchTerm.includes(et.toLowerCase()));
      if (eventTypeInTerm) {
        // Event type already in term - add industry terms if available
        if (primaryIndustry && !userSearchTerm.includes(primaryIndustry)) {
          return buildQueryWithYear(`${userSearchTerm} ${primaryIndustry}`);
        }
        return buildQueryWithYear(userSearchTerm); // Don't duplicate
      }
      // Add industry terms if available
      if (primaryIndustry && !userSearchTerm.includes(primaryIndustry)) {
        return buildQueryWithYear(`${userSearchTerm} ${primaryIndustry} ${primaryEventType}`);
      }
      return buildQueryWithYear(`${userSearchTerm} ${primaryEventType}`);
    } else if (primaryIndustry) {
      return buildQueryWithYear(`${primaryIndustry} ${primaryEventType}`);
    }
    return buildQueryWithYear(`business ${primaryEventType}`);
  } else if (language === 'fr') {
    if (userSearchTerm) {
      const eventTypeInTerm = eventTypes.some(et => userSearchTerm.includes(et.toLowerCase()));
      if (eventTypeInTerm) {
        if (primaryIndustry && !userSearchTerm.includes(primaryIndustry)) {
          return buildQueryWithYear(`${userSearchTerm} ${primaryIndustry}`);
        }
        return buildQueryWithYear(userSearchTerm);
      }
      if (primaryIndustry && !userSearchTerm.includes(primaryIndustry)) {
        return buildQueryWithYear(`${userSearchTerm} ${primaryIndustry} ${primaryEventType}`);
      }
      return buildQueryWithYear(`${userSearchTerm} ${primaryEventType}`);
    } else if (primaryIndustry) {
      return buildQueryWithYear(`${primaryIndustry} ${primaryEventType}`);
    }
    return buildQueryWithYear(`événements professionnels ${primaryEventType}`);
  } else {
    // English (default)
    if (userSearchTerm) {
      // FIX: Check if event type is already in the search term to avoid "conference conference"
      const eventTypeInTerm = eventTypes.some(et => userSearchTerm.includes(et.toLowerCase()));
      if (eventTypeInTerm) {
        // Event type already in term - add industry terms if available
        if (primaryIndustry && !userSearchTerm.includes(primaryIndustry)) {
          return buildQueryWithYear(`${userSearchTerm} ${primaryIndustry}`);
        }
        return buildQueryWithYear(userSearchTerm);
      }
      // User search term is primary: "legal compliance conferences"
      // Add industry terms if available and not already included
      if (primaryIndustry && !userSearchTerm.includes(primaryIndustry)) {
        return buildQueryWithYear(`${userSearchTerm} ${primaryIndustry} ${primaryEventType}`);
      }
      // Target: 30-50 characters
      return buildQueryWithYear(`${userSearchTerm} ${primaryEventType}`);
    } else if (primaryIndustry) {
      // Industry terms: "legal compliance conferences"
      // Target: 30-50 characters
      return buildQueryWithYear(`${primaryIndustry} ${primaryEventType}`);
    }
    // Fallback: "business conference"
    // Target: ~20 characters
    return buildQueryWithYear(`business ${primaryEventType}`);
  }
}

/**
 * Generate multiple query variations for better coverage
 */
function generateQueryVariations(params: {
  baseQuery: string;
  eventTypes: string[];
  locationTerms: string[];
  temporalTerms: string[];
  country: string | null;
  language: string;
}): string[] {
  const { baseQuery, eventTypes, locationTerms, temporalTerms, country, language } = params;
  const variations: string[] = [];
  
  // Variation 1: Focus on specific event types
  const specificEventTypes = ['conference', 'summit', 'workshop'];
  const specificEventQuery = `(${specificEventTypes.join(' OR ')})`;
  const firstLocation = locationTerms && locationTerms.length > 0 ? locationTerms[0] : '';
  const firstTemporal = temporalTerms && temporalTerms.length > 0 ? temporalTerms[0] : '';
  if (firstLocation && firstTemporal) {
    variations.push(`${baseQuery} ${specificEventQuery} ${firstLocation} ${firstTemporal}`);
  }
  
  // Variation 2: Focus on location
  if (locationTerms && locationTerms.length > 1) {
    const locationQuery = `(${locationTerms.slice(0, 3).join(' OR ')})`;
    const firstEventType = eventTypes && eventTypes.length > 0 ? eventTypes[0] : 'conference';
    if (firstTemporal) {
      variations.push(`${baseQuery} ${firstEventType} ${locationQuery} ${firstTemporal}`);
    }
  }
  
  // Variation 3: Focus on temporal terms
  if (temporalTerms && temporalTerms.length > 1) {
    const temporalQuery = `(${temporalTerms.slice(0, 3).join(' OR ')})`;
    const firstEventType = eventTypes && eventTypes.length > 0 ? eventTypes[0] : 'conference';
    if (firstLocation) {
      variations.push(`${baseQuery} ${firstEventType} ${firstLocation} ${temporalQuery}`);
    }
  }
  
  // Variation 4: Natural language query
  const firstEventType = eventTypes && eventTypes.length > 0 ? eventTypes[0] : 'conference';
  if (firstLocation && firstTemporal) {
    const naturalLanguage = `${baseQuery} ${firstEventType} in ${firstLocation} ${firstTemporal}`;
    variations.push(naturalLanguage);
  }
  
  // Variation 5: Multi-language if not English
  if (language !== 'en') {
    const englishEventTypes = EVENT_TYPES.en.slice(0, 5);
    const englishLocationTerms = LOCATION_TERMS[country as keyof typeof LOCATION_TERMS]?.en || LOCATION_TERMS.DE.en;
    const englishTemporalTerms = TEMPORAL_TERMS.en.slice(0, 3);
    
    const englishQuery = `${baseQuery} ${englishEventTypes.join(' OR ')} ${englishLocationTerms[0]} ${englishTemporalTerms[0]}`;
    variations.push(englishQuery);
  }
  
  return variations.slice(0, 5); // Limit to 5 variations
}

/**
 * Quote token for proper query syntax
 */
function quoteToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return '';
  if (/^".*"$/.test(trimmed)) return trimmed;
  if (/\s/.test(trimmed)) return `"${trimmed}"`;
  return trimmed;
}

/**
 * Get event types for a specific language
 */
export function getEventTypes(language: string = 'en'): string[] {
  return EVENT_TYPES[language as keyof typeof EVENT_TYPES] || EVENT_TYPES.en;
}

/**
 * Get location terms for a specific country and language
 */
export function getLocationTerms(country: string, language: string = 'en'): string[] {
  const countryLocationTerms = LOCATION_TERMS[country as keyof typeof LOCATION_TERMS];
  return countryLocationTerms?.[language as keyof typeof countryLocationTerms] || 
         LOCATION_TERMS.DE.en;
}

/**
 * Get temporal terms for a specific language
 */
export function getTemporalTerms(language: string = 'en'): string[] {
  return TEMPORAL_TERMS[language as keyof typeof TEMPORAL_TERMS] || TEMPORAL_TERMS.en;
}

/**
 * Validate query builder parameters
 */
export function validateQueryBuilderParams(params: QueryBuilderParams): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (params.language && !EVENT_TYPES[params.language as keyof typeof EVENT_TYPES]) {
    errors.push(`Unsupported language: ${params.language}. Supported languages: ${Object.keys(EVENT_TYPES).join(', ')}`);
  }
  
  if (params.country && !LOCATION_TERMS[params.country as keyof typeof LOCATION_TERMS]) {
    errors.push(`Unsupported country: ${params.country}. Supported countries: ${Object.keys(LOCATION_TERMS).join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
