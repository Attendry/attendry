/**
 * Enhanced Template Types with Weighted Precision Controls
 */

export interface WeightedPrecisionControl {
  weight: number; // 0-10 scale
  description: string;
  impact: string;
}

export interface WeightedTemplate {
  id: string;
  name: string;
  description: string;
  category: 'professional' | 'technical' | 'business' | 'academic';
  
  // Core search configuration
  baseQuery: string;
  excludeTerms: string;
  industryTerms: string[];
  icpTerms: string[];
  
  // Weighted precision controls (0-10 scale)
  precision: {
    // Industry-specific query construction weight
    industrySpecificQuery: WeightedPrecisionControl;
    
    // Cross-industry contamination prevention weight
    crossIndustryPrevention: WeightedPrecisionControl;
    
    // Geographic coverage weight
    geographicCoverage: WeightedPrecisionControl & {
      autoSuggestions: {
        enabled: boolean;
        country: string;
        suggestedCities: string[];
        suggestedRegions: string[];
      };
    };
    
    // Quality requirements weight
    qualityRequirements: WeightedPrecisionControl;
    
    // Event type specificity weight
    eventTypeSpecificity: WeightedPrecisionControl;
  };
  
  // Weighted negative filters
  negativeFilters: {
    industries: Array<{ term: string; weight: number }>;
    topics: Array<{ term: string; weight: number }>;
    eventTypes: Array<{ term: string; weight: number }>;
    platforms: Array<{ term: string; weight: number }>;
  };
  
  // Weighted geographic coverage
  geographicCoverage: {
    countries: Array<{ country: string; weight: number }>;
    cities: Array<{ city: string; weight: number; country: string }>;
    regions: Array<{ region: string; weight: number; country: string }>;
  };
  
  // Weighted quality thresholds
  qualityThresholds: {
    minEventTypes: { value: number; weight: number };
    requireSpeakerData: { value: boolean; weight: number };
    requireLocationData: { value: boolean; weight: number };
    requireDateData: { value: boolean; weight: number };
  };
}

export interface GeographicAutoSuggestion {
  country: string;
  cities: Array<{
    name: string;
    weight: number; // Based on industry relevance
    population: number;
    businessRelevance: number;
    industryRelevance: number;
  }>;
  regions: Array<{
    name: string;
    weight: number;
    cities: string[];
  }>;
}

export interface WeightedTemplateConfig {
  templates: Record<string, WeightedTemplate>;
  defaultWeights: {
    industrySpecificQuery: number;
    crossIndustryPrevention: number;
    geographicCoverage: number;
    qualityRequirements: number;
    eventTypeSpecificity: number;
  };
}
