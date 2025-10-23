/**
 * Geographic Auto-Suggestions for Industry-Specific Templates
 */

import { GeographicAutoSuggestion } from '../types/weighted-templates';

// Industry-specific geographic relevance data
export const INDUSTRY_GEOGRAPHIC_RELEVANCE: Record<string, Record<string, GeographicAutoSuggestion>> = {
  'legal-compliance': {
    'DE': {
      country: 'DE',
      cities: [
        { name: 'Berlin', weight: 10, population: 3700000, businessRelevance: 10, industryRelevance: 9 },
        { name: 'München', weight: 9, population: 1500000, businessRelevance: 9, industryRelevance: 8 },
        { name: 'Frankfurt', weight: 9, population: 750000, businessRelevance: 10, industryRelevance: 9 },
        { name: 'Hamburg', weight: 8, population: 1900000, businessRelevance: 8, industryRelevance: 7 },
        { name: 'Köln', weight: 7, population: 1100000, businessRelevance: 7, industryRelevance: 6 },
        { name: 'Stuttgart', weight: 7, population: 630000, businessRelevance: 8, industryRelevance: 6 },
        { name: 'Düsseldorf', weight: 6, population: 620000, businessRelevance: 7, industryRelevance: 5 },
        { name: 'Leipzig', weight: 5, population: 600000, businessRelevance: 5, industryRelevance: 4 },
        { name: 'Dortmund', weight: 4, population: 590000, businessRelevance: 4, industryRelevance: 3 },
        { name: 'Essen', weight: 4, population: 580000, businessRelevance: 4, industryRelevance: 3 }
      ],
      regions: [
        { name: 'Bavaria', weight: 8, cities: ['München', 'Nürnberg', 'Augsburg'] },
        { name: 'North Rhine-Westphalia', weight: 7, cities: ['Köln', 'Düsseldorf', 'Dortmund', 'Essen'] },
        { name: 'Baden-Württemberg', weight: 7, cities: ['Stuttgart', 'Karlsruhe', 'Freiburg'] },
        { name: 'Hesse', weight: 8, cities: ['Frankfurt', 'Wiesbaden', 'Darmstadt'] },
        { name: 'Hamburg', weight: 8, cities: ['Hamburg'] },
        { name: 'Berlin', weight: 10, cities: ['Berlin'] }
      ]
    },
    'FR': {
      country: 'FR',
      cities: [
        { name: 'Paris', weight: 10, population: 11000000, businessRelevance: 10, industryRelevance: 9 },
        { name: 'Lyon', weight: 8, population: 2200000, businessRelevance: 8, industryRelevance: 7 },
        { name: 'Marseille', weight: 7, population: 1600000, businessRelevance: 7, industryRelevance: 6 },
        { name: 'Toulouse', weight: 6, population: 1000000, businessRelevance: 6, industryRelevance: 5 },
        { name: 'Nice', weight: 5, population: 950000, businessRelevance: 5, industryRelevance: 4 },
        { name: 'Nantes', weight: 5, population: 650000, businessRelevance: 5, industryRelevance: 4 }
      ],
      regions: [
        { name: 'Île-de-France', weight: 10, cities: ['Paris', 'Versailles', 'Boulogne-Billancourt'] },
        { name: 'Auvergne-Rhône-Alpes', weight: 8, cities: ['Lyon', 'Grenoble', 'Saint-Étienne'] },
        { name: 'Provence-Alpes-Côte d\'Azur', weight: 7, cities: ['Marseille', 'Nice', 'Toulon'] },
        { name: 'Occitanie', weight: 6, cities: ['Toulouse', 'Montpellier', 'Nîmes'] }
      ]
    },
    'GB': {
      country: 'GB',
      cities: [
        { name: 'London', weight: 10, population: 9000000, businessRelevance: 10, industryRelevance: 9 },
        { name: 'Manchester', weight: 8, population: 2800000, businessRelevance: 8, industryRelevance: 7 },
        { name: 'Birmingham', weight: 7, population: 2900000, businessRelevance: 7, industryRelevance: 6 },
        { name: 'Leeds', weight: 6, population: 1800000, businessRelevance: 6, industryRelevance: 5 },
        { name: 'Edinburgh', weight: 6, population: 550000, businessRelevance: 6, industryRelevance: 5 },
        { name: 'Bristol', weight: 5, population: 700000, businessRelevance: 5, industryRelevance: 4 }
      ],
      regions: [
        { name: 'Greater London', weight: 10, cities: ['London', 'Westminster', 'Camden'] },
        { name: 'Greater Manchester', weight: 8, cities: ['Manchester', 'Salford', 'Stockport'] },
        { name: 'West Midlands', weight: 7, cities: ['Birmingham', 'Coventry', 'Wolverhampton'] },
        { name: 'West Yorkshire', weight: 6, cities: ['Leeds', 'Bradford', 'Wakefield'] },
        { name: 'Scotland', weight: 6, cities: ['Edinburgh', 'Glasgow', 'Aberdeen'] }
      ]
    }
  },
  'fintech': {
    'DE': {
      country: 'DE',
      cities: [
        { name: 'Frankfurt', weight: 10, population: 750000, businessRelevance: 10, industryRelevance: 10 },
        { name: 'Berlin', weight: 9, population: 3700000, businessRelevance: 9, industryRelevance: 8 },
        { name: 'München', weight: 8, population: 1500000, businessRelevance: 8, industryRelevance: 7 },
        { name: 'Hamburg', weight: 7, population: 1900000, businessRelevance: 7, industryRelevance: 6 },
        { name: 'Düsseldorf', weight: 6, population: 620000, businessRelevance: 6, industryRelevance: 5 },
        { name: 'Stuttgart', weight: 5, population: 630000, businessRelevance: 5, industryRelevance: 4 }
      ],
      regions: [
        { name: 'Hesse', weight: 10, cities: ['Frankfurt', 'Wiesbaden'] },
        { name: 'Berlin', weight: 9, cities: ['Berlin'] },
        { name: 'Bavaria', weight: 7, cities: ['München', 'Nürnberg'] },
        { name: 'Hamburg', weight: 7, cities: ['Hamburg'] }
      ]
    },
    'FR': {
      country: 'FR',
      cities: [
        { name: 'Paris', weight: 10, population: 11000000, businessRelevance: 10, industryRelevance: 10 },
        { name: 'Lyon', weight: 7, population: 2200000, businessRelevance: 7, industryRelevance: 6 },
        { name: 'Marseille', weight: 6, population: 1600000, businessRelevance: 6, industryRelevance: 5 },
        { name: 'Toulouse', weight: 5, population: 1000000, businessRelevance: 5, industryRelevance: 4 }
      ],
      regions: [
        { name: 'Île-de-France', weight: 10, cities: ['Paris', 'Versailles', 'Boulogne-Billancourt'] },
        { name: 'Auvergne-Rhône-Alpes', weight: 7, cities: ['Lyon', 'Grenoble'] },
        { name: 'Provence-Alpes-Côte d\'Azur', weight: 6, cities: ['Marseille', 'Nice'] }
      ]
    },
    'GB': {
      country: 'GB',
      cities: [
        { name: 'London', weight: 10, population: 9000000, businessRelevance: 10, industryRelevance: 10 },
        { name: 'Edinburgh', weight: 8, population: 550000, businessRelevance: 8, industryRelevance: 7 },
        { name: 'Manchester', weight: 6, population: 2800000, businessRelevance: 6, industryRelevance: 5 },
        { name: 'Birmingham', weight: 5, population: 2900000, businessRelevance: 5, industryRelevance: 4 }
      ],
      regions: [
        { name: 'Greater London', weight: 10, cities: ['London', 'Westminster', 'Camden'] },
        { name: 'Scotland', weight: 8, cities: ['Edinburgh', 'Glasgow'] },
        { name: 'Greater Manchester', weight: 6, cities: ['Manchester', 'Salford'] }
      ]
    }
  },
  'healthcare': {
    'DE': {
      country: 'DE',
      cities: [
        { name: 'Berlin', weight: 10, population: 3700000, businessRelevance: 10, industryRelevance: 9 },
        { name: 'München', weight: 9, population: 1500000, businessRelevance: 9, industryRelevance: 8 },
        { name: 'Hamburg', weight: 8, population: 1900000, businessRelevance: 8, industryRelevance: 7 },
        { name: 'Köln', weight: 7, population: 1100000, businessRelevance: 7, industryRelevance: 6 },
        { name: 'Frankfurt', weight: 6, population: 750000, businessRelevance: 6, industryRelevance: 5 },
        { name: 'Stuttgart', weight: 6, population: 630000, businessRelevance: 6, industryRelevance: 5 }
      ],
      regions: [
        { name: 'Berlin', weight: 10, cities: ['Berlin'] },
        { name: 'Bavaria', weight: 9, cities: ['München', 'Nürnberg'] },
        { name: 'Hamburg', weight: 8, cities: ['Hamburg'] },
        { name: 'North Rhine-Westphalia', weight: 7, cities: ['Köln', 'Düsseldorf'] }
      ]
    }
  }
};

/**
 * Get geographic suggestions for a specific industry and country
 */
export function getGeographicSuggestions(industry: string, country: string): GeographicAutoSuggestion | null {
  return INDUSTRY_GEOGRAPHIC_RELEVANCE[industry]?.[country] || null;
}

/**
 * Get all available countries for an industry
 */
export function getAvailableCountries(industry: string): string[] {
  const industryData = INDUSTRY_GEOGRAPHIC_RELEVANCE[industry];
  return industryData ? Object.keys(industryData) : [];
}

/**
 * Get all available industries
 */
export function getAvailableIndustries(): string[] {
  return Object.keys(INDUSTRY_GEOGRAPHIC_RELEVANCE);
}
