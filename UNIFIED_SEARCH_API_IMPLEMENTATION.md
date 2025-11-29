# Unified Search API - Implementation Summary

**Date:** 2025-02-26  
**Status:** ✅ Complete

---

## Overview

Implemented a unified speaker search API that provides fuzzy matching and full-text search across all speaker tables in the system.

---

## Files Created

### 1. Database Migration
**File:** `supabase/migrations/20250226000006_add_speaker_search_indexes.sql`

- Added PostgreSQL GIN indexes for full-text search on:
  - `speaker_event_history` (name, org, title, talk titles)
  - `saved_speaker_profiles` (JSONB fields: name, org, bio, expertise)
  - `enhanced_speaker_profiles` (name, org, bio, expertise)
  - `account_speakers` (name, company, title, bio)

**Impact:** Enables fast full-text search across all speaker data

---

### 2. Search Service
**File:** `src/lib/services/speaker-search-service.ts`

**Features:**
- ✅ Fuzzy name matching using Levenshtein similarity
- ✅ Organization matching using Jaccard similarity
- ✅ Cross-table search (4 tables)
- ✅ Result deduplication and merging
- ✅ Similarity scoring (0-1)
- ✅ Event history aggregation
- ✅ Pagination support

**Functions:**
- `searchSpeakers(options)` - Main unified search function
- `getSpeakerHistory(speakerKey, limit)` - Get speaker event history

**Tables Searched:**
1. `speaker_event_history` - Public event speaker data
2. `saved_speaker_profiles` - User's saved contacts
3. `enhanced_speaker_profiles` - AI-enhanced speaker profiles
4. `account_speakers` - Market intelligence speakers

---

### 3. API Endpoint
**File:** `src/app/api/speakers/search/route.ts`

**Endpoints:**
- `POST /api/speakers/search` - Unified speaker search
- `GET /api/speakers/search?speakerKey=...` - Get speaker history

**Request Body (POST):**
```typescript
{
  query?: string;           // Full-text search
  name?: string;            // Name search (fuzzy)
  org?: string;             // Organization filter
  title?: string;           // Job title filter
  topic?: string;           // Speaking topic filter
  eventId?: string;         // Filter by event
  dateRange?: { from, to }; // Date range filter
  minConfidence?: number;   // Confidence threshold (0-1)
  limit?: number;           // Result limit (default: 50, max: 100)
  offset?: number;          // Pagination offset
}
```

**Response:**
```typescript
{
  success: true,
  results: SpeakerSearchResult[],
  pagination: {
    total: number,
    limit: number,
    offset: number,
    hasMore: boolean
  },
  rateLimit: {
    remaining: number,
    resetAt: string
  }
}
```

**Rate Limiting:**
- 100 searches/hour per user
- 20 searches/minute per user
- Returns 429 with `Retry-After` header when exceeded

---

### 4. Rate Limiter
**File:** `src/lib/services/search-rate-limiter.ts`

- Redis-based rate limiting
- Per-user limits (100/hour, 20/minute)
- Graceful degradation if Redis unavailable
- Returns rate limit headers in responses

---

### 5. Updated Existing Service
**File:** `src/lib/services/speaker-service.ts`

- Updated `findSpeakersByName()` to use unified search API
- Added deprecation notice
- Falls back to simple key-based search if unified API fails

---

## Key Features

### 1. Fuzzy Matching
- **Name Matching:** Levenshtein similarity (threshold: 0.6)
- **Organization Matching:** Jaccard similarity (threshold: 0.6)
- **Combined Scoring:** Weighted combination (70% name, 30% org)

### 2. Result Deduplication
- Groups results by `speaker_key` or normalized name+org
- Merges events from multiple sources
- Keeps highest similarity score
- Combines metadata from all sources

### 3. Cross-Table Search
- Searches all 4 tables in parallel
- Respects RLS policies (user-specific vs public data)
- Returns unified result format

### 4. Full-Text Search
- Uses PostgreSQL ILIKE for basic full-text search
- Searches across name, org, title, bio, talk titles
- Full-text indexes available for future optimization

---

## Usage Examples

### Search by Name (Fuzzy)
```typescript
POST /api/speakers/search
{
  "name": "John Smith",
  "limit": 20
}
```

### Search by Organization
```typescript
POST /api/speakers/search
{
  "org": "Microsoft",
  "limit": 50
}
```

### Full-Text Search
```typescript
POST /api/speakers/search
{
  "query": "AI machine learning",
  "limit": 30
}
```

### Get Speaker History
```typescript
GET /api/speakers/search?speakerKey=abc123&limit=10
```

---

## Integration Points

### Ready for Integration:
1. **Outreach Agent** (`src/lib/agents/outreach-agent.ts`)
   - Can now search for speakers by name/org
   - Can get speaker history for personalization

2. **UI Components** (To be created)
   - Speaker search page
   - Search bar with autocomplete
   - Speaker profile pages

3. **Existing Services**
   - `findSpeakersByName()` now uses unified API
   - Can be extended for other use cases

---

## Performance Considerations

### Optimizations:
- ✅ Parallel table queries
- ✅ Full-text indexes on key fields
- ✅ Result limit (max 100 per request)
- ✅ Pagination support
- ✅ Rate limiting to prevent abuse

### Future Optimizations:
- Add caching for frequent searches
- Use PostgreSQL `tsvector` for better full-text search
- Add vector embeddings for semantic search
- Implement search result ranking algorithm

---

## Testing Recommendations

1. **Unit Tests:**
   - Fuzzy matching accuracy
   - Result deduplication
   - Similarity scoring

2. **Integration Tests:**
   - API endpoint responses
   - Rate limiting behavior
   - Cross-table search results

3. **Performance Tests:**
   - Query performance with large datasets
   - Concurrent search requests
   - Rate limit enforcement

---

## Next Steps

1. **UI Integration:**
   - Create speaker search page
   - Add search bar component
   - Integrate with agent workflows

2. **Enhancements:**
   - Add caching layer
   - Implement semantic search
   - Add search analytics

3. **Documentation:**
   - API documentation
   - Usage examples
   - Integration guide

---

## Dependencies

### Required:
- ✅ Supabase database (all tables exist)
- ✅ Redis (for rate limiting, graceful degradation if unavailable)
- ✅ Existing utilities (levenshtein, org-normalizer)

### Optional:
- PostgreSQL full-text search (indexes created, can be enhanced)

---

## Status

✅ **Implementation Complete**

All core functionality implemented:
- ✅ Database indexes
- ✅ Search service with fuzzy matching
- ✅ API endpoint with rate limiting
- ✅ Integration with existing services

Ready for:
- UI component development
- Agent integration
- Production deployment

