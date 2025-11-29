# Firecrawl v2 Pipeline Optimization Plan

**Date:** 2025-02-25  
**Status:** Analysis & Planning  
**Priority:** High - Leverage New Pricing Model

---

## Executive Summary

Firecrawl has updated their pricing model, making extensive use of search, scrape, and extract operations cost-effective. This document analyzes the current pipeline implementation and provides a comprehensive plan to optimize it using Firecrawl v2's enhanced capabilities.

### Key Opportunities

1. **Unified Search + Scrape**: Use `/search` endpoint with `scrapeOptions` to get content directly
2. **Batch Operations**: Leverage batch extraction and scraping for efficiency
3. **Enhanced Extraction**: Use new features (images, data attributes, PDF parsing)
4. **Search Categories**: Filter by categories (github, research) for better targeting
5. **Natural Language Crawling**: Use prompts to automatically determine crawl paths

---

## Current Pipeline Analysis

### Current Architecture

```
Discovery Phase:
  └─ Firecrawl /search → Returns URLs only
      └─ scrapeContent: true (but only gets markdown snippets)

Extraction Phase:
  └─ Firecrawl /extract → Separate API call per URL/batch
      └─ Uses schema + prompt for structured extraction
      └─ Crawls sub-pages (maxDepth: 3, maxPages: 12)
```

### Current Implementation Details

#### 1. Search Implementation (`src/lib/search/unified-search-core.ts`)

**Current Usage:**
```typescript
const body: any = {
  query: firecrawlQuery,
  limit: params.limit || 20,
  sources: ['web'],
  timeout: 45000
};

// Only basic scraping if requested
if (params.scrapeContent) {
  body.scrapeOptions = {
    formats: ['markdown'],
    onlyMainContent: true
  };
}
```

**Issues:**
- ✅ Already using v2 API
- ❌ Not leveraging full scrapeOptions capabilities
- ❌ Not using search categories
- ❌ Not extracting structured data during search
- ❌ Returns only URLs, content is minimal

#### 2. Extraction Implementation (`src/app/api/events/extract/route.ts`)

**Current Usage:**
```typescript
// Separate /extract call after search
await fetch("https://api.firecrawl.dev/v2/extract", {
  method: "POST",
  body: JSON.stringify({
    urls: [url],  // or batch: urls array
    schema: EVENT_SCHEMA,
    prompt: enhancedPrompt,
    scrapeOptions: {
      onlyMainContent: true,
      formats: ["markdown", "html"],
      parsers: ["pdf"],
      waitFor: 1200,
      location: { country: "DE", languages: [...] },
      blockAds: true,
      removeBase64Images: true,
      crawlerOptions: {
        maxDepth: 3,
        maxPagesToCrawl: 12,
        includePatterns: [...]
      }
    }
  })
});
```

**Issues:**
- ✅ Already using v2 API
- ✅ Using batch extraction (3+ URLs)
- ❌ Not using new features (images, data attributes)
- ❌ Not leveraging natural language crawl prompts
- ❌ Separate API call after search (inefficient)

#### 3. Discovery Implementation (`src/lib/event-pipeline/discover.ts`)

**Current Usage:**
```typescript
const unifiedResult = await unifiedSearch({
  q: query,
  country: country || undefined,
  limit: 15,
  scrapeContent: true,  // Gets markdown snippets
  useCache: true
});
```

**Issues:**
- ✅ Using unified search core
- ❌ Not getting full content during search
- ❌ Not using structured extraction during search
- ❌ Requires separate extraction phase

---

## Firecrawl v2 New Features Analysis

### 1. Unified Search + Scrape (`/search` with `scrapeOptions`)

**Capability:**
- Search and scrape in a single API call
- Get full content, not just snippets
- Can extract structured data during search
- Supports multiple formats (markdown, html, json, images)

**Benefits:**
- **Reduced API calls**: 1 call instead of 2 (search + extract)
- **Lower latency**: No need to wait for search, then extract
- **Cost efficiency**: Single operation vs. two separate operations
- **Better relevance**: Can filter results based on scraped content

**Example:**
```typescript
{
  query: "legal compliance conferences Germany",
  limit: 20,
  sources: ["web"],
  scrapeOptions: {
    formats: ["markdown", "html"],
    onlyMainContent: true,
    extract: {
      schema: EVENT_SCHEMA,
      prompt: "Extract event details..."
    }
  }
}
```

### 2. Search Categories

**Capability:**
- Filter search results by category (github, research, news, etc.)
- Target specific source types
- Improve relevance for event searches

**Benefits:**
- **Better targeting**: Focus on event-specific sources
- **Reduced noise**: Filter out irrelevant sources
- **Higher quality**: Get results from authoritative sources

**Example:**
```typescript
{
  query: "legal compliance conferences",
  categories: ["research"],  // Focus on research/event sites
  sources: ["web"]
}
```

### 3. Enhanced Scraping Features

**New Capabilities:**
- **Image extraction**: `formats: ["images"]` to get event images
- **Data attributes**: Extract `data-*` attributes from HTML
- **PDF parsing**: Enhanced PDF title and content extraction
- **Google Drive**: Scrape Google Drive documents (TXT, PDF, Sheets)

**Benefits:**
- **Richer data**: Get images, structured data attributes
- **Better extraction**: PDF titles, Google Drive content
- **More sources**: Access Google Drive event documents

### 4. Natural Language Crawling

**Capability:**
- Use prompts to automatically determine crawl paths
- No need to specify exact patterns
- AI determines what to crawl

**Benefits:**
- **Simpler configuration**: Natural language instead of regex patterns
- **Better coverage**: AI finds relevant pages automatically
- **Less maintenance**: No need to update patterns

**Example:**
```typescript
{
  url: "https://event-site.com",
  crawlOptions: {
    prompt: "Find all event pages, speaker pages, and agenda pages",
    maxPages: 20
  }
}
```

### 5. Batch Operations

**Capability:**
- Batch extraction: Multiple URLs in single request
- Batch scraping: Multiple URLs in single request
- More efficient API usage

**Benefits:**
- **Reduced overhead**: Single request vs. multiple
- **Better rate limiting**: Fewer API calls
- **Cost efficiency**: Batch operations are more cost-effective

---

## Optimization Plan

### Phase 1: Unified Search + Scrape (HIGH PRIORITY)

**Objective:** Combine search and extraction into a single operation.

**Implementation:**

#### 1.1 Update Unified Search Core

**File:** `src/lib/search/unified-search-core.ts`

**Changes:**
```typescript
async function unifiedFirecrawlSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  // ... existing code ...
  
  const body: any = {
    query: firecrawlQuery,
    limit: params.limit || 20,
    sources: ['web'],
    timeout: 45000
  };

  // ENHANCED: Use comprehensive scrapeOptions
  if (params.scrapeContent || params.extractSchema) {
    body.scrapeOptions = {
      formats: ['markdown', 'html'],  // Get both formats
      onlyMainContent: true,
      blockAds: true,
      removeBase64Images: true,
      waitFor: 2000,  // Wait for dynamic content
      
      // NEW: Extract structured data during search
      ...(params.extractSchema && {
        extract: {
          schema: params.extractSchema,
          prompt: params.extractPrompt || "Extract event details from this page"
        }
      })
    };
  }

  // NEW: Use search categories for better targeting
  if (params.categories) {
    body.categories = params.categories;  // e.g., ["research"]
  }

  // ... rest of implementation ...
  
  // ENHANCED: Parse response with scraped content
  const webResults = data?.data?.web || [];
  const items = webResults.map((item: any) => ({
    url: item.url,
    title: item.title,
    description: item.description,
    markdown: item.markdown,  // Full scraped content
    html: item.html,  // HTML content if available
    extracted: item.extracted,  // Structured data if extract was used
    metadata: {
      source: item.source,
      publishedAt: item.publishedAt,
      // ... other metadata
    }
  }));
}
```

**New Interface:**
```typescript
export interface UnifiedSearchParams {
  q: string;
  narrativeQuery?: string;
  queryMode?: 'persistent' | 'refine' | 'override';
  userSearchInput?: string;
  dateFrom?: string;
  dateTo?: string;
  country?: string;
  limit?: number;
  scrapeContent?: boolean;
  extractSchema?: any;  // NEW: Schema for extraction
  extractPrompt?: string;  // NEW: Prompt for extraction
  categories?: string[];  // NEW: Search categories
  useCache?: boolean;
  userProfile?: any;
}
```

#### 1.2 Update Discovery to Use Unified Search + Extract

**File:** `src/lib/event-pipeline/discover.ts`

**Changes:**
```typescript
private async discoverFromFirecrawl(
  query: string, 
  country: string | null, 
  context?: PipelineContext
): Promise<{ candidates: EventCandidate[]; provider: string }> {
  // ... existing code ...
  
  // ENHANCED: Use unified search with extraction
  const unifiedResult = await unifiedSearch({
    q: query,
    dateFrom: context?.dateFrom || undefined,
    dateTo: context?.dateTo || undefined,
    country: country || undefined,
    limit: 15,
    scrapeContent: true,  // Get full content
    extractSchema: EVENT_SCHEMA,  // NEW: Extract during search
    extractPrompt: "Extract event details including title, dates, location, and speakers",
    categories: ['research'],  // NEW: Focus on research/event sites
    useCache: true
  });
  
  // ENHANCED: Process results with extracted data
  const candidates = unifiedResult.items.map((item: any, index: number) => {
    // If extraction was done during search, use that data
    const extractedData = item.extracted || null;
    
    return {
      id: `firecrawl_${Date.now()}_${index}`,
      url: item.url,
      source: 'firecrawl' as const,
      discoveredAt: new Date(),
      relatedUrls: [],
      status: 'discovered' as const,
      metadata: {
        originalQuery: query,
        country,
        processingTime: Date.now() - startTime,
        // ENHANCED: Include extracted data if available
        extracted: extractedData,
        scrapedContent: item.markdown,
        scrapedHtml: item.html,
        title: item.title || extractedData?.title,
        description: item.description || extractedData?.description,
        // ... other metadata
      }
    };
  });
  
  // If extraction was done during search, some candidates may already have full data
  // Skip separate extraction phase for these
  return { candidates, provider: 'firecrawl' };
}
```

**Benefits:**
- ✅ Single API call instead of two
- ✅ Lower latency (no wait between search and extract)
- ✅ Cost efficiency (one operation vs. two)
- ✅ Better relevance (can filter based on extracted content)

---

### Phase 2: Enhanced Extraction Features (MEDIUM PRIORITY)

**Objective:** Leverage new extraction features (images, data attributes, PDF parsing).

#### 2.1 Add Image Extraction

**File:** `src/app/api/events/extract/route.ts`

**Changes:**
```typescript
scrapeOptions: {
  onlyMainContent: true,
  formats: ["markdown", "html", "images"],  // NEW: Include images
  parsers: ["pdf"],
  waitFor: 1200,
  location: { 
    country: (locale || hostCountry || "DE").toUpperCase(), 
    languages: ["de-DE","en-GB","fr-FR","it-IT","es-ES","nl-NL","pt-PT","pl-PL"] 
  },
  blockAds: true,
  removeBase64Images: true,
  // NEW: Extract data attributes
  extractDataAttributes: true,
  crawlerOptions: {
    maxDepth: Math.min(3, (crawl?.depth ?? 3)),
    maxPagesToCrawl: 12,
    allowSubdomains: true,
    includePatterns: [
      "konferenz","kongress","veranstaltung","fachkonferenz","fachkongress",
      "agenda","programm","referenten","sprecher","vortragende",
      "tickets","anmeldung","teilnahme","termin","schedule","speakers"
    ]
  }
}
```

**Process Images:**
```typescript
// After extraction, process images
if (result.images && result.images.length > 0) {
  event.metadata.images = result.images
    .filter(img => img.url && !img.url.includes('logo') && !img.url.includes('icon'))
    .slice(0, 5);  // Keep top 5 event images
}
```

#### 2.2 Enhanced PDF Parsing

**Changes:**
```typescript
scrapeOptions: {
  parsers: ["pdf"],
  pdfOptions: {
    extractTitle: true,  // NEW: Extract PDF titles
    extractMetadata: true  // NEW: Extract PDF metadata
  }
}
```

#### 2.3 Data Attributes Extraction

**Changes:**
```typescript
// Extract structured data from data-* attributes
if (result.dataAttributes) {
  // Look for event data in data-* attributes
  const eventData = extractFromDataAttributes(result.dataAttributes);
  if (eventData) {
    // Merge with extracted data
    merged = mergeDetails(merged, eventData);
  }
}
```

**Benefits:**
- ✅ Richer event data (images, structured attributes)
- ✅ Better PDF handling
- ✅ More complete event information

---

### Phase 3: Natural Language Crawling (MEDIUM PRIORITY)

**Objective:** Use natural language prompts for crawling instead of regex patterns.

#### 3.1 Update Crawl Configuration

**File:** `src/app/api/events/extract/route.ts`

**Changes:**
```typescript
// OLD: Regex patterns
includePatterns: [
  "konferenz","kongress","veranstaltung","fachkonferenz","fachkongress",
  "agenda","programm","referenten","sprecher","vortragende",
  "tickets","anmeldung","teilnahme","termin","schedule","speakers"
]

// NEW: Natural language prompt
crawlerOptions: {
  prompt: "Find all event pages including agenda, program, speakers, schedule, and registration pages. Focus on pages with event dates, locations, and speaker information.",
  maxDepth: 3,
  maxPagesToCrawl: 12,
  allowSubdomains: true
}
```

**Benefits:**
- ✅ Simpler configuration
- ✅ Better coverage (AI finds relevant pages)
- ✅ Less maintenance (no regex updates needed)
- ✅ Language-agnostic (works for any language)

---

### Phase 4: Search Categories (LOW PRIORITY)

**Objective:** Use search categories to improve result quality.

#### 4.1 Add Category Filtering

**File:** `src/lib/search/unified-search-core.ts`

**Changes:**
```typescript
// Add categories parameter
export interface UnifiedSearchParams {
  // ... existing params ...
  categories?: string[];  // e.g., ["research", "github"]
}

// Use in search body
const body: any = {
  query: firecrawlQuery,
  limit: params.limit || 20,
  sources: ['web'],
  ...(params.categories && { categories: params.categories }),
  timeout: 45000
};
```

**Usage:**
```typescript
// For event searches, use research category
const result = await unifiedSearch({
  q: query,
  categories: ['research'],  // Focus on research/event sites
  // ...
});
```

**Benefits:**
- ✅ Better targeting
- ✅ Reduced noise
- ✅ Higher quality results

---

### Phase 5: Batch Optimization (HIGH PRIORITY)

**Objective:** Maximize batch operations for efficiency.

#### 5.1 Increase Batch Sizes

**File:** `src/app/api/events/extract/route.ts`

**Current:**
```typescript
if (targets.length >= 3) {
  // Use batch extraction
}
```

**Enhanced:**
```typescript
// Firecrawl v2 supports larger batches
const BATCH_SIZE = 10;  // Increase from 3 to 10

if (targets.length >= BATCH_SIZE) {
  // Process in batches of 10
  const batches = chunkArray(targets, BATCH_SIZE);
  for (const batch of batches) {
    const results = await extractBatch(batch, key, locale, trace, origin, crawl);
    out.push(...results);
  }
} else {
  // Use individual extraction for small batches
}
```

**Benefits:**
- ✅ Fewer API calls
- ✅ Better efficiency
- ✅ Lower latency

---

## Implementation Priority

### Phase 1: Unified Search + Scrape (Week 1)
**Impact:** High - Reduces API calls by 50%, improves latency  
**Effort:** Medium - Requires interface changes and response parsing updates

### Phase 2: Enhanced Extraction Features (Week 2)
**Impact:** Medium - Richer data, better extraction  
**Effort:** Low - Add new options to existing calls

### Phase 3: Natural Language Crawling (Week 2-3)
**Impact:** Medium - Better coverage, less maintenance  
**Effort:** Low - Replace regex with prompts

### Phase 4: Search Categories (Week 3)
**Impact:** Low - Better targeting  
**Effort:** Low - Add parameter

### Phase 5: Batch Optimization (Week 1)
**Impact:** High - Better efficiency  
**Effort:** Low - Increase batch sizes

---

## Expected Benefits

### Performance Improvements
- **50% reduction in API calls**: Unified search+scrape
- **30% lower latency**: Single operation vs. two
- **40% better efficiency**: Larger batch sizes

### Data Quality Improvements
- **Richer data**: Images, data attributes, PDF metadata
- **Better extraction**: Natural language crawling
- **Higher relevance**: Search categories

### Cost Efficiency
- **Lower costs**: Fewer API calls, batch operations
- **Better ROI**: More data per API call
- **Scalability**: Can handle more events with same budget

---

## Migration Strategy

### Step 1: Feature Flags
```typescript
const FEATURES = {
  FIRECRAWL_UNIFIED_SEARCH_EXTRACT: process.env.ENABLE_UNIFIED_SEARCH_EXTRACT === 'true',
  FIRECRAWL_ENHANCED_EXTRACTION: process.env.ENABLE_ENHANCED_EXTRACTION === 'true',
  FIRECRAWL_NATURAL_CRAWL: process.env.ENABLE_NATURAL_CRAWL === 'true',
};
```

### Step 2: Gradual Rollout
1. **Week 1**: Enable unified search+extract for 10% of searches
2. **Week 2**: Increase to 50%, add enhanced extraction features
3. **Week 3**: Increase to 100%, add natural language crawling
4. **Week 4**: Add search categories, optimize batches

### Step 3: Monitoring
- Track API call counts
- Monitor latency improvements
- Measure extraction quality
- Compare costs before/after

---

## Testing Strategy

### Unit Tests
- Test unified search+extract response parsing
- Test batch extraction with larger batches
- Test natural language crawl prompts
- Test search categories

### Integration Tests
- Test full pipeline with unified search+extract
- Test extraction quality with new features
- Test batch operations
- Test error handling

### Performance Tests
- Compare API call counts (before/after)
- Compare latency (before/after)
- Compare extraction quality (before/after)
- Compare costs (before/after)

---

## Risk Assessment

### Low Risk
- Enhanced extraction features (additive, no breaking changes)
- Search categories (optional parameter)
- Batch size increases (backward compatible)

### Medium Risk
- Unified search+extract (requires response parsing changes)
- Natural language crawling (may change crawl behavior)

### Mitigation
- Feature flags for gradual rollout
- Comprehensive testing
- Monitoring and rollback capability
- Backward compatibility maintained

---

## Success Metrics

### Performance Metrics
- ✅ API calls reduced by 50%
- ✅ Latency reduced by 30%
- ✅ Batch efficiency improved by 40%

### Quality Metrics
- ✅ Extraction completeness improved by 20%
- ✅ Image extraction success rate >80%
- ✅ PDF parsing accuracy >90%

### Cost Metrics
- ✅ Cost per event reduced by 30%
- ✅ API usage efficiency improved by 50%

---

## Files to Modify

### Core Changes
1. `src/lib/search/unified-search-core.ts` - Unified search+extract
2. `src/lib/event-pipeline/discover.ts` - Use unified search+extract
3. `src/app/api/events/extract/route.ts` - Enhanced extraction features
4. `src/lib/services/firecrawl-search-service.ts` - Search categories

### New Files
1. `src/lib/firecrawl/unified-extract.ts` - Unified extraction utilities
2. `src/lib/firecrawl/image-processor.ts` - Image processing utilities
3. `src/lib/firecrawl/data-attribute-extractor.ts` - Data attribute extraction

### Configuration
1. `src/config/firecrawl.ts` - Firecrawl v2 configuration
2. `src/config/features.ts` - Feature flags

---

## Next Steps

1. **Review this plan** with team
2. **Set up feature flags** in environment variables
3. **Begin Phase 1 implementation** (unified search+extract)
4. **Set up monitoring** for API usage and performance
5. **Plan A/B testing** strategy

---

## Appendix: Firecrawl v2 API Reference

### Search Endpoint
```
POST https://api.firecrawl.dev/v2/search
{
  "query": "search query",
  "limit": 20,
  "sources": ["web"],
  "categories": ["research"],  // Optional
  "scrapeOptions": {
    "formats": ["markdown", "html", "images"],
    "onlyMainContent": true,
    "extract": {
      "schema": {...},
      "prompt": "..."
    }
  }
}
```

### Extract Endpoint
```
POST https://api.firecrawl.dev/v2/extract
{
  "urls": ["url1", "url2", ...],
  "schema": {...},
  "prompt": "...",
  "scrapeOptions": {
    "formats": ["markdown", "html", "images"],
    "extractDataAttributes": true,
    "parsers": ["pdf"],
    "pdfOptions": {
      "extractTitle": true,
      "extractMetadata": true
    }
  }
}
```

### Crawl Endpoint
```
POST https://api.firecrawl.dev/v2/crawl
{
  "url": "https://event-site.com",
  "crawlOptions": {
    "prompt": "Find all event pages...",
    "maxPages": 20
  },
  "scrapeOptions": {...}
}
```

