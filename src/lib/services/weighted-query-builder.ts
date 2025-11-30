/**
 * Weighted Query Builder Service
 * Applies template weights to query construction and filtering
 */

import { WeightedTemplate } from '../types/weighted-templates';
import { SPEAKER_TERMS, AGENDA_TERMS } from '@/config/search-dictionaries';

export interface WeightedQueryResult {
  query: string;
  narrativeQuery: string;
  negativeFilters: string[];
  geographicTerms: string[];
  qualityRequirements: {
    minEventTypes: number;
    requireSpeakerData: boolean;
    requireLocationData: boolean;
    requireDateData: boolean;
  };
  weights: {
    industrySpecificQuery: number;
    crossIndustryPrevention: number;
    geographicCoverage: number;
    qualityRequirements: number;
    eventTypeSpecificity: number;
  };
}

/**
 * Build weighted query based on template precision controls
 */
export function buildWeightedQuery(
  template: WeightedTemplate,
  userProfile: any,
  country: string,
  userText?: string,
  dateFrom?: string,
  dateTo?: string
): WeightedQueryResult {
  let query = template.baseQuery;
  const negativeFilters: string[] = [];
  const geographicTerms: string[] = [];
  
  // Apply industry-specific query construction based on weight
  const industryWeight = template.precision.industrySpecificQuery.weight;
  if (industryWeight >= 7) {
    // High weight: Use industry-specific terms
    query = template.baseQuery;
  } else if (industryWeight >= 4) {
    // Medium weight: Mix industry-specific and generic terms
    query = `(${template.baseQuery}) OR (conference OR event OR summit)`;
  } else {
    // Low weight: Use generic terms
    query = '(conference OR event OR summit OR workshop OR seminar)';
  }
  
  // ALWAYS add user-specific terms if available (even when userText is provided)
  // This ensures profile terms are used in every search
  if (userProfile) {
    const userIndustryTerms = userProfile.industry_terms || [];
    const userIcpTerms = userProfile.icp_terms || [];
    const userCompetitors = userProfile.competitors || [];
    
    if (userIndustryTerms.length > 0 || userIcpTerms.length > 0) {
      const profileTerms = [];
      if (userIndustryTerms.length > 0) {
        profileTerms.push(...userIndustryTerms.slice(0, 3));
      }
      if (userIcpTerms.length > 0) {
        profileTerms.push(...userIcpTerms.slice(0, 2));
      }
      
      // Remove duplicates from userText if provided
      if (userText && userText.trim()) {
        const userTerms = userText.toLowerCase().split(/\s+/).filter(Boolean);
        const uniqueProfileTerms = profileTerms.filter(t => !userTerms.includes(t.toLowerCase()));
        if (uniqueProfileTerms.length > 0) {
          query = `(${query}) AND (${userText.trim()} ${uniqueProfileTerms.join(' ')})`;
        } else {
          query = `(${query}) AND (${userText.trim()})`;
        }
      } else {
        // No user text - use profile terms
        const userContext = profileTerms.join(' ');
        query = `(${query}) AND (${userContext})`;
      }
      
      if (userCompetitors.length > 0) {
        query = `${query} -(${userCompetitors.slice(0, 2).join(' OR ')})`;
      }
    } else if (userText && userText.trim()) {
      // No profile terms, but user provided text
      query = `(${query}) AND (${userText.trim()})`;
    }
  } else if (userText && userText.trim()) {
    // No profile, but user provided text
    query = `(${query}) AND (${userText.trim()})`;
  }
  
  // Apply cross-industry prevention based on weight
  const preventionWeight = template.precision.crossIndustryPrevention.weight;
  if (preventionWeight >= 7) {
    // High weight: Apply all negative filters
    const highWeightTerms = [
      ...template.negativeFilters.industries.filter(f => f.weight >= 7).map(f => f.term),
      ...template.negativeFilters.topics.filter(f => f.weight >= 7).map(f => f.term),
      ...template.negativeFilters.eventTypes.filter(f => f.weight >= 7).map(f => f.term),
      ...template.negativeFilters.platforms.filter(f => f.weight >= 7).map(f => f.term)
    ];
    negativeFilters.push(...highWeightTerms);
  } else if (preventionWeight >= 4) {
    // Medium weight: Apply moderate negative filters
    const mediumWeightTerms = [
      ...template.negativeFilters.industries.filter(f => f.weight >= 5).map(f => f.term),
      ...template.negativeFilters.topics.filter(f => f.weight >= 5).map(f => f.term)
    ];
    negativeFilters.push(...mediumWeightTerms);
  }
  // Low weight: No negative filters
  
  // Apply geographic coverage based on weight
  const geoWeight = template.precision.geographicCoverage.weight;
  if (geoWeight >= 7) {
    // High weight: Require specific cities/regions
    const geoTerms = [
      ...template.geographicCoverage.cities.filter(c => c.weight >= 7).map(c => c.city),
      ...template.geographicCoverage.regions.filter(r => r.weight >= 7).map(r => r.region)
    ];
    geographicTerms.push(...geoTerms);
  } else if (geoWeight >= 4) {
    // Medium weight: Require country-level coverage
    geographicTerms.push(country, getCountryName(country));
  }
  // Low weight: No geographic requirements
  
  // Apply event type specificity based on weight
  const eventTypeWeight = template.precision.eventTypeSpecificity.weight;
  if (eventTypeWeight >= 7) {
    // High weight: Use industry-specific event types
    const industryEventTypes = getIndustrySpecificEventTypes(template.id);
    query += ` (${industryEventTypes.join(' OR ')})`;
  } else if (eventTypeWeight >= 4) {
    // Medium weight: Mix industry-specific and generic event types
    const industryEventTypes = getIndustrySpecificEventTypes(template.id);
    const genericEventTypes = ['conference', 'event', 'summit', 'workshop', 'seminar'];
    const mixedEventTypes = [...industryEventTypes, ...genericEventTypes];
    query += ` (${mixedEventTypes.join(' OR ')})`;
  } else {
    // Low weight: Use generic event types
    query += ' (conference OR event OR summit OR workshop OR seminar OR meeting OR symposium OR forum OR exhibition OR trade show)';
  }
  
  // Build narrative query for Firecrawl
  const narrativeQuery = buildNarrativeQuery(template, userProfile, country, userText, dateFrom, dateTo);
  
  // Apply quality requirements based on weight
  const qualityWeight = template.precision.qualityRequirements.weight;
  const qualityRequirements = {
    minEventTypes: qualityWeight >= 7 ? template.qualityThresholds.minEventTypes.value : 1,
    requireSpeakerData: qualityWeight >= 6 ? template.qualityThresholds.requireSpeakerData.value : false,
    requireLocationData: qualityWeight >= 5 ? template.qualityThresholds.requireLocationData.value : false,
    requireDateData: qualityWeight >= 4 ? template.qualityThresholds.requireDateData.value : false
  };
  
  return {
    query: query.trim(),
    narrativeQuery,
    negativeFilters,
    geographicTerms,
    qualityRequirements,
    weights: {
      industrySpecificQuery: industryWeight,
      crossIndustryPrevention: preventionWeight,
      geographicCoverage: geoWeight,
      qualityRequirements: qualityWeight,
      eventTypeSpecificity: eventTypeWeight
    }
  };
}

/**
 * Build narrative query for Firecrawl with template context
 * 
 * PHASE 1 OPTIMIZATION: Simplified to 80-120 characters
 * - Removed location details (use API location parameter instead)
 * - Removed temporal details (use API date parameters instead)
 * - Focus on core search terms only
 */
function buildNarrativeQuery(
  template: WeightedTemplate,
  userProfile: any,
  country: string,
  userText?: string,
  dateFrom?: string,
  dateTo?: string
): string {
  // PHASE 1: Simplified query building - focus on core terms only
  // Location and dates are handled by API parameters, not query text
  
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
  
  // Helper function to add year if needed
  const addYear = (query: string): string => {
    if (yearToInclude && !query.includes(yearToInclude)) {
      return `${query} ${yearToInclude}`;
    }
    return query;
  };
  
  // PHASE 1: Get speaker term for sales outreach (default to English if country not specified)
  // This helps Firecrawl prioritize events with published speaker information
  const getLanguageFromCountry = (countryCode: string): string => {
    const countryLanguageMap: Record<string, string> = {
      'DE': 'de',
      'AT': 'de',
      'CH': 'de',
      'FR': 'fr',
      'BE': 'fr',
      'GB': 'en',
      'US': 'en',
      'CA': 'en'
    };
    return countryLanguageMap[countryCode.toUpperCase()] || 'en';
  };
  
  const language = getLanguageFromCountry(country);
  const speakerTerms = SPEAKER_TERMS[language] || SPEAKER_TERMS['en'];
  const speakerTerm = speakerTerms[0]; // Use primary term: "speakers", "referenten", "conférenciers"
  
  // Prioritize user search term if provided
  if (userText && userText.trim() && userText.length < 100) {
    const primaryEventType = (template.eventTypes && template.eventTypes.length > 0) ? template.eventTypes[0] : 'conference';
    return addYear(`${userText.trim()} ${primaryEventType} ${speakerTerm}`);
  }
  
  // Use industry terms if available
  const industryTerms = (template.industryTerms && template.industryTerms.length > 0) ? template.industryTerms.slice(0, 2).join(' ') : '';
  const primaryEventType = (template.eventTypes && template.eventTypes.length > 0) ? template.eventTypes[0] : 'conference';
  
  if (industryTerms) {
    return addYear(`${industryTerms} ${primaryEventType} ${speakerTerm}`);
  }
  
  // Fallback
  return addYear(`business ${primaryEventType} ${speakerTerm}`);
}

/**
 * Get keyword context/translations for better search matching
 * Helps Firecrawl understand German keywords and find related English terms
 */
export function getKeywordContext(keyword: string): string | null {
  const keywordLower = keyword.toLowerCase().trim();
  
  // German legal terms with English translations
  const keywordMap: Record<string, string> = {
    'kartellrecht': 'antitrust law, competition law, cartel law',
    'wettbewerbsrecht': 'competition law, antitrust law',
    'datenschutz': 'data protection, privacy law, GDPR',
    'arbeitsrecht': 'labor law, employment law',
    'steuerrecht': 'tax law, taxation',
    'gesellschaftsrecht': 'corporate law, company law',
    'vertragsrecht': 'contract law',
    'urheberrecht': 'copyright law, intellectual property',
    'markenrecht': 'trademark law',
    'patentrecht': 'patent law',
    'it-recht': 'IT law, technology law',
    'medienrecht': 'media law',
    'baurecht': 'construction law, building law',
    'versicherungsrecht': 'insurance law',
    'bankrecht': 'banking law, financial law'
  };
  
  return keywordMap[keywordLower] || null;
}

/**
 * Get industry-specific event types
 */
function getIndustrySpecificEventTypes(industry: string): string[] {
  const industryEventTypes: Record<string, string[]> = {
    'legal-compliance': [
      'compliance conference', 'legal summit', 'regulatory forum', 'governance symposium',
      'risk management workshop', 'audit seminar', 'investigation roundtable',
      'legal tech conference', 'GDPR summit', 'privacy forum', 'cybersecurity conference',
      'whistleblowing workshop', 'ESG summit', 'corporate governance forum'
    ],
    'fintech': [
      'fintech conference', 'banking innovation summit', 'payment systems forum',
      'blockchain conference', 'cryptocurrency summit', 'regtech forum',
      'insurtech conference', 'wealthtech summit', 'open banking forum',
      'API banking conference', 'mobile payments summit', 'digital wallets forum'
    ],
    'healthcare': [
      'healthcare conference', 'medical technology summit', 'health innovation forum',
      'digital health conference', 'telemedicine summit', 'healthcare IT forum',
      'medical devices conference', 'pharmaceutical summit', 'biotech forum',
      'healthcare AI conference', 'healthcare data summit', 'patient care forum'
    ]
  };
  
  return industryEventTypes[industry] || ['conference', 'summit', 'forum', 'workshop', 'seminar'];
}

/**
 * Get country name from country code
 */
function getCountryName(countryCode: string): string {
  const countryNames: Record<string, string> = {
    'DE': 'Germany',
    'FR': 'France',
    'GB': 'United Kingdom',
    'US': 'United States',
    'IT': 'Italy',
    'ES': 'Spain',
    'NL': 'Netherlands',
    'BE': 'Belgium',
    'AT': 'Austria',
    'CH': 'Switzerland'
  };
  
  return countryNames[countryCode] || countryCode;
}

/**
 * Build weighted Gemini context for prioritization
 */
export function buildWeightedGeminiContext(
  template: WeightedTemplate,
  userProfile: any,
  urls: string[],
  country: string
): string {
  const countryName = getCountryName(country);
  const industryFocus = (template.industryTerms && template.industryTerms.length > 0) ? template.industryTerms[0] : template.name;
  const targetRole =
    (userProfile?.icp_terms as string[] | undefined)?.[0] ||
    (template.icpTerms && template.icpTerms.length > 0 ? template.icpTerms[0] : '');
  const highlightCity = template.geographicCoverage.cities
    .filter(c => c.weight >= 6)
    .map(c => c.city)
    .find(Boolean);

  const parts: string[] = [
    `Rank upcoming ${template.name.toLowerCase()} events in ${countryName}.`,
    'Prefer pages with clear future date, venue, registration. Downrank directories or past recaps.'
  ];

  if (industryFocus) {
    parts.push(`Topic:${industryFocus}.`);
  }
  if (targetRole) {
    parts.push(`Role:${targetRole}.`);
  }
  if (highlightCity) {
    parts.push(`City:${highlightCity}.`);
  }

  return parts.join(' ');
}
