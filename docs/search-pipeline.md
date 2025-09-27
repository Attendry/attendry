# Enhanced Legal Events Search Pipeline

## Overview

The enhanced search pipeline is designed to find relevant legal and compliance events in Germany using a multi-tier approach with AI-powered prioritization and content extraction.

## Architecture

### 1. Query Building (Tiered Strategy)

The system builds multiple search queries in tiers:

- **Tier A (Precise)**: Combines legal event terms with base query for maximum relevance
- **Tier B (Legal Ops)**: Focuses on legal operations and compliance roles
- **Tier C (Curated Domains)**: Uses trusted legal domain allowlist

### 2. Multi-Strategy Search

- Executes tiers in order until sufficient results are found
- Each tier has different thresholds and fallback strategies
- URLs are filtered and deduplicated across tiers

### 3. AI-Powered Prioritization

- Uses Gemini 1.5 Flash with strict JSON responses
- Ranks URLs based on legal and event confidence scores
- Includes robust JSON parsing with fallback strategies

### 4. Content Extraction

- Firecrawl integration with timeout handling
- Batch processing with size limits
- Fallback to scrape when extract fails

### 5. Country & Date Inference

- Infers country from URL and content
- Extracts dates using German date patterns
- Filters events by date range and country

## Configuration

### Search Thresholds

```typescript
SEARCH_THRESHOLDS = {
  MIN_RESULTS_TIER_A: 10,        // Minimum results from Tier A
  MIN_RESULTS_TIER_B: 5,         // Minimum results from Tier B
  MIN_FINAL_RESULTS: 5,          // Minimum final results
  MAX_QUERY_LENGTH: 256,         // Maximum query length
  MAX_BATCH_SIZE: 5,             // Maximum batch size for extraction
  MAX_POLL_MS: 25000,            // Maximum polling time
  MAX_CONTENT_SIZE_MB: 1.5,      // Maximum content size
  MAX_LINKS_PER_PAGE: 200,       // Maximum links per page
  MIN_EVENT_CONFIDENCE: 0.6,     // Minimum event confidence
  MIN_LEGAL_CONFIDENCE: 0.5      // Minimum legal confidence
}
```

### Legal Event Terms

The system searches for events containing these German legal terms:

- Rechtskonferenz, Rechtskongress, Rechtsforum
- Compliance Konferenz, Compliance-Tagung
- juristische Tagung, juristische Fortbildung
- Legal Operations, eDiscovery, E-Discovery
- Interne Untersuchung, Geldwäsche, Forensik
- Datenschutz, GDPR, DSGVO, Whistleblowing
- Wirtschaftsstrafrecht, Corporate Investigations

### Event Terms

General event terms used in searches:

- Konferenz, Kongress, Tagung, Seminar
- Workshop, Forum, Summit, Fachtag
- Fachveranstaltung, Fortbildung, Weiterbildung
- Symposium, Event, Veranstaltung

### Domain Allowlist

Trusted legal domains for Tier C searches:

- beck-akademie.de, beck-community.de
- dav.de, anwaltverein.de
- uni-koeln.de, uni-muenchen.de, uni-frankfurt.de
- bdr-legal.de, forum-institut.de, euroforum.de
- handelsblatt.com/veranstaltungen
- nwjv.de, dfk-verein.de
- juraforum.de, juve.de/termine
- zfbf.de, ComplianceNetzwerk.de
- bitkom.org/Veranstaltungen

## Usage

### Basic Search

```typescript
import { EnhancedSearchService } from '@/lib/services/enhanced-search-service';

const searchService = new EnhancedSearchService(
  process.env.GEMINI_API_KEY!,
  process.env.FIRECRAWL_API_KEY!
);

const results = await searchService.search({
  baseQuery: 'Compliance OR "Interne Untersuchung" OR eDiscovery OR DSGVO',
  fromISO: '2024-01-01',
  toISO: '2024-12-31',
  country: 'DE',
  allowUndated: false,
  maxResults: 50
});
```

### Search Trace

The service returns a detailed trace for debugging:

```typescript
interface EnhancedSearchTrace {
  finalQueries: Array<{ name: string; query: string; length: number }>;
  urls: { checked: number; kept: number; filtered: Array<{ url: string; reason: string }> };
  tiers: { [tierName: string]: { executed: boolean; results: number; urls: string[] } };
  prioritization: { model: string; repairUsed: boolean; stats: any };
  extract: { stats: { polledAttempts: number; timedOut: number; successful: number; failed: number } };
  filtering: { countryDate: { before: number; after: number; reasons: string[] } };
}
```

## Error Handling

### JSON Parsing

The system uses multiple fallback strategies for JSON parsing:

1. Direct JSON.parse
2. JSON repair (fixes common issues)
3. JSON5 parsing (more lenient)
4. Heuristic fallback

### Timeout Handling

- Extract operations timeout after 25 seconds
- Fallback to scrape when extract fails
- Batch processing prevents overwhelming the API

### Content Filtering

- Filters out noise URLs (tourism, sports, etc.)
- Prefers event-related URL paths
- Checks content size and link count

## Performance Considerations

- Queries are limited to 256 characters
- Long queries are split into multiple batches
- Content is chunked for large pages
- Batch size is limited to 5 URLs per request
- Exponential backoff for retries

## Monitoring

The system logs detailed information for monitoring:

- Query execution times
- URL filtering reasons
- JSON parsing success/failure
- Extract timeout occurrences
- Final result counts

## Future Improvements

- Add more sophisticated content analysis
- Implement caching for repeated searches
- Add support for other countries (AT, CH)
- Improve date extraction accuracy
- Add more legal domain sources
