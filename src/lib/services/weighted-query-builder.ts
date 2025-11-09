/**
 * Weighted Query Builder Service
 * Applies template weights to query construction and filtering
 */

import { WeightedTemplate } from '../types/weighted-templates';

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
  userText?: string
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
  
  // Add user-specific terms if available
  if (userProfile) {
    const userIndustryTerms = userProfile.industry_terms || [];
    const userIcpTerms = userProfile.icp_terms || [];
    const userCompetitors = userProfile.competitors || [];
    
    if (userIndustryTerms.length > 0 || userIcpTerms.length > 0) {
      const userContext = [];
      if (userIndustryTerms.length > 0) {
        userContext.push(userIndustryTerms.slice(0, 3).join(', '));
      }
      if (userIcpTerms.length > 0) {
        userContext.push(`targeting ${userIcpTerms.slice(0, 2).join(', ')}`);
      }
      if (userCompetitors.length > 0) {
        userContext.push(`competitors: ${userCompetitors.slice(0, 2).join(', ')}`);
      }
      
      const userQuery = userContext.join(' ');
      query = `(${query}) AND (${userQuery})`;
    }
  }
  
  // Add user text if provided
  if (userText && userText.trim()) {
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
  const narrativeQuery = buildNarrativeQuery(template, userProfile, country, userText);
  
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
 */
function buildNarrativeQuery(
  template: WeightedTemplate,
  userProfile: any,
  country: string,
  userText?: string
): string {
  const countryName = getCountryName(country);
  const industryTerms = template.industryTerms.slice(0, 4);
  const icpTerms = template.icpTerms.slice(0, 3);

  const highlightedCities = template.geographicCoverage.cities
    .filter(c => c.weight >= 6)
    .map(c => c.city)
    .slice(0, 3);

  const locationPhrase = highlightedCities.length > 0
    ? `${countryName} (including ${highlightedCities.join(', ')})`
    : countryName;

  const narrativeParts: string[] = [];

  narrativeParts.push(
    `Find ${template.name.toLowerCase()} business events and professional conferences in ${locationPhrase}`,
    'scheduled through the upcoming 12 months'
  );

  if (industryTerms.length > 0) {
    narrativeParts.push(`covering ${industryTerms.join(', ')}`);
  }

  if (icpTerms.length > 0) {
    narrativeParts.push(`for leaders such as ${icpTerms.join(', ')}`);
  }

  if (userProfile) {
    const userIndustryTerms = (userProfile.industry_terms || []).slice(0, 3);
    const userIcpTerms = (userProfile.icp_terms || []).slice(0, 2);

    if (userIndustryTerms.length > 0) {
      narrativeParts.push(`with emphasis on ${userIndustryTerms.join(', ')}`);
    }
    if (userIcpTerms.length > 0) {
      narrativeParts.push(`serving audiences like ${userIcpTerms.join(', ')}`);
    }
  }

  if (userText && userText.trim()) {
    narrativeParts.push(`related to ${userText.trim()}`);
  }

  if (template.precision.qualityRequirements.weight >= 6) {
    narrativeParts.push('prioritise events that publish agendas, speakers, and venues');
  } else {
    narrativeParts.push('prioritise events with clear dates and locations');
  }

  return narrativeParts.join(', ') + '.';
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
  const industryFocus = template.industryTerms.slice(0, 3).join(', ');
  const cities = template.geographicCoverage.cities
    .filter(c => c.weight >= 6)
    .map(c => c.city)
    .slice(0, 3);
  const targetRoles =
    (userProfile?.icp_terms as string[] | undefined)?.slice(0, 2).join(', ') ||
    template.icpTerms.slice(0, 2).join(', ');

  const contextSentences: string[] = [
    `You score URLs for upcoming ${template.name.toLowerCase()} events in ${countryName}.`,
    `Reward pages that clearly describe a 2025+ in-person or hybrid event with dates, city, and agenda.`,
    `Penalise directories, press releases, recaps of past events, or vendor marketing pages.`,
    `Return only JSON array [{"url":"","score":0.0,"reason":""}] with reason keyword <= 12 chars (e.g. "munich2025").`
  ];

  if (industryFocus) {
    contextSentences.push(`Focus topics: ${industryFocus}.`);
  }

  if (targetRoles) {
    contextSentences.push(`Target roles: ${targetRoles}.`);
  }

  if (cities.length > 0) {
    contextSentences.push(`Important cities: ${cities.join(', ')}.`);
  }

  return contextSentences.join(' ');
}
