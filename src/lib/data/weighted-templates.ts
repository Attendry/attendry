/**
 * Enhanced Industry Templates with Weighted Precision Controls
 */

import { WeightedTemplate, WeightedTemplateConfig } from '../types/weighted-templates';

// Default weights for precision controls
const DEFAULT_WEIGHTS = {
  industrySpecificQuery: 8,
  crossIndustryPrevention: 7,
  geographicCoverage: 6,
  qualityRequirements: 5,
  eventTypeSpecificity: 6
};

// Enhanced industry templates with weighted precision controls
export const WEIGHTED_INDUSTRY_TEMPLATES: Record<string, WeightedTemplate> = {
  'legal-compliance': {
    id: 'legal-compliance',
    name: 'Legal & Compliance',
    description: 'Legal technology, compliance, regulatory events, and professional development',
    category: 'professional',
    
    baseQuery: '(legal OR compliance OR regulatory OR governance OR "risk management" OR audit OR investigation OR "e-discovery" OR "legal tech" OR "legal technology" OR GDPR OR privacy OR "data protection" OR cybersecurity OR whistleblowing OR ESG OR "financial regulation" OR "banking compliance" OR "corporate governance")',
    excludeTerms: 'reddit Mumsnet "legal advice" forum',
    industryTerms: ['compliance', 'investigations', 'regtech', 'ESG', 'legal tech', 'GDPR', 'privacy', 'cybersecurity', 'whistleblowing', 'audit', 'governance', 'risk management'],
    icpTerms: ['general counsel', 'compliance officer', 'legal counsel', 'risk manager', 'audit manager', 'data protection officer', 'chief compliance officer'],
    
    precision: {
      industrySpecificQuery: {
        weight: DEFAULT_WEIGHTS.industrySpecificQuery,
        description: 'How strictly to enforce industry-specific terms in search queries',
        impact: 'Higher values will use more industry-specific terms, lower values will use more generic terms'
      },
      crossIndustryPrevention: {
        weight: DEFAULT_WEIGHTS.crossIndustryPrevention,
        description: 'How strictly to prevent finding events from other industries',
        impact: 'Higher values will exclude more non-industry events, lower values will be more permissive'
      },
      geographicCoverage: {
        weight: DEFAULT_WEIGHTS.geographicCoverage,
        description: 'How strictly to enforce geographic coverage requirements',
        impact: 'Higher values will require more cities/regions, lower values will have broader geographic scope',
        autoSuggestions: {
          enabled: true,
          country: 'DE',
          suggestedCities: ['Berlin', 'München', 'Frankfurt', 'Hamburg', 'Köln', 'Stuttgart', 'Düsseldorf'],
          suggestedRegions: ['Bavaria', 'North Rhine-Westphalia', 'Baden-Württemberg', 'Hesse', 'Hamburg', 'Berlin']
        }
      },
      qualityRequirements: {
        weight: DEFAULT_WEIGHTS.qualityRequirements,
        description: 'How strictly to enforce quality requirements for events',
        impact: 'Higher values will require more complete event data, lower values will be more lenient'
      },
      eventTypeSpecificity: {
        weight: DEFAULT_WEIGHTS.eventTypeSpecificity,
        description: 'How specific to be with event types',
        impact: 'Higher values will use industry-specific event types, lower values will use generic event types'
      }
    },
    
    negativeFilters: {
      industries: [
        { term: 'food', weight: 9 },
        { term: 'fashion', weight: 9 },
        { term: 'sports', weight: 8 },
        { term: 'entertainment', weight: 8 },
        { term: 'travel', weight: 7 },
        { term: 'real estate', weight: 6 },
        { term: 'automotive', weight: 5 },
        { term: 'retail', weight: 5 }
      ],
      topics: [
        { term: 'cooking', weight: 9 },
        { term: 'recipes', weight: 9 },
        { term: 'fashion shows', weight: 9 },
        { term: 'sports events', weight: 8 },
        { term: 'concerts', weight: 8 },
        { term: 'vacations', weight: 7 },
        { term: 'car shows', weight: 6 },
        { term: 'shopping', weight: 6 }
      ],
      eventTypes: [
        { term: 'food festivals', weight: 9 },
        { term: 'fashion shows', weight: 9 },
        { term: 'sports tournaments', weight: 8 },
        { term: 'concerts', weight: 8 },
        { term: 'travel expos', weight: 7 },
        { term: 'car shows', weight: 6 },
        { term: 'shopping events', weight: 6 }
      ],
      platforms: [
        { term: 'food blogs', weight: 9 },
        { term: 'fashion magazines', weight: 9 },
        { term: 'sports websites', weight: 8 },
        { term: 'entertainment sites', weight: 8 },
        { term: 'travel blogs', weight: 7 },
        { term: 'automotive sites', weight: 6 }
      ]
    },
    
    geographicCoverage: {
      countries: [
        { country: 'DE', weight: 10 },
        { country: 'FR', weight: 8 },
        { country: 'GB', weight: 8 },
        { country: 'US', weight: 7 }
      ],
      cities: [
        { city: 'Berlin', weight: 10, country: 'DE' },
        { city: 'München', weight: 9, country: 'DE' },
        { city: 'Frankfurt', weight: 9, country: 'DE' },
        { city: 'Hamburg', weight: 8, country: 'DE' },
        { city: 'Paris', weight: 8, country: 'FR' },
        { city: 'London', weight: 8, country: 'GB' }
      ],
      regions: [
        { region: 'Bavaria', weight: 8, country: 'DE' },
        { region: 'North Rhine-Westphalia', weight: 7, country: 'DE' },
        { region: 'Baden-Württemberg', weight: 7, country: 'DE' },
        { region: 'Hesse', weight: 8, country: 'DE' }
      ]
    },
    
    qualityThresholds: {
      minEventTypes: { value: 3, weight: 7 },
      requireSpeakerData: { value: true, weight: 8 },
      requireLocationData: { value: true, weight: 7 },
      requireDateData: { value: true, weight: 6 }
    }
  },
  
  'fintech': {
    id: 'fintech',
    name: 'FinTech & Financial Services',
    description: 'Financial technology, banking innovation, and financial services events',
    category: 'business',
    
    baseQuery: '(fintech OR "financial technology" OR "banking innovation" OR "digital banking" OR "payment systems" OR "blockchain" OR "cryptocurrency" OR "regtech" OR "insurtech" OR "wealthtech" OR "open banking" OR "API banking" OR "mobile payments" OR "digital wallets")',
    excludeTerms: 'reddit Mumsnet "legal advice" forum',
    industryTerms: ['fintech', 'banking innovation', 'digital banking', 'payment systems', 'blockchain', 'cryptocurrency', 'regtech', 'insurtech', 'wealthtech'],
    icpTerms: ['fintech executive', 'banking executive', 'payment executive', 'blockchain executive', 'financial services executive'],
    
    precision: {
      industrySpecificQuery: {
        weight: DEFAULT_WEIGHTS.industrySpecificQuery,
        description: 'How strictly to enforce industry-specific terms in search queries',
        impact: 'Higher values will use more industry-specific terms, lower values will use more generic terms'
      },
      crossIndustryPrevention: {
        weight: DEFAULT_WEIGHTS.crossIndustryPrevention,
        description: 'How strictly to prevent finding events from other industries',
        impact: 'Higher values will exclude more non-industry events, lower values will be more permissive'
      },
      geographicCoverage: {
        weight: DEFAULT_WEIGHTS.geographicCoverage,
        description: 'How strictly to enforce geographic coverage requirements',
        impact: 'Higher values will require more cities/regions, lower values will have broader geographic scope',
        autoSuggestions: {
          enabled: true,
          country: 'DE',
          suggestedCities: ['Frankfurt', 'Berlin', 'München', 'Hamburg', 'Düsseldorf', 'Stuttgart'],
          suggestedRegions: ['Hesse', 'Berlin', 'Bavaria', 'Hamburg']
        }
      },
      qualityRequirements: {
        weight: DEFAULT_WEIGHTS.qualityRequirements,
        description: 'How strictly to enforce quality requirements for events',
        impact: 'Higher values will require more complete event data, lower values will be more lenient'
      },
      eventTypeSpecificity: {
        weight: DEFAULT_WEIGHTS.eventTypeSpecificity,
        description: 'How specific to be with event types',
        impact: 'Higher values will use industry-specific event types, lower values will use generic event types'
      }
    },
    
    negativeFilters: {
      industries: [
        { term: 'food', weight: 8 },
        { term: 'fashion', weight: 8 },
        { term: 'sports', weight: 7 },
        { term: 'entertainment', weight: 7 },
        { term: 'travel', weight: 6 },
        { term: 'real estate', weight: 5 },
        { term: 'healthcare', weight: 4 },
        { term: 'education', weight: 4 }
      ],
      topics: [
        { term: 'cooking', weight: 8 },
        { term: 'recipes', weight: 8 },
        { term: 'fashion shows', weight: 8 },
        { term: 'sports events', weight: 7 },
        { term: 'concerts', weight: 7 },
        { term: 'vacations', weight: 6 },
        { term: 'medical conferences', weight: 4 },
        { term: 'academic events', weight: 4 }
      ],
      eventTypes: [
        { term: 'food festivals', weight: 8 },
        { term: 'fashion shows', weight: 8 },
        { term: 'sports tournaments', weight: 7 },
        { term: 'concerts', weight: 7 },
        { term: 'travel expos', weight: 6 },
        { term: 'medical conferences', weight: 4 },
        { term: 'academic conferences', weight: 4 }
      ],
      platforms: [
        { term: 'food blogs', weight: 8 },
        { term: 'fashion magazines', weight: 8 },
        { term: 'sports websites', weight: 7 },
        { term: 'entertainment sites', weight: 7 },
        { term: 'travel blogs', weight: 6 },
        { term: 'medical journals', weight: 4 },
        { term: 'academic sites', weight: 4 }
      ]
    },
    
    geographicCoverage: {
      countries: [
        { country: 'DE', weight: 10 },
        { country: 'FR', weight: 8 },
        { country: 'GB', weight: 8 },
        { country: 'US', weight: 9 }
      ],
      cities: [
        { city: 'Frankfurt', weight: 10, country: 'DE' },
        { city: 'Berlin', weight: 9, country: 'DE' },
        { city: 'München', weight: 8, country: 'DE' },
        { city: 'Paris', weight: 8, country: 'FR' },
        { city: 'London', weight: 9, country: 'GB' },
        { city: 'New York', weight: 10, country: 'US' }
      ],
      regions: [
        { region: 'Hesse', weight: 10, country: 'DE' },
        { region: 'Berlin', weight: 9, country: 'DE' },
        { region: 'Bavaria', weight: 7, country: 'DE' },
        { region: 'Île-de-France', weight: 8, country: 'FR' }
      ]
    },
    
    qualityThresholds: {
      minEventTypes: { value: 3, weight: 6 },
      requireSpeakerData: { value: true, weight: 7 },
      requireLocationData: { value: true, weight: 6 },
      requireDateData: { value: true, weight: 5 }
    }
  },
  
  'healthcare': {
    id: 'healthcare',
    name: 'Healthcare & Medical Technology',
    description: 'Healthcare innovation, medical technology, and healthcare services events',
    category: 'professional',
    
    baseQuery: '(healthcare OR "medical technology" OR "health innovation" OR "digital health" OR "telemedicine" OR "healthcare IT" OR "medical devices" OR "pharmaceutical" OR "biotech" OR "healthcare AI" OR "healthcare data" OR "patient care" OR "healthcare management")',
    excludeTerms: 'reddit Mumsnet "legal advice" forum',
    industryTerms: ['healthcare', 'medical technology', 'health innovation', 'digital health', 'telemedicine', 'healthcare IT', 'medical devices', 'pharmaceutical', 'biotech'],
    icpTerms: ['healthcare executive', 'medical director', 'healthcare IT director', 'pharmaceutical executive', 'biotech executive'],
    
    precision: {
      industrySpecificQuery: {
        weight: DEFAULT_WEIGHTS.industrySpecificQuery,
        description: 'How strictly to enforce industry-specific terms in search queries',
        impact: 'Higher values will use more industry-specific terms, lower values will use more generic terms'
      },
      crossIndustryPrevention: {
        weight: DEFAULT_WEIGHTS.crossIndustryPrevention,
        description: 'How strictly to prevent finding events from other industries',
        impact: 'Higher values will exclude more non-industry events, lower values will be more permissive'
      },
      geographicCoverage: {
        weight: DEFAULT_WEIGHTS.geographicCoverage,
        description: 'How strictly to enforce geographic coverage requirements',
        impact: 'Higher values will require more cities/regions, lower values will have broader geographic scope',
        autoSuggestions: {
          enabled: true,
          country: 'DE',
          suggestedCities: ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt', 'Stuttgart'],
          suggestedRegions: ['Berlin', 'Bavaria', 'Hamburg', 'North Rhine-Westphalia']
        }
      },
      qualityRequirements: {
        weight: DEFAULT_WEIGHTS.qualityRequirements,
        description: 'How strictly to enforce quality requirements for events',
        impact: 'Higher values will require more complete event data, lower values will be more lenient'
      },
      eventTypeSpecificity: {
        weight: DEFAULT_WEIGHTS.eventTypeSpecificity,
        description: 'How specific to be with event types',
        impact: 'Higher values will use industry-specific event types, lower values will use generic event types'
      }
    },
    
    negativeFilters: {
      industries: [
        { term: 'food', weight: 7 },
        { term: 'fashion', weight: 7 },
        { term: 'sports', weight: 6 },
        { term: 'entertainment', weight: 6 },
        { term: 'travel', weight: 5 },
        { term: 'real estate', weight: 5 },
        { term: 'fintech', weight: 4 },
        { term: 'legal', weight: 4 }
      ],
      topics: [
        { term: 'cooking', weight: 7 },
        { term: 'recipes', weight: 7 },
        { term: 'fashion shows', weight: 7 },
        { term: 'sports events', weight: 6 },
        { term: 'concerts', weight: 6 },
        { term: 'vacations', weight: 5 },
        { term: 'banking events', weight: 4 },
        { term: 'legal conferences', weight: 4 }
      ],
      eventTypes: [
        { term: 'food festivals', weight: 7 },
        { term: 'fashion shows', weight: 7 },
        { term: 'sports tournaments', weight: 6 },
        { term: 'concerts', weight: 6 },
        { term: 'travel expos', weight: 5 },
        { term: 'fintech conferences', weight: 4 },
        { term: 'legal conferences', weight: 4 }
      ],
      platforms: [
        { term: 'food blogs', weight: 7 },
        { term: 'fashion magazines', weight: 7 },
        { term: 'sports websites', weight: 6 },
        { term: 'entertainment sites', weight: 6 },
        { term: 'travel blogs', weight: 5 },
        { term: 'fintech sites', weight: 4 },
        { term: 'legal sites', weight: 4 }
      ]
    },
    
    geographicCoverage: {
      countries: [
        { country: 'DE', weight: 10 },
        { country: 'FR', weight: 8 },
        { country: 'GB', weight: 8 },
        { country: 'US', weight: 9 }
      ],
      cities: [
        { city: 'Berlin', weight: 10, country: 'DE' },
        { city: 'München', weight: 9, country: 'DE' },
        { city: 'Hamburg', weight: 8, country: 'DE' },
        { city: 'Köln', weight: 7, country: 'DE' },
        { city: 'Paris', weight: 8, country: 'FR' },
        { city: 'London', weight: 8, country: 'GB' }
      ],
      regions: [
        { region: 'Berlin', weight: 10, country: 'DE' },
        { region: 'Bavaria', weight: 9, country: 'DE' },
        { region: 'Hamburg', weight: 8, country: 'DE' },
        { region: 'North Rhine-Westphalia', weight: 7, country: 'DE' }
      ]
    },
    
    qualityThresholds: {
      minEventTypes: { value: 3, weight: 6 },
      requireSpeakerData: { value: true, weight: 7 },
      requireLocationData: { value: true, weight: 6 },
      requireDateData: { value: true, weight: 5 }
    }
  }
};

export const WEIGHTED_TEMPLATE_CONFIG: WeightedTemplateConfig = {
  templates: WEIGHTED_INDUSTRY_TEMPLATES,
  defaultWeights: DEFAULT_WEIGHTS
};
