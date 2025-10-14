# PATCH SET - Search Pipeline Hardening

## 1) query-schema.ts (zod + normaliser)

```diff
--- a/src/lib/search/query-schema-v2.ts
+++ b/src/lib/search/query-schema-v2.ts
@@ -0,0 +1,200 @@
+import { z } from 'zod';
+
+// ISO-3166-1 alpha-2 country codes (required)
+const CountryCodeSchema = z.enum([
+  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
+  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
+  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
+  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
+  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
+  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
+  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
+  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
+  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
+  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
+  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
+  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
+  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
+  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
+  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
+  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
+]);
+
+// Main Query Object V2 Schema
+export const QueryObjectV2Schema = z.object({
+  query: z.string().min(1, "Query cannot be empty").max(500, "Query too long").transform((val) => val.trim()),
+  intent: z.enum(['event', 'speaker', 'company', 'topic']),
+  country: CountryCodeSchema,
+  region: z.string().regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/).optional(),
+  language_pref: z.array(z.enum(['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'pt', 'sv', 'da', 'no', 'fi'])).min(1).max(5).default(['en']),
+  date_range: z.object({
+    from: z.string().datetime().optional(),
+    to: z.string().datetime().optional()
+  }).refine((data) => {
+    if (data.from && data.to) {
+      return new Date(data.from) <= new Date(data.to);
+    }
+    return true;
+  }, { message: "Start date must be before end date" }).optional(),
+  freshness_days: z.number().int().min(1).max(365).default(30),
+  sources_allowlist: z.array(z.string().url()).max(50).default([]),
+  sources_blocklist: z.array(z.string().url()).max(50).default([]),
+  page_limit: z.number().int().min(1).max(100).default(10),
+  user_id: z.string().uuid().nullable().default(null)
+});
+
+export type QueryObjectV2 = z.infer<typeof QueryObjectV2Schema>;
+
+export class QueryNormaliser {
+  private static readonly DIACRITICS_MAP: Record<string, string> = {
+    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
+    'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i',
+    'î': 'i', 'ï': 'i', 'ð': 'd', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o',
+    'õ': 'o', 'ö': 'o', 'ø': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
+    'ý': 'y', 'þ': 'th', 'ß': 'ss', 'ÿ': 'y'
+  };
+
+  static normalise(rawQuery: unknown): QueryObjectV2 {
+    const validated = QueryObjectV2Schema.parse(rawQuery);
+    
+    const normalised: QueryObjectV2 = {
+      ...validated,
+      query: this.normaliseSearchTerm(validated.query),
+      country: validated.country.toLowerCase() as any,
+      region: validated.region?.toLowerCase() as any,
+      language_pref: validated.language_pref.map(lang => lang.toLowerCase() as any),
+      sources_allowlist: validated.sources_allowlist.map(url => this.normaliseUrl(url)),
+      sources_blocklist: validated.sources_blocklist.map(url => this.normaliseUrl(url))
+    };
+
+    this.logResolvedFilters(normalised);
+    return normalised;
+  }
+
+  private static normaliseSearchTerm(term: string): string {
+    return term
+      .split('')
+      .map(char => this.DIACRITICS_MAP[char] || char)
+      .join('')
+      .replace(/\s+/g, ' ')
+      .trim();
+  }
+
+  private static normaliseUrl(url: string): string {
+    try {
+      const parsed = new URL(url);
+      return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname}`;
+    } catch {
+      return url;
+    }
+  }
+
+  private static logResolvedFilters(query: QueryObjectV2): void {
+    console.log(JSON.stringify({
+      at: 'query_normalisation',
+      resolved_filters: {
+        country: query.country,
+        region: query.region,
+        languages: query.language_pref,
+        date_range: query.date_range,
+        freshness_days: query.freshness_days,
+        allowlist_count: query.sources_allowlist.length,
+        blocklist_count: query.sources_blocklist.length,
+        page_limit: query.page_limit
+      },
+      timestamp: new Date().toISOString()
+    }));
+  }
+}
```

## 2) buildSearchQuery.ts (server-enforced country filters + CSE builder)

```diff
--- a/src/lib/search/build-search-query.ts
+++ b/src/lib/search/build-search-query.ts
@@ -0,0 +1,100 @@
+import { QueryObjectV2 } from './query-schema-v2';
+
+export class SearchQueryBuilder {
+  static buildCSEQuery(query: QueryObjectV2): {
+    query: string;
+    params: Record<string, string>;
+  } {
+    const baseQuery = query.query;
+    const countryConstraints = this.buildCountryConstraints(query.country);
+    const finalQuery = `${baseQuery} ${countryConstraints}`.trim();
+
+    const params: Record<string, string> = {
+      q: finalQuery,
+      gl: query.country.toUpperCase(),
+      cr: `country${query.country.toUpperCase()}`,
+      hl: query.language_pref[0],
+      num: Math.min(query.page_limit * 10, 100).toString(),
+      safe: 'off'
+    };
+
+    if (query.date_range?.from || query.date_range?.to) {
+      params.tbs = this.buildDateRestriction(query.date_range);
+    }
+
+    if (query.sources_allowlist.length > 0) {
+      const siteRestrictions = query.sources_allowlist
+        .map(url => `site:${new URL(url).hostname}`)
+        .join(' OR ');
+      params.q = `${params.q} (${siteRestrictions})`;
+    }
+
+    return { query: finalQuery, params };
+  }
+
+  static buildFirecrawlQuery(query: QueryObjectV2): {
+    query: string;
+    options: Record<string, any>;
+  } {
+    const baseQuery = query.query;
+    const countryConstraints = this.buildCountryConstraints(query.country);
+    const finalQuery = `${baseQuery} ${countryConstraints}`.trim();
+
+    const options = {
+      limit: Math.min(query.page_limit * 10, 100),
+      sources: ['web'],
+      ignoreInvalidURLs: true,
+      scrapeOptions: {
+        formats: ['markdown'],
+        onlyMainContent: false,
+        waitFor: 800,
+        blockAds: true,
+        removeBase64Images: true,
+        location: {
+          country: query.country.toUpperCase(),
+          languages: query.language_pref
+        }
+      }
+    };
+
+    return { query: finalQuery, options };
+  }
+
+  private static buildCountryConstraints(country: string): string {
+    const constraints: Record<string, string> = {
+      'de': 'site:.de OR "Deutschland" OR "Germany"',
+      'fr': 'site:.fr OR "France" OR "français"',
+      'gb': 'site:.uk OR "United Kingdom" OR "UK"',
+      'us': 'site:.us OR "United States" OR "USA"',
+      'nl': 'site:.nl OR "Netherlands" OR "Nederland"',
+      'es': 'site:.es OR "Spain" OR "España"',
+      'it': 'site:.it OR "Italy" OR "Italia"',
+      'ch': 'site:.ch OR "Switzerland" OR "Schweiz"',
+      'at': 'site:.at OR "Austria" OR "Österreich"',
+      'be': 'site:.be OR "Belgium" OR "België"'
+    };
+
+    return constraints[country.toLowerCase()] || `"${country.toUpperCase()}"`;
+  }
+
+  private static buildDateRestriction(dateRange: { from?: string; to?: string }): string {
+    const now = new Date();
+    const from = dateRange.from ? new Date(dateRange.from) : null;
+    const to = dateRange.to ? new Date(dateRange.to) : null;
+
+    if (from && to) {
+      const fromDays = Math.floor((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
+      const toDays = Math.floor((now.getTime() - to.getTime()) / (1000 * 60 * 60 * 24));
+      return `cdr:1,cd_min:${toDays},cd_max:${fromDays}`;
+    } else if (from) {
+      const days = Math.floor((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
+      return `cdr:1,cd_min:0,cd_max:${days}`;
+    } else if (to) {
+      const days = Math.floor((now.getTime() - to.getTime()) / (1000 * 60 * 60 * 24));
+      return `cdr:1,cd_min:${days},cd_max:365`;
+    }
+
+    return '';
+  }
+}
```

## 3) dedupe.ts (canonical keys + near-dup logic)

```diff
--- a/src/lib/search/deduplication.ts
+++ b/src/lib/search/deduplication.ts
@@ -0,0 +1,150 @@
+export interface EventRecord {
+  source_url: string;
+  title?: string;
+  description?: string;
+  starts_at?: string | null;
+  ends_at?: string | null;
+  city?: string | null;
+  country?: string | null;
+  location?: string | null;
+  venue?: string | null;
+  organizer?: string | null;
+  topics?: string[] | null;
+  speakers?: Array<{ name: string; org?: string; title?: string }>;
+  confidence?: number | null;
+}
+
+export interface CanonicalKey {
+  type: 'event' | 'speaker';
+  key: string;
+  confidence: number;
+  sources: string[];
+}
+
+export class CanonicalKeyGenerator {
+  static generateEventKey(event: EventRecord): CanonicalKey {
+    const normalizedTitle = this.normalizeEventTitle(event.title || '');
+    const normalizedVenue = this.normalizeVenue(event.venue || event.location || '');
+    const startDate = this.normalizeDate(event.starts_at);
+    
+    const key = `${normalizedTitle}|${normalizedVenue}|${startDate}`;
+    
+    return {
+      type: 'event',
+      key,
+      confidence: this.calculateEventKeyConfidence(event),
+      sources: [event.source_url]
+    };
+  }
+
+  private static normalizeEventTitle(title: string): string {
+    return title
+      .toLowerCase()
+      .replace(/\b(conference|summit|workshop|seminar|meeting|event|forum|symposium|exhibition|expo)\b/g, '')
+      .replace(/\b(2024|2025|2026|2027|2028|2029|2030)\b/g, '')
+      .replace(/\b(annual|yearly|monthly|weekly|daily)\b/g, '')
+      .replace(/\b(rd|th|st|nd)\b/g, '')
+      .replace(/[^\w\s]/g, ' ')
+      .replace(/\s+/g, ' ')
+      .trim();
+  }
+
+  private static normalizeVenue(venue: string): string {
+    return venue
+      .toLowerCase()
+      .replace(/\b(conference center|convention center|hotel|venue|location|place)\b/g, '')
+      .replace(/[^\w\s]/g, ' ')
+      .replace(/\s+/g, ' ')
+      .trim();
+  }
+
+  private static normalizeDate(dateStr: string | null | undefined): string {
+    if (!dateStr) return 'unknown';
+    
+    try {
+      const date = new Date(dateStr);
+      return date.toISOString().split('T')[0];
+    } catch {
+      return 'unknown';
+    }
+  }
+
+  private static calculateEventKeyConfidence(event: EventRecord): number {
+    let confidence = 0.5;
+    
+    if (event.title) confidence += 0.2;
+    if (event.venue || event.location) confidence += 0.2;
+    if (event.starts_at) confidence += 0.1;
+    
+    return Math.min(confidence, 1.0);
+  }
+}
+
+export class NearDuplicateDetector {
+  private static readonly LEVENSHTEIN_THRESHOLD = 0.8;
+
+  static detectNearDuplicateEvents(events: EventRecord[]): {
+    canonical: EventRecord[];
+    duplicates: Array<{ canonical: EventRecord; duplicates: EventRecord[]; reason: string; confidence: number }>;
+    stats: { total: number; canonical: number; duplicates: number; deduplicationRate: number };
+  } {
+    const canonical: EventRecord[] = [];
+    const duplicates: Array<{ canonical: EventRecord; duplicates: EventRecord[]; reason: string; confidence: number }> = [];
+    const processed = new Set<string>();
+
+    for (let i = 0; i < events.length; i++) {
+      if (processed.has(events[i].source_url)) continue;
+
+      const canonicalEvent = events[i];
+      const duplicateGroup = [canonicalEvent];
+      processed.add(canonicalEvent.source_url);
+
+      for (let j = i + 1; j < events.length; j++) {
+        if (processed.has(events[j].source_url)) continue;
+
+        const similarity = this.calculateEventSimilarity(canonicalEvent, events[j]);
+        
+        if (similarity.score >= this.LEVENSHTEIN_THRESHOLD) {
+          duplicateGroup.push(events[j]);
+          processed.add(events[j].source_url);
+        }
+      }
+
+      if (duplicateGroup.length > 1) {
+        const bestCanonical = this.selectBestCanonicalEvent(duplicateGroup);
+        canonical.push(bestCanonical);
+        
+        const duplicates_only = duplicateGroup.filter(e => e.source_url !== bestCanonical.source_url);
+        duplicates.push({
+          canonical: bestCanonical,
+          duplicates: duplicates_only,
+          reason: `Near-duplicate detected (similarity: ${similarity.score.toFixed(2)})`,
+          confidence: similarity.score
+        });
+      } else {
+        canonical.push(canonicalEvent);
+      }
+    }
+
+    return {
+      canonical,
+      duplicates,
+      stats: {
+        total: events.length,
+        canonical: canonical.length,
+        duplicates: events.length - canonical.length,
+        deduplicationRate: events.length > 0 ? (events.length - canonical.length) / events.length : 0
+      }
+    };
+  }
+
+  private static calculateEventSimilarity(event1: EventRecord, event2: EventRecord): { score: number; method: string } {
+    const titleSimilarity = this.levenshteinSimilarity(event1.title || '', event2.title || '');
+    const venueSimilarity = this.levenshteinSimilarity(event1.venue || event1.location || '', event2.venue || event2.location || '');
+    const dateSimilarity = this.calculateDateSimilarity(event1.starts_at, event2.starts_at);
+
+    const combinedScore = (titleSimilarity * 0.5 + venueSimilarity * 0.3 + dateSimilarity * 0.2);
+
+    return { score: combinedScore, method: 'weighted_levenshtein' };
+  }
+
+  private static levenshteinSimilarity(str1: string, str2: string): number {
+    if (str1 === str2) return 1.0;
+    if (str1.length === 0 || str2.length === 0) return 0.0;
+
+    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
+
+    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
+    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
+
+    for (let j = 1; j <= str2.length; j++) {
+      for (let i = 1; i <= str1.length; i++) {
+        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
+        matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost);
+      }
+    }
+
+    const maxLength = Math.max(str1.length, str2.length);
+    return 1 - (matrix[str2.length][str1.length] / maxLength);
+  }
+
+  private static calculateDateSimilarity(date1: string | null | undefined, date2: string | null | undefined): number {
+    if (!date1 || !date2) return 0.5;
+    
+    try {
+      const d1 = new Date(date1);
+      const d2 = new Date(date2);
+      const diffDays = Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);
+      
+      if (diffDays === 0) return 1.0;
+      if (diffDays <= 7) return 0.8;
+      if (diffDays <= 30) return 0.5;
+      if (diffDays <= 90) return 0.2;
+      return 0.0;
+    } catch {
+      return 0.0;
+    }
+  }
+
+  private static selectBestCanonicalEvent(events: EventRecord[]): EventRecord {
+    return events.reduce((best, current) => {
+      let score = 0;
+      
+      if (current.source_url.startsWith('https://')) score += 10;
+      if (best.source_url.startsWith('https://')) score -= 10;
+      
+      const officialDomains = ['.org', '.edu', '.gov'];
+      const currentIsOfficial = officialDomains.some(domain => current.source_url.includes(domain));
+      const bestIsOfficial = officialDomains.some(domain => best.source_url.includes(domain));
+      
+      if (currentIsOfficial && !bestIsOfficial) score += 5;
+      if (!currentIsOfficial && bestIsOfficial) score -= 5;
+      
+      if (current.starts_at && best.starts_at) {
+        const currentDate = new Date(current.starts_at);
+        const bestDate = new Date(best.starts_at);
+        if (currentDate > bestDate) score += 3;
+        if (currentDate < bestDate) score -= 3;
+      }
+      
+      if ((current.confidence || 0) > (best.confidence || 0)) score += 2;
+      if ((current.confidence || 0) < (best.confidence || 0)) score -= 2;
+      
+      return score > 0 ? current : best;
+    });
+  }
+}
```

## 4) rerank.ts (feature scoring + plug-in reranker interface)

```diff
--- a/src/lib/search/ranking-stack.ts
+++ b/src/lib/search/ranking-stack.ts
@@ -0,0 +1,200 @@
+export interface SearchCandidate {
+  url: string;
+  title: string;
+  snippet: string;
+  content?: string;
+  metadata?: Record<string, any>;
+}
+
+export interface RankingFeatures {
+  lexicalScore: number;
+  recencyScore: number;
+  authorityScore: number;
+  geoMatchScore: number;
+  schemaScore: number;
+  topicMatchScore: number;
+}
+
+export interface RankingResult {
+  candidate: SearchCandidate;
+  features: RankingFeatures;
+  finalScore: number;
+  rank: number;
+}
+
+export interface RerankerConfig {
+  weights: {
+    lexical: number;
+    recency: number;
+    authority: number;
+    geo: number;
+    schema: number;
+    topic: number;
+  };
+  thresholds: {
+    minScore: number;
+    maxCandidates: number;
+  };
+}
+
+const DEFAULT_RERANKER_CONFIG: RerankerConfig = {
+  weights: {
+    lexical: 0.25,
+    recency: 0.20,
+    authority: 0.20,
+    geo: 0.15,
+    schema: 0.10,
+    topic: 0.10
+  },
+  thresholds: {
+    minScore: 0.3,
+    maxCandidates: 10
+  }
+};
+
+export interface CrossEncoderReranker {
+  name: string;
+  rank(query: string, candidates: SearchCandidate[]): Promise<Array<{ candidate: SearchCandidate; score: number }>>;
+  isAvailable(): Promise<boolean>;
+}
+
+export class LexicalReranker implements CrossEncoderReranker {
+  name = 'lexical';
+
+  async rank(query: string, candidates: SearchCandidate[]): Promise<Array<{ candidate: SearchCandidate; score: number }>> {
+    const queryTerms = this.tokenize(query.toLowerCase());
+    
+    return candidates.map(candidate => {
+      const titleTerms = this.tokenize(candidate.title.toLowerCase());
+      const snippetTerms = this.tokenize(candidate.snippet.toLowerCase());
+      const contentTerms = candidate.content ? this.tokenize(candidate.content.toLowerCase()) : [];
+      
+      const allTerms = [...titleTerms, ...snippetTerms, ...contentTerms];
+      
+      let score = 0;
+      for (const queryTerm of queryTerms) {
+        const termCount = allTerms.filter(term => term === queryTerm).length;
+        const totalTerms = allTerms.length;
+        if (totalTerms > 0) {
+          score += termCount / totalTerms;
+        }
+      }
+      
+      score = score / queryTerms.length;
+      
+      return { candidate, score };
+    });
+  }
+
+  async isAvailable(): Promise<boolean> {
+    return true;
+  }
+
+  private tokenize(text: string): string[] {
+    return text
+      .replace(/[^\w\s]/g, ' ')
+      .split(/\s+/)
+      .filter(term => term.length > 2);
+  }
+}
+
+export class FeatureBasedReranker {
+  private config: RerankerConfig;
+  private crossEncoder?: CrossEncoderReranker;
+
+  constructor(config: RerankerConfig = DEFAULT_RERANKER_CONFIG, crossEncoder?: CrossEncoderReranker) {
+    this.config = config;
+    this.crossEncoder = crossEncoder;
+  }
+
+  async rerank(query: string, candidates: SearchCandidate[], country: string): Promise<RankingResult[]> {
+    let crossEncoderScores: Array<{ candidate: SearchCandidate; score: number }> = [];
+    
+    if (this.crossEncoder && await this.crossEncoder.isAvailable()) {
+      try {
+        crossEncoderScores = await this.crossEncoder.rank(query, candidates);
+      } catch (error) {
+        console.warn('Cross-encoder failed, falling back to lexical:', error);
+        const lexicalReranker = new LexicalReranker();
+        crossEncoderScores = await lexicalReranker.rank(query, candidates);
+      }
+    } else {
+      const lexicalReranker = new LexicalReranker();
+      crossEncoderScores = await lexicalReranker.rank(query, candidates);
+    }
+
+    const results: RankingResult[] = [];
+    
+    for (const { candidate, score: lexicalScore } of crossEncoderScores) {
+      const features = await this.calculateFeatures(candidate, query, country);
+      const finalScore = this.calculateFinalScore(features, lexicalScore);
+      
+      if (finalScore >= this.config.thresholds.minScore) {
+        results.push({
+          candidate,
+          features,
+          finalScore,
+          rank: 0
+        });
+      }
+    }
+
+    results.sort((a, b) => b.finalScore - a.finalScore);
+    results.forEach((result, index) => {
+      result.rank = index + 1;
+    });
+
+    return results.slice(0, this.config.thresholds.maxCandidates);
+  }
+
+  private async calculateFeatures(candidate: SearchCandidate, query: string, country: string): Promise<RankingFeatures> {
+    return {
+      lexicalScore: await this.calculateLexicalScore(candidate, query),
+      recencyScore: this.calculateRecencyScore(candidate),
+      authorityScore: this.calculateAuthorityScore(candidate),
+      geoMatchScore: this.calculateGeoMatchScore(candidate, country),
+      schemaScore: this.calculateSchemaScore(candidate),
+      topicMatchScore: this.calculateTopicMatchScore(candidate, query)
+    };
+  }
+
+  private async calculateLexicalScore(candidate: SearchCandidate, query: string): Promise<number> {
+    const queryTerms = query.toLowerCase().split(/\s+/);
+    const title = candidate.title.toLowerCase();
+    const snippet = candidate.snippet.toLowerCase();
+    const content = candidate.content?.toLowerCase() || '';
+    
+    let score = 0;
+    
+    for (const term of queryTerms) {
+      if (title.includes(term)) score += 0.4;
+      if (snippet.includes(term)) score += 0.3;
+      if (content.includes(term)) score += 0.1;
+    }
+    
+    return Math.min(score, 1.0);
+  }
+
+  private calculateRecencyScore(candidate: SearchCandidate): number {
+    const dateStr = candidate.metadata?.publishedDate || candidate.metadata?.lastModified;
+    
+    if (!dateStr) return 0.5;
+    
+    try {
+      const date = new Date(dateStr);
+      const now = new Date();
+      const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
+      
+      if (daysDiff <= 7) return 1.0;
+      if (daysDiff <= 30) return 0.8;
+      if (daysDiff <= 90) return 0.6;
+      if (daysDiff <= 365) return 0.4;
+      return 0.2;
+    } catch {
+      return 0.5;
+    }
+  }
+
+  private calculateAuthorityScore(candidate: SearchCandidate): number {
+    try {
+      const url = new URL(candidate.url);
+      const domain = url.hostname.toLowerCase();
+      
+      if (domain.endsWith('.gov') || domain.endsWith('.edu')) return 1.0;
+      if (domain.endsWith('.org')) return 0.9;
+      
+      const authoritativeDomains = [
+        'eventbrite.com', 'meetup.com', 'linkedin.com', 'facebook.com',
+        'conference.com', 'summit.com', 'workshop.com'
+      ];
+      
+      if (authoritativeDomains.some(auth => domain.includes(auth))) return 0.8;
+      if (url.protocol === 'https:') return 0.7;
+      
+      return 0.5;
+    } catch {
+      return 0.5;
+    }
+  }
+
+  private calculateGeoMatchScore(candidate: SearchCandidate, country: string): number {
+    const url = candidate.url.toLowerCase();
+    const title = candidate.title.toLowerCase();
+    const snippet = candidate.snippet.toLowerCase();
+    const content = candidate.content?.toLowerCase() || '';
+    
+    const allText = `${url} ${title} ${snippet} ${content}`;
+    
+    const countryIndicators: Record<string, string[]> = {
+      'de': ['.de', 'germany', 'deutschland', 'german'],
+      'fr': ['.fr', 'france', 'français', 'french'],
+      'gb': ['.uk', '.co.uk', 'united kingdom', 'uk', 'britain'],
+      'us': ['.us', 'united states', 'usa', 'america'],
+      'nl': ['.nl', 'netherlands', 'nederland', 'dutch'],
+      'es': ['.es', 'spain', 'españa', 'spanish'],
+      'it': ['.it', 'italy', 'italia', 'italian'],
+      'ch': ['.ch', 'switzerland', 'schweiz', 'swiss'],
+      'at': ['.at', 'austria', 'österreich'],
+      'be': ['.be', 'belgium', 'belgië', 'belgian']
+    };
+    
+    const indicators = countryIndicators[country.toLowerCase()] || [];
+    let score = 0;
+    
+    for (const indicator of indicators) {
+      if (allText.includes(indicator)) {
+        score += indicator.startsWith('.') ? 0.3 : 0.1;
+      }
+    }
+    
+    return Math.min(score, 1.0);
+  }
+
+  private calculateSchemaScore(candidate: SearchCandidate): number {
+    const content = candidate.content || '';
+    
+    const schemaIndicators = [
+      'json-ld', 'microdata', 'rdfa',
+      'event', 'organization', 'person',
+      'startdate', 'enddate', 'location',
+      'speaker', 'agenda', 'schedule'
+    ];
+    
+    let score = 0;
+    for (const indicator of schemaIndicators) {
+      if (content.toLowerCase().includes(indicator)) {
+        score += 0.1;
+      }
+    }
+    
+    return Math.min(score, 1.0);
+  }
+
+  private calculateTopicMatchScore(candidate: SearchCandidate, query: string): number {
+    const queryLower = query.toLowerCase();
+    const title = candidate.title.toLowerCase();
+    const snippet = candidate.snippet.toLowerCase();
+    
+    const eventTerms = [
+      'conference', 'summit', 'workshop', 'seminar', 'meeting',
+      'event', 'forum', 'symposium', 'exhibition', 'expo',
+      'webinar', 'training', 'course', 'session', 'panel'
+    ];
+    
+    let score = 0;
+    
+    for (const term of eventTerms) {
+      if (queryLower.includes(term) && (title.includes(term) || snippet.includes(term))) {
+        score += 0.2;
+      }
+    }
+    
+    return Math.min(score, 1.0);
+  }
+
+  private calculateFinalScore(features: RankingFeatures, lexicalScore: number): number {
+    return (
+      lexicalScore * this.config.weights.lexical +
+      features.recencyScore * this.config.weights.recency +
+      features.authorityScore * this.config.weights.authority +
+      features.geoMatchScore * this.config.weights.geo +
+      features.schemaScore * this.config.weights.schema +
+      features.topicMatchScore * this.config.weights.topic
+    );
+  }
+}
```

## 5) eval/run-evals.ts (loads gold set, prints metrics, sets CI exit code)

```diff
--- a/src/lib/search/evaluation-harness.ts
+++ b/src/lib/search/evaluation-harness.ts
@@ -0,0 +1,100 @@
+export interface GoldQuery {
+  id: string;
+  query: string;
+  intent: 'event' | 'speaker' | 'company' | 'topic';
+  country: string;
+  must_contain_domains: string[];
+  must_not_contain_domains: string[];
+  expected_topics: string[];
+  freshness_days: number;
+  expected_min_precision_k: number;
+  expected_results_count: number;
+}
+
+export interface EvaluationResult {
+  queryId: string;
+  query: string;
+  country: string;
+  metrics: {
+    precision_at_5: number;
+    ndcg_at_10: number;
+    localisation_accuracy: number;
+    dedup_rate: number;
+    mean_time_ms: number;
+    cost_pence: number;
+  };
+  violations: {
+    localisation: string[];
+    domain_mismatches: string[];
+    topic_mismatches: string[];
+  };
+  passed: boolean;
+}
+
+export interface EvaluationSummary {
+  total_queries: number;
+  passed_queries: number;
+  failed_queries: number;
+  overall_metrics: {
+    precision_at_5: number;
+    ndcg_at_10: number;
+    localisation_accuracy: number;
+    dedup_rate: number;
+    mean_time_ms: number;
+    cost_pence: number;
+  };
+  ci_status: 'PASS' | 'FAIL';
+  failure_reasons: string[];
+}
+
+const GOLD_QUERIES: GoldQuery[] = [
+  {
+    id: 'de_001',
+    query: 'legal conference',
+    intent: 'event',
+    country: 'DE',
+    must_contain_domains: ['.de', 'germany', 'deutschland'],
+    must_not_contain_domains: ['.fr', 'france', '.uk', 'britain'],
+    expected_topics: ['legal', 'conference', 'law'],
+    freshness_days: 30,
+    expected_min_precision_k: 0.8,
+    expected_results_count: 5
+  },
+  {
+    id: 'fr_001',
+    query: 'legal conference',
+    intent: 'event',
+    country: 'FR',
+    must_contain_domains: ['.fr', 'france', 'français'],
+    must_not_contain_domains: ['.de', 'germany', 'deutschland'],
+    expected_topics: ['legal', 'conference', 'law'],
+    freshness_days: 30,
+    expected_min_precision_k: 0.8,
+    expected_results_count: 5
+  }
+  // ... more queries
+];
+
+export class EvaluationHarness {
+  private goldQueries: GoldQuery[];
+
+  constructor(goldQueries: GoldQuery[] = GOLD_QUERIES) {
+    this.goldQueries = goldQueries;
+  }
+
+  async runEvaluation(
+    searchFunction: (query: string, country: string) => Promise<{
+      results: Array<{ url: string; title: string; snippet: string; content?: string }>;
+      metrics: { latencyMs: number; costPence: number };
+    }>
+  ): Promise<EvaluationSummary> {
+    const results: EvaluationResult[] = [];
+
+    for (const goldQuery of this.goldQueries) {
+      try {
+        const result = await this.evaluateQuery(goldQuery, searchFunction);
+        results.push(result);
+        
+        console.log(`Query ${goldQuery.id}: ${result.passed ? 'PASS' : 'FAIL'} (P@5: ${result.metrics.precision_at_5.toFixed(3)})`);
+      } catch (error) {
+        console.error(`Error evaluating query ${goldQuery.id}:`, error);
+        results.push({
+          queryId: goldQuery.id,
+          query: goldQuery.query,
+          country: goldQuery.country,
+          metrics: {
+            precision_at_5: 0,
+            ndcg_at_10: 0,
+            localisation_accuracy: 0,
+            dedup_rate: 0,
+            mean_time_ms: 0,
+            cost_pence: 0
+          },
+          violations: {
+            localisation: ['Evaluation error'],
+            domain_mismatches: [],
+            topic_mismatches: []
+          },
+          passed: false
+        });
+      }
+    }
+
+    return this.computeSummary(results);
+  }
+
+  private async evaluateQuery(
+    goldQuery: GoldQuery,
+    searchFunction: (query: string, country: string) => Promise<{
+      results: Array<{ url: string; title: string; snippet: string; content?: string }>;
+      metrics: { latencyMs: number; costPence: number };
+    }>
+  ): Promise<EvaluationResult> {
+    const startTime = Date.now();
+    const searchResult = await searchFunction(goldQuery.query, goldQuery.country);
+    const latencyMs = Date.now() - startTime;
+
+    const precisionAt5 = this.computePrecisionAtK(searchResult.results, goldQuery, 5);
+    const ndcgAt10 = this.computeNDCGAtK(searchResult.results, goldQuery, 10);
+    const localisationAccuracy = this.computeLocalisationAccuracy(searchResult.results, goldQuery);
+    const dedupRate = this.computeDedupRate(searchResult.results);
+
+    const violations = this.checkViolations(searchResult.results, goldQuery);
+
+    const passed = precisionAt5 >= goldQuery.expected_min_precision_k &&
+                   localisationAccuracy >= 0.99 &&
+                   violations.localisation.length === 0;
+
+    return {
+      queryId: goldQuery.id,
+      query: goldQuery.query,
+      country: goldQuery.country,
+      metrics: {
+        precision_at_5: precisionAt5,
+        ndcg_at_10: ndcgAt10,
+        localisation_accuracy: localisationAccuracy,
+        dedup_rate: dedupRate,
+        mean_time_ms: latencyMs,
+        cost_pence: searchResult.metrics.costPence
+      },
+      violations,
+      passed
+    };
+  }
+
+  private computePrecisionAtK(
+    results: Array<{ url: string; title: string; snippet: string; content?: string }>,
+    goldQuery: GoldQuery,
+    k: number
+  ): number {
+    const topK = results.slice(0, k);
+    let relevantCount = 0;
+
+    for (const result of topK) {
+      if (this.isRelevant(result, goldQuery)) {
+        relevantCount++;
+      }
+    }
+
+    return relevantCount / k;
+  }
+
+  private computeNDCGAtK(
+    results: Array<{ url: string; title: string; snippet: string; content?: string }>,
+    goldQuery: GoldQuery,
+    k: number
+  ): number {
+    const topK = results.slice(0, k);
+    let dcg = 0;
+
+    for (let i = 0; i < topK.length; i++) {
+      const relevance = this.isRelevant(topK[i], goldQuery) ? 1 : 0;
+      dcg += relevance / Math.log2(i + 2);
+    }
+
+    const relevantCount = Math.min(k, goldQuery.expected_results_count);
+    let idcg = 0;
+    for (let i = 0; i < relevantCount; i++) {
+      idcg += 1 / Math.log2(i + 2);
+    }
+
+    return idcg > 0 ? dcg / idcg : 0;
+  }
+
+  private computeLocalisationAccuracy(
+    results: Array<{ url: string; title: string; snippet: string; content?: string }>,
+    goldQuery: GoldQuery
+  ): number {
+    if (results.length === 0) return 0;
+
+    let correctCount = 0;
+    for (const result of results) {
+      if (this.isLocalisedCorrectly(result, goldQuery)) {
+        correctCount++;
+      }
+    }
+
+    return correctCount / results.length;
+  }
+
+  private computeDedupRate(
+    results: Array<{ url: string; title: string; snippet: string; content?: string }>
+  ): number {
+    if (results.length === 0) return 0;
+
+    const uniqueUrls = new Set(results.map(r => r.url));
+    const duplicates = results.length - uniqueUrls.size;
+    
+    return duplicates / results.length;
+  }
+
+  private checkViolations(
+    results: Array<{ url: string; title: string; snippet: string; content?: string }>,
+    goldQuery: GoldQuery
+  ): {
+    localisation: string[];
+    domain_mismatches: string[];
+    topic_mismatches: string[];
+  } {
+    const violations = {
+      localisation: [] as string[],
+      domain_mismatches: [] as string[],
+      topic_mismatches: [] as string[]
+    };
+
+    for (const result of results) {
+      if (!this.isLocalisedCorrectly(result, goldQuery)) {
+        violations.localisation.push(result.url);
+      }
+
+      if (this.hasDomainMismatch(result, goldQuery)) {
+        violations.domain_mismatches.push(result.url);
+      }
+
+      if (!this.hasTopicMatch(result, goldQuery)) {
+        violations.topic_mismatches.push(result.url);
+      }
+    }
+
+    return violations;
+  }
+
+  private isRelevant(
+    result: { url: string; title: string; snippet: string; content?: string },
+    goldQuery: GoldQuery
+  ): boolean {
+    return this.isLocalisedCorrectly(result, goldQuery) &&
+           this.hasTopicMatch(result, goldQuery) &&
+           !this.hasDomainMismatch(result, goldQuery);
+  }
+
+  private isLocalisedCorrectly(
+    result: { url: string; title: string; snippet: string; content?: string },
+    goldQuery: GoldQuery
+  ): boolean {
+    const allText = `${result.url} ${result.title} ${result.snippet} ${result.content || ''}`.toLowerCase();
+    
+    const hasRequiredDomain = goldQuery.must_contain_domains.some(domain => 
+      allText.includes(domain.toLowerCase())
+    );
+    
+    const hasForbiddenDomain = goldQuery.must_not_contain_domains.some(domain => 
+      allText.includes(domain.toLowerCase())
+    );
+    
+    return hasRequiredDomain && !hasForbiddenDomain;
+  }
+
+  private hasDomainMismatch(
+    result: { url: string; title: string; snippet: string; content?: string },
+    goldQuery: GoldQuery
+  ): boolean {
+    const allText = `${result.url} ${result.title} ${result.snippet} ${result.content || ''}`.toLowerCase();
+    
+    return goldQuery.must_not_contain_domains.some(domain => 
+      allText.includes(domain.toLowerCase())
+    );
+  }
+
+  private hasTopicMatch(
+    result: { url: string; title: string; snippet: string; content?: string },
+    goldQuery: GoldQuery
+  ): boolean {
+    const allText = `${result.title} ${result.snippet} ${result.content || ''}`.toLowerCase();
+    
+    return goldQuery.expected_topics.some(topic => 
+      allText.includes(topic.toLowerCase())
+    );
+  }
+
+  private computeSummary(results: EvaluationResult[]): EvaluationSummary {
+    const passedQueries = results.filter(r => r.passed);
+    const failedQueries = results.filter(r => !r.passed);
+
+    const overallMetrics = {
+      precision_at_5: results.reduce((sum, r) => sum + r.metrics.precision_at_5, 0) / results.length,
+      ndcg_at_10: results.reduce((sum, r) => sum + r.metrics.ndcg_at_10, 0) / results.length,
+      localisation_accuracy: results.reduce((sum, r) => sum + r.metrics.localisation_accuracy, 0) / results.length,
+      dedup_rate: results.reduce((sum, r) => sum + r.metrics.dedup_rate, 0) / results.length,
+      mean_time_ms: results.reduce((sum, r) => sum + r.metrics.mean_time_ms, 0) / results.length,
+      cost_pence: results.reduce((sum, r) => sum + r.metrics.cost_pence, 0) / results.length
+    };
+
+    const ciStatus = this.determineCIStatus(overallMetrics, failedQueries);
+    const failureReasons = this.collectFailureReasons(failedQueries);
+
+    return {
+      total_queries: results.length,
+      passed_queries: passedQueries.length,
+      failed_queries: failedQueries.length,
+      overall_metrics: overallMetrics,
+      ci_status: ciStatus,
+      failure_reasons: failureReasons
+    };
+  }
+
+  private determineCIStatus(
+    metrics: any,
+    failedQueries: EvaluationResult[]
+  ): 'PASS' | 'FAIL' {
+    if (metrics.precision_at_5 < 0.82) return 'FAIL';
+    if (metrics.localisation_accuracy < 0.99) return 'FAIL';
+    if (metrics.mean_time_ms > 2000) return 'FAIL';
+    if (failedQueries.length > results.length * 0.1) return 'FAIL';
+
+    return 'PASS';
+  }
+
+  private collectFailureReasons(failedQueries: EvaluationResult[]): string[] {
+    const reasons = new Set<string>();
+
+    for (const query of failedQueries) {
+      if (query.metrics.precision_at_5 < 0.8) {
+        reasons.add(`Low precision: ${query.queryId} (${query.metrics.precision_at_5.toFixed(3)})`);
+      }
+      if (query.metrics.localisation_accuracy < 0.99) {
+        reasons.add(`Localisation failure: ${query.queryId} (${query.metrics.localisation_accuracy.toFixed(3)})`);
+      }
+      if (query.violations.localisation.length > 0) {
+        reasons.add(`Localisation violations: ${query.queryId} (${query.violations.localisation.length} violations)`);
+      }
+    }
+
+    return Array.from(reasons);
+  }
+}
+
+export class CIIntegration {
+  static async runEvaluationAndExit(): Promise<void> {
+    const harness = new EvaluationHarness();
+    
+    const mockSearchFunction = async (query: string, country: string) => {
+      return {
+        results: [
+          {
+            url: `https://example.${country.toLowerCase()}/event1`,
+            title: `${query} in ${country}`,
+            snippet: `This is a ${query} event in ${country}`,
+            content: `Full content about ${query} in ${country}`
+          }
+        ],
+        metrics: {
+          latencyMs: 1000,
+          costPence: 10
+        }
+      };
+    };
+
+    try {
+      const summary = await harness.runEvaluation(mockSearchFunction);
+      
+      console.log('\n=== EVALUATION SUMMARY ===');
+      console.log(`Total Queries: ${summary.total_queries}`);
+      console.log(`Passed: ${summary.passed_queries}`);
+      console.log(`Failed: ${summary.failed_queries}`);
+      console.log(`CI Status: ${summary.ci_status}`);
+      console.log('\nOverall Metrics:');
+      console.log(`  Precision@5: ${summary.overall_metrics.precision_at_5.toFixed(3)}`);
+      console.log(`  NDCG@10: ${summary.overall_metrics.ndcg_at_10.toFixed(3)}`);
+      console.log(`  Localisation Accuracy: ${summary.overall_metrics.localisation_accuracy.toFixed(3)}`);
+      console.log(`  Dedup Rate: ${summary.overall_metrics.dedup_rate.toFixed(3)}`);
+      console.log(`  Mean Time: ${summary.overall_metrics.mean_time_ms.toFixed(0)}ms`);
+      console.log(`  Cost: ${summary.overall_metrics.cost_pence.toFixed(2)}p`);
+      
+      if (summary.failure_reasons.length > 0) {
+        console.log('\nFailure Reasons:');
+        summary.failure_reasons.forEach(reason => console.log(`  - ${reason}`));
+      }
+
+      process.exit(summary.ci_status === 'PASS' ? 0 : 1);
+      
+    } catch (error) {
+      console.error('Evaluation failed:', error);
+      process.exit(1);
+    }
+  }
+}
```
