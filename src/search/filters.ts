import type { Candidate } from './retrieve';
import { logger } from '../utils/logger';

const MULTI_COUNTRY_INTENTS = new Set(['topic', 'generic']);

export function enforceCountry(candidates: Candidate[], country: string): Candidate[] {
  return candidates.filter((candidate) => candidate.doc.country?.toLowerCase() === country);
}

export function assertCountry(candidates: Candidate[], country: string, intent: string): void {
  if (MULTI_COUNTRY_INTENTS.has(intent)) {
    return;
  }

  const offenders = candidates.filter((candidate) => candidate.doc.country?.toLowerCase() !== country);
  if (offenders.length) {
    offenders.forEach((candidate) => {
      logger.warn({
        at: 'search.filters.countryMismatch',
        requestedCountry: country,
        docCountry: candidate.doc.country,
        id: candidate.doc.id,
        domain: candidate.doc.domain,
        url: candidate.doc.url,
      });
    });
    throw new Error(`Country assertion failed for ${offenders.length} candidates`);
  }
}

