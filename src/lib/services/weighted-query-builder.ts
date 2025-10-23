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
  const industryTerms = template.industryTerms.slice(0, 5).join(', ');
  const icpTerms = template.icpTerms.slice(0, 3).join(', ');
  
  let narrative = `Find ${template.name.toLowerCase()} events and professional conferences in ${countryName}`;
  
  // Add industry-specific context
  if (template.precision.industrySpecificQuery.weight >= 7) {
    narrative += `, including ${industryTerms}`;
  }
  
  // Add ICP context
  if (template.precision.industrySpecificQuery.weight >= 5) {
    narrative += `, targeting ${icpTerms}`;
  }
  
  // Add user-specific context
  if (userProfile) {
    const userIndustryTerms = userProfile.industry_terms || [];
    const userIcpTerms = userProfile.icp_terms || [];
    const userCompetitors = userProfile.competitors || [];
    
    if (userIndustryTerms.length > 0) {
      narrative += `, including ${userIndustryTerms.slice(0, 3).join(', ')}`;
    }
    if (userIcpTerms.length > 0) {
      narrative += `, targeting ${userIcpTerms.slice(0, 2).join(', ')}`;
    }
    if (userCompetitors.length > 0) {
      narrative += `, involving competitors like ${userCompetitors.slice(0, 2).join(', ')}`;
    }
  }
  
  // Add user text context
  if (userText && userText.trim()) {
    narrative += `, related to ${userText.trim()}`;
  }
  
  // Add quality requirements context
  if (template.precision.qualityRequirements.weight >= 6) {
    narrative += ', with speaker information and location details';
  }
  
  // Add geographic coverage context
  if (template.precision.geographicCoverage.weight >= 7) {
    const cities = template.geographicCoverage.cities
      .filter(c => c.weight >= 7)
      .map(c => c.city)
      .slice(0, 5);
    if (cities.length > 0) {
      narrative += `, in cities like ${cities.join(', ')}`;
    }
  }
  
  return narrative;
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
  const industryWeight = template.precision.industrySpecificQuery.weight;
  const preventionWeight = template.precision.crossIndustryPrevention.weight;
  const qualityWeight = template.precision.qualityRequirements.weight;
  const geoWeight = template.precision.geographicCoverage.weight;
  
  let context = `Rate URLs for ${template.name} events in ${getCountryName(country)}.`;
  
  // Add industry-specific context based on weight
  if (industryWeight >= 7) {
    context += ` Focus on ${template.industryTerms.slice(0, 5).join(', ')} events.`;
  } else if (industryWeight >= 4) {
    context += ` Include both ${template.industryTerms.slice(0, 3).join(', ')} and general business events.`;
  }
  
  // Add cross-industry prevention context based on weight
  if (preventionWeight >= 7) {
    const excludeTerms = template.negativeFilters.industries
      .filter(f => f.weight >= 7)
      .map(f => f.term)
      .slice(0, 5)
      .join(', ');
    context += ` Exclude: ${excludeTerms}.`;
  } else if (preventionWeight >= 4) {
    const excludeTerms = template.negativeFilters.industries
      .filter(f => f.weight >= 5)
      .map(f => f.term)
      .slice(0, 3)
      .join(', ');
    context += ` Avoid: ${excludeTerms}.`;
  }
  
  // Add quality requirements context based on weight
  if (qualityWeight >= 7) {
    context += ` Require: speaker data, location data, date data.`;
  } else if (qualityWeight >= 4) {
    context += ` Prefer: events with speaker and location data.`;
  }
  
  // Add geographic coverage context based on weight
  if (geoWeight >= 7) {
    const cities = template.geographicCoverage.cities
      .filter(c => c.weight >= 7)
      .map(c => c.city)
      .slice(0, 5);
    if (cities.length > 0) {
      context += ` Focus on: ${cities.join(', ')}.`;
    }
  }
  
  // Add user-specific context
  if (userProfile) {
    const userIndustryTerms = userProfile.industry_terms || [];
    const userIcpTerms = userProfile.icp_terms || [];
    const userCompetitors = userProfile.competitors || [];
    
    if (userIndustryTerms.length > 0) {
      context += ` User interests: ${userIndustryTerms.slice(0, 3).join(', ')}.`;
    }
    if (userIcpTerms.length > 0) {
      context += ` Target audience: ${userIcpTerms.slice(0, 2).join(', ')}.`;
    }
    if (userCompetitors.length > 0) {
      context += ` Competitors: ${userCompetitors.slice(0, 2).join(', ')}.`;
    }
  }
  
  return context;
}
