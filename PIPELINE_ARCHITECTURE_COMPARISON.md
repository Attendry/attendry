# Pipeline Architecture Comparison

## Executive Summary

The Attendry codebase contains **6 different search/event pipeline implementations** with varying levels of activity, sophistication, and purpose. This document provides a comprehensive comparison to help make informed decisions about consolidation and cleanup.

## Summary Table

| Pipeline | Status | Lines of Code | Stages | AI Usage | Provider Support | Used By |
|----------|--------|---------------|--------|----------|------------------|---------|
| **New Event Pipeline** | Inactive (feature-flagged) | ~2000+ | 5 stages | Heavy (2 stages) | CSE, Firecrawl, Curated | `/api/events/run` (when `ENABLE_NEW_PIPELINE=true`) |
| **Enhanced Orchestrator** | **Active (Primary)** | ~2800 | 3 stages | Moderate (2 stages) | Firecrawl, CSE, Database | `/api/events/run` (default), `/api/events/search-enhanced` |
| **Legacy Search** | Legacy | ~969 | 2 stages | Light (optional) | CSE only | `/api/events/search` |
| **Basic Orchestrator** | Active (utility) | ~102 | 1 stage | None | Firecrawl, CSE, Database | Internal helper |
| **Search Orchestrator** | Active (utility) | ~131 | 2 stages | None | Firecrawl, CSE | Internal search utility |
| **Debug Orchestrator** | Debug only | ~235 | 4 stages | Heavy | CSE | Debug endpoints only |

**Total Lines of Code:** ~6,237 lines across 6 implementations

---

## Detailed Comparison

### 1. New Event Pipeline (Feature-Flagged, Inactive)

**Location:** `src/lib/event-pipeline/`  
**Files:** `orchestrator.ts`, `discover.ts`, `prioritize.ts`, `parse.ts`, `extract.ts`, `publish.ts`, `fallback.ts`, `types.ts`, `config.ts`, `location.ts`

#### Architecture
**5-Stage Pipeline** with highly modular, class-based architecture:

1. **Discovery** (`discover.ts`): Multi-source URL discovery
   - Parallel execution of multiple providers
   - Deduplication at source level
   - Candidate creation with metadata

2. **Prioritization** (`prioritize.ts`): LLM-based content scoring
   - **Content-based prioritization**: Scrapes content BEFORE scoring
   - Gemini 1.5 Flash for relevance scoring
   - Country-specific bias injection
   - Threshold filtering (default: 0.4)

3. **Parsing** (`parse.ts`): Deterministic HTML parsing
   - Heuristic-based event detection
   - Date extraction with German patterns
   - Location/venue extraction
   - No AI required

4. **Extraction** (`extract.ts`): LLM enhancement
   - Gemini 1.5 Flash for data enrichment
   - Related URL discovery and processing
   - Schema validation
   - Confidence calculation

5. **Publishing** (`publish.ts`): Quality control & formatting
   - Spam filtering
   - Quality gates (confidence > 0.2)
   - Final event formatting
   - Metadata attachment

#### Key Features
- ✅ **Early Termination**: Stops when 8 high-quality events found (confidence > 0.8)
- ✅ **Content-Based Prioritization**: Scrapes content before prioritization for better scoring
- ✅ **Parallel Processing**: Discovery sources run in parallel
- ✅ **Comprehensive Metrics**: Detailed pipeline metrics at each stage
- ✅ **Multiple Quality Gates**: Thresholds at each stage
- ✅ **Related URL Discovery**: Finds and processes related pages
- ✅ **Curated Sources**: Support for curated seed lists (venues, event platforms)
- ✅ **Graceful Fallback**: Falls back to enhanced orchestrator on failure

#### Configuration
```typescript
{
  thresholds: {
    prioritization: 0.4,    // Lower threshold for testing
    confidence: 0.2,        // Lower threshold for testing
    parseQuality: 0.1       // Lower threshold for testing
  },
  sources: {
    cse: true,              // Google Custom Search
    firecrawl: true,        // Firecrawl for content
    curated: false          // Curated seeds (disabled)
  },
  limits: {
    maxCandidates: 50,      // Max URLs to discover
    maxExtractions: 10      // Max events to extract
  },
  timeouts: {
    discovery: 28000,       // 28s discovery timeout
    prioritization: 12000,  // 12s per batch
    parsing: 8000           // 8s per URL
  }
}
```

#### AI Usage
- **Prioritization**: Gemini 1.5 Flash with content-based scoring
- **Extraction**: Gemini 1.5 Flash for event enhancement
- **Total AI Calls**: 2 per candidate (prioritization + extraction)

#### Providers
- **CSE**: Google Custom Search Engine
- **Firecrawl**: Primary content source
- **Curated**: Optional seed lists (currently disabled)

#### Status
- ✅ **Complete Implementation**: All stages implemented and tested
- ✅ **Production Ready**: Has fallback mechanisms and error handling
- ❌ **Currently Disabled**: `ENABLE_NEW_PIPELINE` environment variable controls activation
- 📊 **Test Coverage**: Has dedicated test endpoints (`/api/debug/test-new-pipeline`, etc.)

#### Strengths
1. **Modular Design**: Each stage is a separate class, easy to test and maintain
2. **Performance Optimized**: Early termination and parallel processing
3. **Quality Focused**: Multiple quality gates ensure high-quality results
4. **Comprehensive**: Handles edge cases and has extensive error handling
5. **Observable**: Rich metrics and logging at each stage

#### Weaknesses
1. **Complexity**: More complex than other implementations
2. **Unused**: Currently dormant, ~2000+ lines of inactive code
3. **Maintenance Burden**: Needs to be kept in sync with active pipeline
4. **Uncertain Future**: No clear rollout plan documented

---

### 2. Enhanced Orchestrator (Active, Primary Production)

**Location:** `src/common/search/enhanced-orchestrator.ts`  
**Size:** ~2,800 lines (monolithic)

#### Architecture
**3-Stage Pipeline** with monolithic function-based approach:

1. **Search**: Provider fallback chain
   - Firecrawl (primary)
   - CSE (fallback)
   - Database (final fallback with hardcoded URLs)

2. **Prioritization**: Gemini-based URL prioritization
   - Gemini 1.5 Flash for URL scoring
   - Heuristic fallback when AI unavailable
   - Country gate verification

3. **Extraction**: Firecrawl batch extraction
   - Batch processing for efficiency
   - Speaker detection and normalization
   - Session/agenda parsing
   - Related page discovery

#### Key Features
- ✅ **Timeframe Processing**: Sophisticated date range handling (next_7, next_14, next_30, past_7, past_14, past_30)
- ✅ **Location Context**: Multi-country support with EU aggregation
- ✅ **Query Building**: Event-focused query construction with location/time tokens
- ✅ **Speaker Extraction**: Dedicated speaker detection from multiple page structures
- ✅ **Session Parsing**: Extracts event sessions and agenda items
- ✅ **Country Gate**: LLM-based country verification for results
- ✅ **Heuristic Scoring**: Fallback scoring when LLM unavailable
- ✅ **Cache Integration**: Database and memory caching
- ✅ **Cheerio Parsing**: HTML parsing for speaker/session extraction

#### AI Usage
- **URL Prioritization**: Gemini 1.5 Flash (optional, with heuristic fallback)
- **Country Verification**: Gemini 1.5 Flash (optional)
- **Speaker Enhancement**: Available via separate endpoint
- **Total AI Calls**: 1-2 per search (prioritization + optional country gate)

#### Providers
- **Firecrawl**: Primary provider with content scraping
- **CSE**: Fallback when Firecrawl returns 0 results
- **Database**: Final fallback with hardcoded legal event URLs

#### Status
- ✅ **Primary Production Pipeline**: Used by default in `/api/events/run`
- ✅ **Battle Tested**: Actively handling production traffic
- ✅ **Feature Complete**: Handles all current requirements
- ⚠️ **Monolithic**: 2,800 lines in single file

#### Strengths
1. **Production Proven**: Actively used and tested in production
2. **Feature Rich**: Comprehensive timeframe, location, and speaker handling
3. **Robust Fallbacks**: Multiple fallback strategies ensure results
4. **Cache Optimized**: Extensive caching for performance
5. **Speaker Detection**: Advanced speaker extraction capabilities

#### Weaknesses
1. **Monolithic**: 2,800 lines in single file, hard to maintain
2. **Mixed Concerns**: Search, extraction, parsing all in one file
3. **Testing Difficulty**: Hard to unit test individual stages
4. **Code Duplication**: Some logic duplicated from other orchestrators
5. **Performance**: No early termination or parallel processing

---

### 3. Legacy Search Pipeline (Legacy)

**Location:** `src/app/api/events/search/route.ts`  
**Size:** ~969 lines

#### Architecture
**2-Stage Pipeline** with traditional API endpoint structure:

1. **Search**: Google CSE with enhanced query building
   - Enhanced query construction
   - Industry terms integration
   - User text combination

2. **Filtering**: AI-powered event detection (optional)
   - Gemini-based event filtering
   - Regex fallback when AI unavailable
   - Date range filtering

#### Key Features
- ✅ **CSE-Only**: Relies exclusively on Google Custom Search Engine
- ✅ **Enhanced Query Building**: Combines base query, industry terms, user text
- ✅ **AI Filtering**: Optional Gemini-based event detection
- ✅ **Regex Fallback**: Heuristic filtering when AI unavailable
- ✅ **Date Filtering**: Post-search date range filtering
- ✅ **Cache Support**: Memory and database caching
- ✅ **Demo Mode**: Returns sample data when API keys missing
- ✅ **Correlation Tracking**: Request correlation IDs

#### AI Usage
- **Event Filtering**: Gemini 1.5 Flash (optional, controlled by `aiRankingEnabled` flag)
- **Currently Disabled**: `aiRankingEnabled: false` in config
- **Total AI Calls**: 0-1 per search (filtering only if enabled)

#### Providers
- **CSE**: Google Custom Search Engine only
- **No Firecrawl**: Does not use Firecrawl

#### Status
- ⚠️ **Marked as Legacy**: README documents this as "Legacy Pipeline"
- ✅ **Still Active**: Route handler still exists and functional
- ❓ **Usage Unknown**: Unclear if external consumers exist
- 📝 **Well Documented**: Extensive inline documentation

#### Strengths
1. **Simple**: Straightforward implementation, easy to understand
2. **Well Documented**: Extensive comments and documentation
3. **Proven**: Likely the original implementation
4. **CSE Focused**: Good for CSE-specific use cases

#### Weaknesses
1. **Limited Providers**: CSE only, no Firecrawl
2. **Legacy Status**: Marked for deprecation
3. **Duplicate Code**: Overlaps with enhanced orchestrator
4. **Maintenance Burden**: Another pipeline to maintain
5. **Uncertain Usage**: Unknown if still needed

---

### 4. Basic Orchestrator (Active Utility)

**Location:** `src/common/search/orchestrator.ts`  
**Size:** ~102 lines

#### Architecture
**1-Stage Pipeline** with simple provider fallback:

1. **Search**: Sequential provider fallback
   - Firecrawl (primary)
   - CSE (fallback)
   - Database (final fallback)

#### Key Features
- ✅ **Provider Fallback**: Tries providers in sequence until results found
- ✅ **Query Building**: Loads config and builds query once
- ✅ **Deduplication**: Simple URL deduplication
- ✅ **Correlation Tracking**: Request correlation IDs
- ✅ **Stage Counters**: Observability metrics
- ✅ **Minimal**: Focused on search only, no extraction

#### AI Usage
- **None**: No AI integration

#### Providers
- **Firecrawl**: Primary
- **CSE**: Fallback
- **Database**: Final fallback

#### Status
- ✅ **Active Utility**: Used by enhanced orchestrator
- ✅ **Focused Purpose**: Does one thing well
- ✅ **Lightweight**: Only 102 lines

#### Strengths
1. **Simple**: Easy to understand and maintain
2. **Focused**: Does one thing (search) well
3. **Reusable**: Can be used by multiple consumers
4. **Observable**: Good metrics integration

#### Weaknesses
1. **Limited Scope**: Search only, no extraction
2. **Duplicate Logic**: Similar to search orchestrator
3. **Could Be Consolidated**: Overlaps with other utilities

---

### 5. Search Orchestrator (Active Utility)

**Location:** `src/search/orchestrator.ts`  
**Size:** ~131 lines

#### Architecture
**2-Stage Pipeline** with tier-based search:

1. **Tier Search**: Multi-tier query execution
   - Builds multiple query tiers
   - Concurrent execution with limits
   - Pagination support

2. **Filtering**: URL prefiltering
   - Blocks unwanted domains
   - Deduplication

#### Key Features
- ✅ **Tier Queries**: Builds multiple query tiers for better coverage
- ✅ **Concurrency Control**: Limits parallel Firecrawl requests (default: 25)
- ✅ **Pagination**: Multi-page Firecrawl results (up to 2 pages)
- ✅ **Country-Specific Sharding**: German-specific search sharding with `.de` constraint
- ✅ **Retry Logic**: Falls back to base query if insufficient results
- ✅ **URL Prefiltering**: Blocks unwanted domains
- ✅ **Configurable**: Environment variables for tuning

#### AI Usage
- **None**: No AI integration

#### Providers
- **Firecrawl**: Primary (with pagination)
- **CSE**: Fallback per tier

#### Status
- ✅ **Active Utility**: Used for search operations
- ✅ **Performance Focused**: Concurrency and pagination
- ✅ **Country-Aware**: Special handling for German searches

#### Strengths
1. **Performance**: Concurrency control and pagination
2. **Coverage**: Multi-tier queries for better results
3. **Country-Specific**: Optimized for German searches
4. **Configurable**: Environment-based tuning

#### Weaknesses
1. **Duplicate Logic**: Similar to basic orchestrator
2. **Could Be Consolidated**: Overlaps with other utilities
3. **Limited Scope**: Search only

---

### 6. Debug Search Orchestrator (Debug Only)

**Location:** `src/lib/search/search-orchestrator.ts`  
**Size:** ~235 lines

#### Architecture
**4-Stage Pipeline** with extensive fallbacks:

1. **Search**: Multi-tier search with query optimization
   - Query optimization with TLD preference
   - Tier-based execution
   - Fallback query generation

2. **Prioritization**: Gemini with bypass on failure
   - AI prioritization with fallback
   - Bypass mechanism for failures

3. **Extraction**: Batch extraction with timeout handling
   - Timeout handling
   - Batch processing
   - Fallback on failures

4. **Filtering**: Relaxed filtering with feature flags
   - Feature-flag controlled filtering
   - Relaxed date/country filters
   - Issue tracking

#### Key Features
- ✅ **Query Optimization**: TLD preference, query splitting
- ✅ **Fallback Queries**: Automatic fallback query generation
- ✅ **Bypass Mechanisms**: AI bypass when Gemini fails
- ✅ **Relaxed Filters**: Feature-flag controlled filtering (FLAGS.RELAX_COUNTRY, FLAGS.RELAX_DATE)
- ✅ **Search Trace**: Comprehensive trace logging
- ✅ **Telemetry**: Detailed telemetry data collection
- ✅ **Issue Tracking**: Collects and reports issues
- ✅ **Debug Focused**: Designed for debugging zero-result scenarios

#### AI Usage
- **Prioritization**: Gemini with bypass fallback
- **Total AI Calls**: 0-1 per search (bypassed on failure)

#### Providers
- **CSE**: Via tier guardrails

#### Status
- ⚠️ **Debug Only**: Used by debug endpoints only
- ✅ **Feature Flag Integration**: Uses FLAGS from config
- ❓ **Production Use**: Should not be used in production

#### Strengths
1. **Debug Focused**: Designed for troubleshooting
2. **Comprehensive Logging**: Extensive trace and telemetry
3. **Fallback Heavy**: Multiple fallback strategies
4. **Issue Tracking**: Collects problems for analysis

#### Weaknesses
1. **Debug Only**: Not suitable for production
2. **Duplicate Logic**: Overlaps with other orchestrators
3. **Maintenance Burden**: Another implementation to maintain
4. **Feature Flag Dependency**: Relies on FLAGS config

---

## Key Architectural Differences

### Modularity
- **New Pipeline**: ⭐⭐⭐⭐⭐ Highly modular with separate classes for each stage
- **Enhanced Orchestrator**: ⭐ Monolithic with all logic in one file
- **Legacy Search**: ⭐⭐ Traditional API endpoint structure
- **Utilities**: ⭐⭐⭐ Focused functions with clear responsibilities

### AI Integration
- **New Pipeline**: Heavy (2 AI stages: prioritize, extract)
- **Enhanced Orchestrator**: Moderate (2 AI stages: prioritize, country gate)
- **Legacy Search**: Light (1 optional AI stage: filter)
- **Utilities**: None

### Provider Strategy
- **New Pipeline**: Parallel multi-source discovery
- **Enhanced Orchestrator**: Sequential fallback chain
- **Search Orchestrator**: Tier-based with concurrency
- **Others**: Simple fallback chains

### Quality Control
- **New Pipeline**: ⭐⭐⭐⭐⭐ Multiple quality gates with thresholds at each stage
- **Enhanced Orchestrator**: ⭐⭐⭐ Heuristic scoring + AI scoring
- **Legacy Search**: ⭐⭐ AI filtering or regex fallback
- **Utilities**: ⭐ Minimal quality control

### Performance Optimization
- **New Pipeline**: ⭐⭐⭐⭐⭐ Early termination, parallel discovery, content-based prioritization
- **Enhanced Orchestrator**: ⭐⭐⭐ Caching, batch processing
- **Search Orchestrator**: ⭐⭐⭐⭐ Concurrency control, pagination
- **Others**: ⭐⭐ Basic caching

### Code Maintainability
- **New Pipeline**: ⭐⭐⭐⭐⭐ Highly maintainable, modular, well-documented
- **Enhanced Orchestrator**: ⭐⭐ Hard to maintain, monolithic
- **Legacy Search**: ⭐⭐⭐ Well-documented but legacy
- **Utilities**: ⭐⭐⭐⭐ Simple and focused

---

## Consolidation Opportunities

### High Priority

#### 1. Decide on New Pipeline
**Options:**
- **A) Enable It**: Set `ENABLE_NEW_PIPELINE=true` and monitor
- **B) Remove It**: Delete ~2000+ lines of dormant code
- **C) Merge Best Features**: Extract best features into enhanced orchestrator

**Recommendation:** If no rollout plan exists, remove it to reduce maintenance burden.

#### 2. Deprecate Legacy Search
**Options:**
- **A) Remove Entirely**: Delete `/api/events/search` (969 lines)
- **B) Keep for External Consumers**: If API consumers exist, keep but mark deprecated
- **C) Redirect to Enhanced**: Redirect to enhanced orchestrator

**Recommendation:** Check for external consumers, then remove or redirect.

### Medium Priority

#### 3. Consolidate Utilities
**Current State:**
- Basic Orchestrator (102 lines)
- Search Orchestrator (131 lines)
- Debug Orchestrator (235 lines)

**Options:**
- **A) Merge into Single Utility**: Create unified search utility
- **B) Keep Separate**: Document clear responsibilities
- **C) Extract Common Logic**: Create shared base class

**Recommendation:** Merge basic and search orchestrators into single utility.

### Low Priority

#### 4. Refactor Enhanced Orchestrator
**Current State:** 2,800 lines in single file

**Options:**
- **A) Break into Modules**: Extract stages into separate files
- **B) Adopt New Pipeline Architecture**: Migrate to class-based stages
- **C) Leave As-Is**: If working well, don't fix

**Recommendation:** Break into modules for better maintainability.

---

## Decision Matrix

| Action | Impact | Effort | Risk | Priority |
|--------|--------|--------|------|----------|
| **Remove New Pipeline** | -2000 LOC | Low | Low | High |
| **Remove Legacy Search** | -969 LOC | Low | Medium | High |
| **Consolidate Utilities** | -200 LOC | Medium | Low | Medium |
| **Refactor Enhanced** | Better maintainability | High | Medium | Low |
| **Enable New Pipeline** | Better quality | Low | High | Medium |

---

## Recommendations

### Immediate Actions (This Week)

1. **Decide on New Pipeline**
   - If no rollout plan: Remove it
   - If planned: Document rollout timeline
   - If uncertain: Set deadline for decision

2. **Check Legacy Search Usage**
   - Search codebase for imports
   - Check API logs for usage
   - Contact stakeholders about external consumers

3. **Document Current State**
   - Update README with accurate pipeline descriptions
   - Document which pipelines are active
   - Add deprecation notices where appropriate

### Short Term (This Month)

4. **Remove Dormant Code**
   - Remove new pipeline if not needed
   - Remove legacy search if unused
   - Remove debug orchestrator from production

5. **Consolidate Utilities**
   - Merge basic and search orchestrators
   - Extract common provider logic
   - Standardize provider interface

### Long Term (This Quarter)

6. **Refactor Enhanced Orchestrator**
   - Break 2,800-line file into modules
   - Extract stages into separate files
   - Improve testability

7. **Standardize Architecture**
   - Choose one architectural pattern
   - Apply consistently across codebase
   - Document architectural decisions

---

## Questions for Stakeholders

1. **New Event Pipeline**
   - Is there a rollout plan?
   - What were the goals of this implementation?
   - Should we enable it, remove it, or merge features?

2. **Legacy Search Endpoint**
   - Are there external API consumers?
   - Can we deprecate and remove?
   - What's the migration path?

3. **Performance Requirements**
   - Are current response times acceptable?
   - Do we need early termination?
   - Is parallel processing needed?

4. **Quality Requirements**
   - Are current result quality acceptable?
   - Do we need more quality gates?
   - Is content-based prioritization needed?

5. **Maintenance Budget**
   - How much time can we spend on refactoring?
   - What's the priority vs. new features?
   - Can we afford technical debt?

---

## Conclusion

The codebase has **6 pipeline implementations totaling ~6,237 lines of code** with significant overlap and duplication. The primary opportunity is to remove the **New Event Pipeline** (~2000 lines) and **Legacy Search** (~969 lines) if they're not needed, which would eliminate **~3,000 lines of code** (~48% reduction).

The **Enhanced Orchestrator** is the clear production winner but needs refactoring for better maintainability. The utilities should be consolidated into a single, well-documented implementation.

**Recommended Path Forward:**
1. Remove New Pipeline (if no rollout plan)
2. Remove Legacy Search (if no external consumers)
3. Consolidate utilities
4. Refactor Enhanced Orchestrator (long-term)

This would reduce the codebase by ~50% while improving maintainability and reducing technical debt.

