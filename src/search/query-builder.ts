/**
 * Centralized Query Builder
 * 
 * Single authority for constructing search queries with proper provenance tracking.
 * Prevents unsolicited augmentation and ensures query length limits.
 */

export type QueryToken = { text: string; source: 'user_config' | 'augmented' };
export type BuiltQuery = { query: string; tokens: QueryToken[]; tier: 'A'|'B'|'C'; };

const MAX_Q = 230;
const ENABLE = process.env.ENABLE_QUERY_AUGMENTATION === '1';

// Minimal, German event scaffold — ONLY used when ENABLE is true
const EVENT_DE = ['Konferenz','Kongress','Tagung','Seminar','Workshop','Forum','Symposium','Veranstaltung','Fortbildung'];

function clampQueries(qs: string[]): string[] {
  // Split rather than hard-truncate: if > MAX_Q, split EVENT_DE chunks
  const out: string[] = [];
  for (const q of qs) {
    if (q.length <= MAX_Q) { 
      out.push(q); 
      continue; 
    }
    
    // naive split: break the event list into smaller OR groups
    const parts = q.split(/\)\s*\(/); // rough split on clause boundaries
    let buf = '';
    for (const p of parts) {
      const next = (buf ? (buf + ')(' + p) : p);
      if (next.length > MAX_Q && buf) { 
        out.push(buf); 
        buf = p; 
      } else { 
        buf = next; 
      }
    }
    if (buf) out.push(buf);
  }
  return out;
}

export function buildQueries(opts: {
  baseQuery: string;      // REQUIRED: from user config
  tier: 'A'|'B'|'C';      // tier routing (A precise, B roles, C curated)
  city?: string;          // optional city
  domain?: string;        // C only: site:domain
}): BuiltQuery[] {
  const tokens: QueryToken[] = [];
  const base = opts.baseQuery?.trim();
  if (!base) throw new Error('Missing baseQuery from user_config');
  tokens.push({ text: base, source: 'user_config' });

  const clauses: string[] = [`(${base})`];

  if (ENABLE) {
    const ev = `(${EVENT_DE.join(' OR ')})`;
    clauses.push(ev);
    EVENT_DE.forEach(t => tokens.push({ text: t, source: 'augmented' }));
  }

  if (opts.city) {
    clauses.push(`("${opts.city}" OR Germany)`);
    tokens.push({ text: opts.city, source: 'augmented' });
  }

  if (opts.domain) {
    clauses.push(`site:${opts.domain}`);
    tokens.push({ text: `site:${opts.domain}`, source: 'augmented' });
  }

  const q = clauses.join(' ');
  const clamped = clampQueries([q]);
  return clamped.map(query => ({ query, tokens, tier: opts.tier }));
}

/**
 * Build tier queries for multi-tier search strategy
 */
export function buildTierQueries(baseQuery: string): { tierA: BuiltQuery[], tierB: BuiltQuery[], tierC: BuiltQuery[] } {
  const CITIES_DE = ['Berlin','München','Frankfurt','Köln','Düsseldorf','Hamburg','Stuttgart','Leipzig','Nürnberg','Hannover','Bremen','Essen','Mannheim','Dortmund','Bonn'];
  
  // Tier A: precise, city-sharded (only when augmentation enabled)
  const tierA: BuiltQuery[] = [];
  if (ENABLE) {
    CITIES_DE.slice(0, 10).forEach(city => {
      tierA.push(...buildQueries({ baseQuery, tier: 'A', city }));
    });
  } else {
    // No augmentation: just the base query
    tierA.push(...buildQueries({ baseQuery, tier: 'A' }));
  }

  // Tier B: roles + events (only when augmentation enabled)
  const tierB: BuiltQuery[] = [];
  if (ENABLE) {
    CITIES_DE.slice(10).forEach(city => {
      tierB.push(...buildQueries({ baseQuery, tier: 'B', city }));
    });
  } else {
    // No augmentation: just the base query
    tierB.push(...buildQueries({ baseQuery, tier: 'B' }));
  }

  // Tier C: curated domains (only when augmentation enabled)
  const tierC: BuiltQuery[] = [];
  if (ENABLE) {
    const DOMAINS = [
      'juve.de/termine','anwaltverein.de','dav.de','forum-institut.de','euroforum.de',
      'beck-akademie.de','dai.de/veranstaltungen','bitkom.org/Veranstaltungen',
      'handelsblatt.com/veranstaltungen','uni-koeln.de','uni-muenchen.de','uni-frankfurt.de'
    ];
    DOMAINS.forEach(domain => {
      tierC.push(...buildQueries({ baseQuery, tier: 'C', domain }));
    });
  } else {
    // No augmentation: just the base query
    tierC.push(...buildQueries({ baseQuery, tier: 'C' }));
  }

  return { tierA, tierB, tierC };
}
