/**
 * Query Optimizer
 * 
 * Fixes obvious over-filters and optimizes search queries to prevent zero results.
 */

import { FLAGS } from '@/config/flags';

export interface QueryOptimizationResult {
  optimizedQuery: string;
  queries: string[];
  excludedTerms: string[];
  tldPreference: boolean;
}

/**
 * Remove problematic exclude terms that might filter out legitimate events
 */
export function optimizeExcludeTerms(excludeTerms: string): string {
  const problematicTerms = [
    'student', // Might appear on university event pages
    'free', // Free events are still valid
    'download', // Might appear in event materials
    'pdf', // Event materials might be PDFs
    'ebook', // Event materials might be ebooks
    'guide', // Event guides are valid
    'tips', // Event tips are valid
    'blog', // Event blogs are valid
    'news', // Event news is valid
    'article', // Event articles are valid
  ];
  
  const terms = excludeTerms.split(',').map(term => term.trim());
  const filteredTerms = terms.filter(term => 
    !problematicTerms.some(problematic => 
      term.toLowerCase().includes(problematic.toLowerCase())
    )
  );
  
  return filteredTerms.join(', ');
}

/**
 * Optimize TLD preference to be less restrictive
 */
export function optimizeTldPreference(query: string, enableTldPreference: boolean): string {
  if (!enableTldPreference) {
    return query;
  }
  
  // Prefer .de but don't hard-block .org/.com
  const tldPreference = 'site:de OR site:org OR site:com';
  
  // If query already has site: restrictions, don't add more
  if (query.includes('site:')) {
    return query;
  }
  
  // Add TLD preference to the beginning of the query
  return `(${tldPreference}) (${query})`;
}

/**
 * Split long queries into manageable chunks
 */
export function splitLongQuery(query: string, maxLength: number = 256): string[] {
  if (query.length <= maxLength) {
    return [query];
  }
  
  // Split by logical operators
  const parts = query.split(/\s+(?:AND|OR)\s+/i);
  
  if (parts.length > 1) {
    // Try to combine parts while staying under limit
    const queries: string[] = [];
    let currentQuery = '';
    
    for (const part of parts) {
      if (currentQuery.length + part.length + 5 <= maxLength) {
        currentQuery += (currentQuery ? ' OR ' : '') + part;
      } else {
        if (currentQuery) {
          queries.push(currentQuery);
        }
        currentQuery = part;
      }
    }
    
    if (currentQuery) {
      queries.push(currentQuery);
    }
    
    return queries;
  }
  
  // If no logical operators, split by parentheses
  const parenParts = query.split(/\)\s*\(/);
  if (parenParts.length > 1) {
    return parenParts.map(part => part.trim());
  }
  
  // Last resort: split by keywords
  const keywords = query.split(/\s+/);
  const queries: string[] = [];
  let currentQuery = '';
  
  for (const keyword of keywords) {
    if (currentQuery.length + keyword.length + 1 <= maxLength) {
      currentQuery += (currentQuery ? ' ' : '') + keyword;
    } else {
      if (currentQuery) {
        queries.push(currentQuery);
      }
      currentQuery = keyword;
    }
  }
  
  if (currentQuery) {
    queries.push(currentQuery);
  }
  
  return queries;
}

/**
 * Optimize legal event terms for better results
 */
export function optimizeLegalEventTerms(): string[] {
  const legalTerms = [
    'legal', 'compliance', 'investigation', 'e-discovery', 'ediscovery',
    'legal tech', 'legal technology', 'regulatory', 'governance',
    'risk management', 'audit', 'whistleblowing', 'data protection',
    'gdpr', 'dsgvo', 'privacy', 'cybersecurity', 'regtech', 'esg'
  ];
  
  const eventTerms = [
    'conference', 'summit', 'forum', 'workshop', 'seminar', 'webinar',
    'training', 'certification', 'event', 'meeting', 'symposium',
    'konferenz', 'kongress', 'tagung', 'veranstaltung', 'fortbildung'
  ];
  
  // Create optimized combinations
  const optimizedTerms: string[] = [];
  
  // High-value combinations
  legalTerms.slice(0, 5).forEach(legal => {
    eventTerms.slice(0, 3).forEach(event => {
      optimizedTerms.push(`"${legal} ${event}"`);
    });
  });
  
  // Individual terms
  optimizedTerms.push(...legalTerms.slice(0, 10));
  optimizedTerms.push(...eventTerms.slice(0, 10));
  
  return optimizedTerms;
}

/**
 * Main query optimization function
 */
export function optimizeSearchQuery(
  baseQuery: string,
  excludeTerms: string = '',
  enableTldPreference: boolean = true
): QueryOptimizationResult {
  // Optimize exclude terms
  const optimizedExcludeTerms = optimizeExcludeTerms(excludeTerms);
  
  // Optimize TLD preference
  const tldOptimizedQuery = optimizeTldPreference(baseQuery, enableTldPreference);
  
  // Split long queries
  const queries = splitLongQuery(tldOptimizedQuery);
  
  return {
    optimizedQuery: queries[0] || baseQuery,
    queries,
    excludedTerms: optimizedExcludeTerms ? optimizedExcludeTerms.split(',').map(term => term.trim()).filter(Boolean) : [],
    tldPreference: enableTldPreference
  };
}

/**
 * Create fallback queries for zero-result scenarios
 */
export function createFallbackQueries(country: string): string[] {
  const fallbackQueries = [
    // Generic legal events
    'legal conference OR compliance summit OR regulatory forum',
    
    // Country-specific
    ...(country.toLowerCase() === 'de' ? [
      'recht konferenz OR compliance tagung OR datenschutz veranstaltung',
      'legal tech OR regtech OR compliance technology',
      'anwalt OR kanzlei OR rechtsberatung event'
    ] : []),
    
    // Industry-specific
    'data protection conference OR privacy summit',
    'cybersecurity event OR information security conference',
    'audit training OR risk management seminar',
    
    // Event platforms
    'site:eventbrite.com legal OR compliance',
    'site:meetup.com legal OR compliance',
    'site:xing.com events legal OR compliance'
  ];
  
  return fallbackQueries;
}

/**
 * Validate query quality
 */
export function validateQuery(query: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (query.length === 0) {
    issues.push('Query is empty');
  }
  
  if (query.length > 500) {
    issues.push('Query is too long (>500 chars)');
  }
  
  if (!query.match(/[a-zA-Z]/)) {
    issues.push('Query contains no letters');
  }
  
  if (query.split(/\s+/).length < 2) {
    issues.push('Query is too short (<2 words)');
  }
  
  // Check for problematic patterns
  if (query.includes('NOT') && !query.includes('OR')) {
    issues.push('Query uses NOT without OR (might be too restrictive)');
  }
  
  if (query.split('"').length > 10) {
    issues.push('Query has too many quoted phrases');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
