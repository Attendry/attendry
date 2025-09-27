/**
 * Enhanced Query Builder for Legal Events Search
 * 
 * This module builds multi-tier search queries optimized for finding
 * legal and compliance events in Germany.
 */

import {
  COUNTRY,
  COUNTRY_CODE,
  LEGAL_EVENT_TERMS,
  EVENT_TERMS,
  EXCLUDES,
  DOMAIN_ALLOWLIST,
  SEARCH_THRESHOLDS
} from '@/config/search-legal-de';

export interface QueryTier {
  name: string;
  query: string;
  description: string;
}

export interface SearchConfig {
  baseQuery: string;
  fromISO: string;
  toISO: string;
  country?: string;
  allowUndated?: boolean;
}

/**
 * Builds multi-tier search queries for legal events
 */
export function buildEnhancedQuery(config: SearchConfig): QueryTier[] {
  const { baseQuery, fromISO, toISO, country = COUNTRY_CODE } = config;
  
  // Ensure baseQuery is not dropped
  const enhancedBaseQuery = baseQuery.trim();
  if (!enhancedBaseQuery) {
    throw new Error('baseQuery is required');
  }

  const queries: QueryTier[] = [];

  // Tier A: Precise legal event search
  const tierAQuery = buildTierAQuery(enhancedBaseQuery, country);
  if (tierAQuery.length <= SEARCH_THRESHOLDS.MAX_QUERY_LENGTH) {
    queries.push({
      name: 'Tier A - Precise',
      query: tierAQuery,
      description: 'Precise legal event terms with base query'
    });
  } else {
    // Split into multiple queries if too long
    const splitQueries = splitLongQuery(tierAQuery, enhancedBaseQuery, 'precise');
    queries.push(...splitQueries);
  }

  // Tier B: Legal operations angle
  const tierBQuery = buildTierBQuery(enhancedBaseQuery, country);
  if (tierBQuery.length <= SEARCH_THRESHOLDS.MAX_QUERY_LENGTH) {
    queries.push({
      name: 'Tier B - Legal Ops',
      query: tierBQuery,
      description: 'Legal operations and compliance focus'
    });
  } else {
    const splitQueries = splitLongQuery(tierBQuery, enhancedBaseQuery, 'legal-ops');
    queries.push(...splitQueries);
  }

  // Tier C: Curated domains
  const tierCQueries = buildTierCQueries(enhancedBaseQuery, country);
  queries.push(...tierCQueries);

  // Log final queries with lengths
  console.log('Enhanced Query Builder - Final Queries:', {
    totalQueries: queries.length,
    queries: queries.map(q => ({
      name: q.name,
      length: q.query.length,
      query: q.query
    }))
  });

  return queries;
}

/**
 * Builds Tier A (precise) query
 */
function buildTierAQuery(baseQuery: string, country: string): string {
  const eventTerms = EVENT_TERMS.join(' OR ');
  const legalTerms = LEGAL_EVENT_TERMS.join(' OR ');
  
  return `"${country}" (${eventTerms}) (${legalTerms}) (${baseQuery})`;
}

/**
 * Builds Tier B (legal operations) query
 */
function buildTierBQuery(baseQuery: string, country: string): string {
  const eventTerms = EVENT_TERMS.join(' OR ');
  const legalRoles = 'GC OR "General Counsel" OR "Chief Compliance Officer" OR "Leiter Recht" OR "Leiter Compliance"';
  
  return `(${baseQuery}) (${eventTerms}) (${legalRoles}) "${country}"`;
}

/**
 * Builds Tier C (curated domains) queries
 */
function buildTierCQueries(baseQuery: string, country: string): QueryTier[] {
  const queries: QueryTier[] = [];
  const eventTerms = EVENT_TERMS.join(' OR ');
  const legalTerms = LEGAL_EVENT_TERMS.join(' OR ');

  // Group domains into batches to avoid query length limits
  const domainBatches = chunkArray(DOMAIN_ALLOWLIST, 3);
  
  domainBatches.forEach((domainBatch, index) => {
    const siteRestricts = domainBatch.map(domain => `site:${domain}`).join(' OR ');
    const query = `(${baseQuery}) (${eventTerms}) (${legalTerms}) (${siteRestricts})`;
    
    if (query.length <= SEARCH_THRESHOLDS.MAX_QUERY_LENGTH) {
      queries.push({
        name: `Tier C - Domains ${index + 1}`,
        query,
        description: `Curated domains: ${domainBatch.join(', ')}`
      });
    }
  });

  return queries;
}

/**
 * Splits long queries into multiple smaller ones
 */
function splitLongQuery(longQuery: string, baseQuery: string, type: string): QueryTier[] {
  const queries: QueryTier[] = [];
  
  if (type === 'precise') {
    // Split legal terms
    const legalTermChunks = chunkArray(LEGAL_EVENT_TERMS, 5);
    legalTermChunks.forEach((chunk, index) => {
      const eventTerms = EVENT_TERMS.join(' OR ');
      const legalTerms = chunk.join(' OR ');
      const query = `"${COUNTRY_CODE}" (${eventTerms}) (${legalTerms}) (${baseQuery})`;
      
      queries.push({
        name: `Tier A${index + 1} - Precise`,
        query,
        description: `Precise legal terms batch ${index + 1}`
      });
    });
  } else if (type === 'legal-ops') {
    // Split event terms
    const eventTermChunks = chunkArray(EVENT_TERMS, 8);
    eventTermChunks.forEach((chunk, index) => {
      const eventTerms = chunk.join(' OR ');
      const legalRoles = 'GC OR "General Counsel" OR "Chief Compliance Officer"';
      const query = `(${baseQuery}) (${eventTerms}) (${legalRoles}) "${COUNTRY_CODE}"`;
      
      queries.push({
        name: `Tier B${index + 1} - Legal Ops`,
        query,
        description: `Legal operations batch ${index + 1}`
      });
    });
  }
  
  return queries;
}

/**
 * Utility to chunk arrays
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Builds date range filter for Firecrawl
 */
export function buildDateFilter(fromISO: string, toISO: string): string {
  const fromDate = new Date(fromISO);
  const toDate = new Date(toISO);
  
  const fromMDY = `${fromDate.getMonth() + 1}/${fromDate.getDate()}/${fromDate.getFullYear()}`;
  const toMDY = `${toDate.getMonth() + 1}/${toDate.getDate()}/${toDate.getFullYear()}`;
  
  return `cdr:1,cd_min:${fromMDY},cd_max:${toMDY}`;
}
