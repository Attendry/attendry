/**
 * Relaxed Filtering Logic
 * 
 * Implements relaxed country and date filtering behind feature flags
 * to prevent zero-result runs while maintaining data quality.
 */

import { FLAGS } from '@/config/flags';
import { traceNote, updateStageStat, type SearchTrace } from '@/lib/trace';
import { stageCounter, logSuppressedSamples, type Reason } from '@/lib/obs/triage-metrics';

export interface FilterableEvent {
  title?: string;
  url?: string;
  country?: string;
  city?: string;
  startsAt?: string | Date;
  endsAt?: string | Date;
  description?: string;
  undatedCandidate?: boolean;
  [key: string]: any;
}

/**
 * Relaxed country filtering
 */
export function filterByCountryRelaxed(
  items: FilterableEvent[], 
  targetCountry: string, 
  trace: SearchTrace
): FilterableEvent[] {
  const initialCount = items.length;
  
  if (!FLAGS.RELAX_COUNTRY) {
    // Strict filtering - exact match only
    const filtered = items.filter(item => 
      item.country?.toLowerCase() === targetCountry.toLowerCase()
    );
    updateStageStat(trace.filters.country, initialCount, filtered.length, 
      `Strict country filtering for ${targetCountry}`);
    return filtered;
  }

  // Relaxed filtering
  const allowedCountries = new Set([
    targetCountry.toLowerCase(),
    'de', 'at', 'ch', // German-speaking countries
    'other'
  ]);

  const germanDomains = new Set(['.de', '.at', '.ch']);
  const germanKeywords = ['german', 'deutsch', 'deutschland', 'österreich', 'schweiz'];
  
  const reasons: Reason[] = [];
  const filtered = items.filter(item => {
    const country = item.country?.toLowerCase();
    const url = item.url?.toLowerCase() || '';
    const title = item.title?.toLowerCase() || '';
    const description = item.description?.toLowerCase() || '';
    
    // Direct country match
    if (country && allowedCountries.has(country)) {
      return true;
    }
    
    // German domain check
    if (germanDomains.has(url.split('.').pop() || '')) {
      reasons.push({ key: 'german_domain', count: 1, samples: [item] });
      return true;
    }
    
    // German language content check
    const content = `${title} ${description}`;
    if (germanKeywords.some(keyword => content.includes(keyword))) {
      reasons.push({ key: 'german_keyword', count: 1, samples: [item] });
      return true;
    }
    
    // German city mentions
    const germanCities = ['berlin', 'münchen', 'hamburg', 'köln', 'frankfurt', 'stuttgart', 'düsseldorf', 'dortmund', 'essen', 'leipzig', 'bremen', 'dresden', 'hannover', 'nürnberg', 'duisburg', 'bochum', 'wuppertal', 'bielefeld', 'bonn', 'münster', 'karlsruhe', 'mannheim', 'augsburg', 'wiesbaden', 'gelsenkirchen', 'mönchengladbach', 'braunschweig', 'chemnitz', 'kiel', 'aachen', 'halle', 'magdeburg', 'freiburg', 'krefeld', 'lübeck', 'oberhausen', 'erfurt', 'mainz', 'rostock', 'kassel', 'hagen', 'hamm', 'saarbrücken', 'mülheim', 'potsdam', 'ludwigshafen', 'oldenburg', 'leverkusen', 'osnabrück', 'solingen', 'heidelberg', 'herne', 'neuss', 'darmstadt', 'paderborn', 'regensburg', 'ingolstadt', 'würzburg', 'fürth', 'wolfsburg', 'offenbach', 'ulm', 'heilbronn', 'pforzheim', 'göttingen', 'bottrop', 'trier', 'recklinghausen', 'reutlingen', 'bremerhaven', 'koblenz', 'bergisch gladbach', 'jena', 'remscheid', 'erlangen', 'moers', 'siegen', 'hildesheim', 'salzgitter'];
    if (germanCities.some(city => content.includes(city))) {
      reasons.push({ key: 'german_city', count: 1, samples: [item] });
      return true;
    }
    
    return false;
  });

  const notes: string[] = [];
  if (targetCountry.toLowerCase() === 'de') {
    notes.push('German-speaking countries (DE, AT, CH)');
    notes.push('German domains (.de, .at, .ch)');
    notes.push('German language content');
    notes.push('German city mentions');
  }

  updateStageStat(trace.filters.country, initialCount, filtered.length, ...notes);
  stageCounter('filter:country', items, filtered, reasons);
  logSuppressedSamples('filter:country', reasons);
  return filtered;
}

/**
 * Relaxed date filtering
 */
export function filterByDateRelaxed(
  items: FilterableEvent[], 
  fromDate: Date, 
  toDate: Date, 
  trace: SearchTrace
): FilterableEvent[] {
  const initialCount = items.length;
  
  if (!FLAGS.RELAX_DATE) {
    // Strict filtering - must have valid date
    const filtered = items.filter(item => {
      if (!item.startsAt) return false;
      const eventDate = new Date(item.startsAt);
      return !isNaN(eventDate.getTime()) && eventDate >= fromDate && eventDate <= toDate;
    });
    updateStageStat(trace.filters.date, initialCount, filtered.length, 
      `Strict date filtering from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
    return filtered;
  }

  // Relaxed filtering
  const validDateItems: FilterableEvent[] = [];
  const undatedItems: FilterableEvent[] = [];
  
  items.forEach(item => {
    if (!item.startsAt) {
      // No date - mark as undated candidate
      item.undatedCandidate = true;
      undatedItems.push(item);
      return;
    }
    
    const eventDate = new Date(item.startsAt);
    if (isNaN(eventDate.getTime())) {
      // Invalid date - mark as undated candidate
      item.undatedCandidate = true;
      undatedItems.push(item);
      return;
    }
    
    if (eventDate >= fromDate && eventDate <= toDate) {
      validDateItems.push(item);
    } else {
      // Outside date range - mark as undated candidate for relaxed mode
      item.undatedCandidate = true;
      undatedItems.push(item);
    }
  });

  let finalItems = validDateItems;
  
  if (FLAGS.ALLOW_UNDATED) {
    finalItems = [...validDateItems, ...undatedItems];
  }

  const reasonsSummary = [
    `Valid dates: ${validDateItems.length}`,
    `Undated candidates: ${undatedItems.length}`,
    FLAGS.ALLOW_UNDATED ? 'Undated items included' : 'Undated items excluded'
  ];

  updateStageStat(trace.filters.date, initialCount, finalItems.length, ...reasonsSummary);
  stageCounter('filter:date', items, finalItems, [
    { key: 'valid_dates', count: validDateItems.length, samples: validDateItems.slice(0, 3) },
    { key: 'undated', count: undatedItems.length, samples: undatedItems.slice(0, 3) }
  ]);
  logSuppressedSamples('filter:date', [
    { key: 'valid_dates', count: validDateItems.length, samples: validDateItems.slice(0, 3) },
    { key: 'undated', count: undatedItems.length, samples: undatedItems.slice(0, 3) }
  ]);
  return finalItems;
}

/**
 * Legal heuristics filtering
 */
export function filterByLegalHeuristics(
  items: FilterableEvent[], 
  trace: SearchTrace
): FilterableEvent[] {
  const initialCount = items.length;
  
  const legalKeywords = [
    'legal', 'compliance', 'investigation', 'e-discovery', 'ediscovery', 
    'legal tech', 'legal technology', 'regulatory', 'governance', 
    'risk management', 'audit', 'whistleblowing', 'data protection', 
    'gdpr', 'dsgvo', 'privacy', 'cybersecurity', 'regtech', 'esg',
    'recht', 'compliance', 'untersuchung', 'datenschutz', 'dsgvo',
    'rechtsberatung', 'anwaltskanzlei', 'gericht', 'justiz'
  ];
  
  const eventKeywords = [
    'conference', 'summit', 'forum', 'workshop', 'seminar', 'webinar',
    'training', 'certification', 'event', 'meeting', 'symposium',
    'konferenz', 'kongress', 'tagung', 'seminar', 'workshop', 'forum',
    'veranstaltung', 'fortbildung', 'schulung', 'treffen'
  ];
  
  const filtered = items.filter(item => {
    const title = item.title?.toLowerCase() || '';
    const description = item.description?.toLowerCase() || '';
    const content = `${title} ${description}`;
    
    // Must contain at least one legal keyword
    const hasLegalKeyword = legalKeywords.some(keyword => content.includes(keyword));
    if (!hasLegalKeyword) return false;
    
    // Must contain at least one event keyword
    const hasEventKeyword = eventKeywords.some(keyword => content.includes(keyword));
    if (!hasEventKeyword) return false;
    
    return true;
  });

  updateStageStat(trace.filters.legalHeuristics, initialCount, filtered.length,
    `Legal + event keyword filtering`);
  const legalDropReason: Reason = {
    key: 'legal_keyword',
    count: initialCount - filtered.length,
    samples: items.filter(item => !filtered.includes(item)).slice(0,3)
  };
  stageCounter('filter:legal', items, filtered, [legalDropReason]);
  logSuppressedSamples('filter:legal', [legalDropReason]);
  
  return filtered;
}

/**
 * Deduplication with relaxed rules
 */
export function deduplicateRelaxed(
  items: FilterableEvent[], 
  trace: SearchTrace
): FilterableEvent[] {
  const initialCount = items.length;
  
  const seen = new Set<string>();
  const deduplicated: FilterableEvent[] = [];
  
  items.forEach(item => {
    // Primary deduplication by URL
    if (item.url) {
      const url = item.url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (seen.has(url)) return;
      seen.add(url);
    }
    
    // Secondary deduplication by title similarity
    if (item.title) {
      const titleKey = item.title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (seen.has(`title:${titleKey}`)) return;
      seen.add(`title:${titleKey}`);
    }
    
    deduplicated.push(item);
  });

  const dropped = initialCount - deduplicated.length;
  updateStageStat(trace.filters.dedupe, initialCount, deduplicated.length,
    `URL and title-based deduplication`);
  const dedupeReason: Reason = { key: 'duplicate', count: dropped, samples: items.filter(item => !deduplicated.includes(item)).slice(0,3) };
  stageCounter('filter:dedupe', items, deduplicated, [dedupeReason]);
  logSuppressedSamples('filter:dedupe', [dedupeReason]);
  
  return deduplicated;
}

/**
 * Apply all filters with relaxed rules
 */
export function applyRelaxedFilters(
  items: FilterableEvent[],
  targetCountry: string,
  fromDate: Date,
  toDate: Date,
  trace: SearchTrace
): FilterableEvent[] {
  let filtered = items;
  
  // Country filtering
  filtered = filterByCountryRelaxed(filtered, targetCountry, trace);
  
  // Date filtering
  filtered = filterByDateRelaxed(filtered, fromDate, toDate, trace);
  
  // Legal heuristics
  filtered = filterByLegalHeuristics(filtered, trace);
  
  // Deduplication
  filtered = deduplicateRelaxed(filtered, trace);
  
  return filtered;
}
