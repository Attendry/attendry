# Unified Search API - Dependency Analysis Report

**Date:** 2025-02-26  
**Feature:** Unified Speaker Search API  
**Status:** Analysis Complete

---

## Executive Summary

The Unified Search API will provide a single endpoint (`/api/speakers/search`) for searching speakers across all tables with fuzzy matching capabilities. This analysis identifies all dependencies, existing implementations that can be reused, and potential conflicts.

**Key Findings:**
- ✅ **Fuzzy matching utilities exist** - Can be reused from existing code
- ✅ **Database tables are ready** - All required tables exist with proper indexes
- ⚠️ **No existing unified search** - Current search is fragmented
- ⚠️ **Limited full-text search** - PostgreSQL full-text indexes needed
- ✅ **Normalization utilities available** - Can reuse existing functions

---

## 1. Database Dependencies

### 1.1 Tables to Search

#### ✅ `speaker_event_history` (Migration: 20250221000004)
**Schema:**
- `id` (UUID, PK)
- `speaker_key` (TEXT) - Canonical key: hash(normalizedName + normalizedOrg)
- `speaker_name` (TEXT)
- `speaker_org` (TEXT)
- `speaker_title` (TEXT)
- `event_id` (UUID, FK to collected_events)
- `talk_title` (TEXT)
- `session_name` (TEXT)
- `speech_title` (TEXT)
- `appeared_at` (TIMESTAMPTZ)
- `confidence` (DECIMAL 3,2)

**Indexes:**
- ✅ `idx_speaker_history_key` on `speaker_key`
- ✅ `idx_speaker_history_event` on `event_id`
- ✅ `idx_speaker_history_appeared` on `appeared_at DESC`
- ✅ `idx_speaker_history_name_org` on `(speaker_name, speaker_org)`
- ✅ `idx_speaker_history_key_appeared` on `(speaker_key, appeared_at DESC)`

**RLS:** Public read access (users can view all speaker history)

**Status:** ✅ Ready - Well-indexed, has all necessary fields

---

#### ✅ `saved_speaker_profiles` (Migration: 20250218000000)
**Schema:**
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users)
- `speaker_data` (JSONB) - Contains: `name`, `org`, `title`, `email`, `linkedin`, `profile_url`, `bio`
- `enhanced_data` (JSONB) - AI-enhanced speaker information
- `notes` (TEXT)
- `tags` (TEXT[])
- `outreach_status` (TEXT)
- `saved_at` (TIMESTAMPTZ)
- `last_updated` (TIMESTAMPTZ)
- `auto_saved_at` (TIMESTAMPTZ) - From auto-save feedback migration
- `auto_save_event_id` (UUID) - From auto-save feedback migration
- `data_source` (TEXT) - From GDPR migration

**Indexes:**
- ✅ `idx_saved_speaker_profiles_user_id` on `user_id`
- ✅ `idx_saved_speaker_profiles_outreach_status` on `outreach_status`
- ✅ `idx_saved_speaker_profiles_saved_at` on `saved_at`
- ✅ `idx_saved_speaker_profiles_tags` (GIN) on `tags`
- ✅ `idx_saved_profiles_auto_saved` on `(user_id, auto_saved_at DESC)` - From auto-save feedback

**RLS:** Users can only view their own contacts

**Status:** ✅ Ready - Has JSONB fields for flexible querying

**Note:** Need to extract `name` and `org` from `speaker_data` JSONB for search

---

#### ✅ `enhanced_speaker_profiles` (Migration: 20250213000000)
**Schema:**
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users)
- `speaker_key` (TEXT) - Canonical key
- `speaker_name` (TEXT)
- `speaker_org` (TEXT)
- `speaker_title` (TEXT)
- `session_title` (TEXT)
- `profile_url` (TEXT)
- `raw_input` (JSONB)
- `enhanced_data` (JSONB) - Contains: bio, expertise, publications, etc.
- `confidence` (NUMERIC 3,2)
- `last_enhanced_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- ✅ `idx_enhanced_speaker_profiles_user_id` on `user_id`
- ✅ `idx_enhanced_speaker_profiles_speaker_key` on `speaker_key`

**RLS:** Users can only view their own enhanced profiles

**Status:** ✅ Ready - Has structured fields and JSONB for rich data

---

#### ✅ `account_speakers` (Migration: 20241215000001)
**Schema:**
- `id` (UUID, PK)
- `account_id` (UUID, FK to accounts)
- `speaker_name` (TEXT)
- `speaker_company` (TEXT)
- `speaker_title` (TEXT)
- `email` (TEXT)
- `linkedin_url` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- ✅ `idx_account_speakers_account_id` on `account_id`
- ✅ `idx_account_speakers_name` on `speaker_name`
- ✅ `idx_account_speakers_company` on `speaker_company`

**RLS:** Users can view speakers for their accounts

**Status:** ✅ Ready - Has name, company, title fields

---

### 1.2 Missing Database Features

#### ⚠️ Full-Text Search Indexes (Not Yet Implemented)
**Required:**
- PostgreSQL `tsvector` indexes on:
  - `speaker_event_history`: `speaker_name`, `speaker_org`, `talk_title`, `session_name`
  - `saved_speaker_profiles`: `speaker_data->>'name'`, `speaker_data->>'org'`, `enhanced_data->>'bio'`
  - `enhanced_speaker_profiles`: `speaker_name`, `speaker_org`, `enhanced_data->>'bio'`
  - `account_speakers`: `speaker_name`, `speaker_company`

**Impact:** Without full-text indexes, searching by bio/expertise will be slow

**Migration Needed:** `YYYYMMDD_add_speaker_search_indexes.sql`

---

## 2. Code Dependencies

### 2.1 Existing Utilities (Can Be Reused)

#### ✅ Levenshtein Similarity (`src/lib/utils/levenshtein.ts`)
**Functions Available:**
- `levenshteinDistance(str1, str2)` - Calculate edit distance
- `levenshteinSimilarity(str1, str2)` - Calculate similarity ratio (0-1)
- `isSimilar(str1, str2, maxDistance)` - Check if similar within threshold
- `isSimilarByRatio(str1, str2, minSimilarity)` - Check similarity by ratio

**Current Usage:**
- Used in `src/lib/event-pipeline/extract.ts` for speaker deduplication
- Used in `src/lib/services/discovery-engine.ts` for company matching
- Used in `src/lib/event-analysis.ts` for fuzzy speaker matching

**Status:** ✅ Ready to reuse - Well-tested, production-ready

---

#### ✅ Organization Normalization (`src/lib/utils/org-normalizer.ts`)
**Functions Available:**
- `normalizeOrg(org)` - Normalize organization name to canonical form
- `orgSimilarity(org1, org2)` - Calculate Jaccard similarity (0-1)
- `areSameOrg(org1, org2)` - Check if same organization
- `findOrgAlias(org)` - Find canonical name from alias
- `getOrgVariations(canonicalName)` - Get all aliases for org

**Features:**
- 100+ common organization aliases (IBM, Microsoft, Google, etc.)
- Handles suffixes (Corp, Inc, LLC, etc.)
- Jaccard similarity for fuzzy matching

**Current Usage:**
- Used in `src/lib/services/discovery-engine.ts` for company matching
- Used in `src/lib/services/speaker-enrichment-cache.ts` for cache keys
- Used in `src/lib/event-pipeline/extract.ts` for org normalization

**Status:** ✅ Ready to reuse - Comprehensive, well-maintained

---

#### ✅ Speaker Key Generation (`src/lib/services/speaker-service.ts`)
**Function:**
- `generateSpeakerKey({ name, org })` - Generate canonical speaker key

**Current Usage:**
- Used throughout codebase for speaker identification
- Used in `speaker-enrichment-cache.ts` for cache keys

**Status:** ✅ Ready to reuse - Standard speaker identification method

---

### 2.2 Existing Search Implementations (To Integrate/Replace)

#### ⚠️ `findSpeakersByName()` in `speaker-service.ts`
**Current Implementation:**
```typescript
export async function findSpeakersByName(name: string, org?: string): Promise<string[]>
```

**Limitations:**
- ❌ Only exact key matching (no fuzzy search)
- ❌ Only searches `speaker_event_history`
- ❌ Returns only `speaker_key` strings (not full data)
- ❌ No similarity scoring

**Status:** ⚠️ Needs replacement - Too limited for unified search

**Action:** Replace with unified search API or enhance to use fuzzy matching

---

#### ⚠️ Basic Search in `saved_speaker_profiles` API
**Location:** `src/app/api/profiles/saved/route.ts:238-240`

**Current Implementation:**
```typescript
query = query.or(`speaker_data->>name.ilike.%${search}%,speaker_data->>org.ilike.%${search}%,enhanced_data->>title.ilike.%${search}%`);
```

**Limitations:**
- ❌ Only searches user's own contacts
- ❌ Only ILIKE matching (no fuzzy)
- ❌ No cross-table search
- ❌ No similarity scoring

**Status:** ⚠️ Can coexist - Different use case (user's contacts only)

**Action:** Keep for contact search, but unified API should be more powerful

---

#### ✅ Company Speaker Search (`src/lib/services/company-speaker-service.ts`)
**Current Implementation:**
- `searchCompanySpeakers(companyName)` - Searches for speakers from a company
- Uses `CompanySearchService.searchCompanySpeakers()`

**Status:** ✅ Can integrate - Different use case (company-focused)

**Action:** Unified API can call this for company-specific searches

---

### 2.3 Services That Would Use Unified Search

#### 🔴 Outreach Agent (`src/lib/agents/outreach-agent.ts`)
**Current State:**
- ❌ No speaker search capability
- ❌ Only uses saved contacts
- ❌ No speaker history lookup

**Would Use For:**
- Finding speakers by name/org for context
- Looking up speaker history for personalization
- Discovering speakers at events

**Priority:** HIGH - Critical for agent capabilities

---

#### 🟡 Discovery Engine (`src/lib/services/discovery-engine.ts`)
**Current State:**
- ✅ Has fuzzy matching for company matching
- ❌ No speaker search API
- Uses inline fuzzy matching logic

**Would Use For:**
- Could potentially use unified API instead of inline logic
- But current implementation is working fine

**Priority:** MEDIUM - Nice to have, not critical

---

#### 🟡 UI Components (Future)
**Components That Would Use:**
- `src/components/speakers/SpeakerSearchBar.tsx` (to be created)
- `src/app/(protected)/speakers/page.tsx` (to be created)
- `src/components/agents/AssignTaskModal.tsx` (enhancement)
- `src/components/contacts/ContactModal.tsx` (enhancement)

**Priority:** HIGH - Required for UI features

---

## 3. Implementation Dependencies

### 3.1 Required New Files

#### ✅ To Create:
1. `src/app/api/speakers/search/route.ts` - Main search endpoint
2. `src/lib/services/speaker-search-service.ts` - Core search logic
3. `supabase/migrations/YYYYMMDD_add_speaker_search_indexes.sql` - Full-text indexes

#### ⚠️ Optional (For Better Performance):
4. `src/lib/services/normalization-service.ts` - Shared normalization utilities (if we want to centralize)

---

### 3.2 Files to Modify

#### 🟡 Enhance Existing:
1. `src/lib/services/speaker-service.ts`
   - Option A: Enhance `findSpeakersByName()` to use unified search
   - Option B: Deprecate and redirect to unified API
   - **Recommendation:** Option B - Keep simple, use unified API

2. `src/lib/agents/outreach-agent.ts`
   - Add speaker search calls for context
   - **Priority:** HIGH

3. `src/components/agents/AssignTaskModal.tsx`
   - Add speaker search for task assignment
   - **Priority:** MEDIUM

---

### 3.3 Database Migrations Needed

#### ⚠️ Full-Text Search Indexes
**Migration:** `YYYYMMDD_add_speaker_search_indexes.sql`

**Required Indexes:**
```sql
-- Full-text search on speaker_event_history
CREATE INDEX idx_speaker_history_name_fts ON speaker_event_history 
  USING gin(to_tsvector('english', speaker_name || ' ' || COALESCE(speaker_org, '') || ' ' || COALESCE(talk_title, '')));

-- Full-text search on saved_speaker_profiles (JSONB)
CREATE INDEX idx_saved_profiles_name_fts ON saved_speaker_profiles 
  USING gin(to_tsvector('english', (speaker_data->>'name') || ' ' || COALESCE(speaker_data->>'org', '') || ' ' || COALESCE(enhanced_data->>'bio', '')));

-- Full-text search on enhanced_speaker_profiles
CREATE INDEX idx_enhanced_profiles_name_fts ON enhanced_speaker_profiles 
  USING gin(to_tsvector('english', speaker_name || ' ' || COALESCE(speaker_org, '') || ' ' || COALESCE(enhanced_data->>'bio', '')));

-- Full-text search on account_speakers
CREATE INDEX idx_account_speakers_name_fts ON account_speakers 
  USING gin(to_tsvector('english', speaker_name || ' ' || COALESCE(speaker_company, '') || ' ' || COALESCE(speaker_title, '')));
```

**Impact:** Improves search performance for bio/expertise queries

---

## 4. Integration Points

### 4.1 Agent Integration

#### Outreach Agent (`src/lib/agents/outreach-agent.ts`)
**Current Gap:**
- No speaker search capability
- No speaker history lookup
- Limited to saved contacts

**Integration Points:**
1. **Line ~425:** `getContact()` - Could enhance with speaker history lookup
2. **New Method:** `searchSpeakers(query)` - Use unified API
3. **New Method:** `getSpeakerHistory(speakerKey)` - Use unified API

**Priority:** HIGH

---

### 4.2 UI Integration

#### Speaker Search Page (`src/app/(protected)/speakers/page.tsx` - To Create)
**Dependencies:**
- Unified Search API endpoint
- Search results component
- Filter components

**Status:** ⚠️ Blocked until API exists

---

#### Contact Modal Enhancement (`src/components/contacts/ContactModal.tsx`)
**Current State:**
- Shows contact details
- Shows agent tasks

**Would Add:**
- Speaker history timeline (from unified search)
- Cross-event appearances

**Dependencies:**
- Unified Search API
- Speaker history aggregation

**Priority:** MEDIUM

---

### 4.3 Caching Integration

#### Speaker Enrichment Cache (`src/lib/services/speaker-enrichment-cache.ts`)
**Current State:**
- Caches enhanced speaker data
- Uses normalized name + org as key

**Integration:**
- Search results could check cache first
- Cache hit = faster response
- Cache miss = search + enhance

**Status:** ✅ Can integrate - Complementary systems

---

## 5. Potential Conflicts

### 5.1 Naming Conflicts

#### ⚠️ `findSpeakersByName()` Function
**Location:** `src/lib/services/speaker-service.ts:280`

**Conflict:**
- Existing function has same name as what unified API would provide
- Different signature and return type

**Resolution:**
- Option A: Rename existing to `findSpeakersByKey()`
- Option B: Deprecate existing, redirect to unified API
- **Recommendation:** Option B - Unified API is more powerful

---

### 5.2 Search Result Format

#### ⚠️ Different Return Types
**Current:**
- `findSpeakersByName()` returns `string[]` (speaker keys)
- Contact search returns full contact objects

**Unified API Should:**
- Return consistent format: `{ speaker, source, similarity, events[] }`
- Include similarity scores
- Include source table information

**Resolution:** Define clear interface for search results

---

## 6. Performance Considerations

### 6.1 Query Performance

#### ⚠️ Cross-Table Queries
**Challenge:**
- Searching 4+ tables simultaneously
- Fuzzy matching requires loading all candidates
- Full-text search on JSONB fields

**Mitigation:**
- Use full-text indexes (migration needed)
- Limit results per table, then merge
- Cache frequent searches
- Use pagination

---

### 6.2 Rate Limiting

#### ✅ Existing Rate Limiter
**Location:** `src/lib/services/auto-save-rate-limiter.ts`

**Consideration:**
- Search API should have its own rate limits
- Different from auto-save limits
- Consider: 100 searches/hour/user

**Status:** ⚠️ Need to add rate limiting for search

---

## 7. Security & Access Control

### 7.1 RLS Policies

#### ✅ Table-Level Security
- `speaker_event_history`: Public read (all users)
- `saved_speaker_profiles`: User-specific (only own contacts)
- `enhanced_speaker_profiles`: User-specific (only own profiles)
- `account_speakers`: Account-based (users see their accounts' speakers)

**Implication:**
- Unified API must respect RLS
- Filter results by user_id where applicable
- Public data (speaker_event_history) available to all

**Status:** ✅ RLS already configured correctly

---

## 8. Dependencies Summary

### 8.1 Ready to Use ✅

1. **Database Tables:**
   - ✅ `speaker_event_history` - Well-indexed, public data
   - ✅ `saved_speaker_profiles` - User-specific, JSONB fields
   - ✅ `enhanced_speaker_profiles` - User-specific, structured
   - ✅ `account_speakers` - Account-based, structured

2. **Utilities:**
   - ✅ `levenshteinSimilarity()` - Fuzzy name matching
   - ✅ `orgSimilarity()` - Fuzzy org matching
   - ✅ `normalizeOrg()` - Org normalization
   - ✅ `generateSpeakerKey()` - Speaker key generation

3. **Infrastructure:**
   - ✅ RLS policies configured
   - ✅ Indexes on key fields
   - ✅ Caching service available

---

### 8.2 Needs Implementation ⚠️

1. **Database:**
   - ⚠️ Full-text search indexes (migration needed)

2. **Code:**
   - ⚠️ Unified search service (new file)
   - ⚠️ Search API endpoint (new file)
   - ⚠️ Rate limiting for search (new or extend existing)

3. **Integration:**
   - ⚠️ Agent integration (modify outreach-agent.ts)
   - ⚠️ UI components (new files)

---

### 8.3 Potential Issues ⚠️

1. **Performance:**
   - Cross-table queries may be slow without proper indexes
   - Fuzzy matching requires loading candidates into memory
   - Full-text search on JSONB can be expensive

2. **Conflicts:**
   - Existing `findSpeakersByName()` has different signature
   - Different return types across existing search methods

3. **Access Control:**
   - Must respect RLS for user-specific tables
   - Public vs private data handling

---

## 9. Recommended Implementation Order

### Phase 1: Core API (Days 1-2)
1. Create `speaker-search-service.ts` with fuzzy matching
2. Create `/api/speakers/search` endpoint
3. Add full-text search indexes migration
4. Test with single table first (`speaker_event_history`)

### Phase 2: Multi-Table Search (Day 3)
1. Extend to search all 4 tables
2. Implement result merging and ranking
3. Add similarity scoring
4. Add pagination

### Phase 3: Integration (Day 4)
1. Integrate with Outreach Agent
2. Add rate limiting
3. Add caching for frequent searches
4. Update existing `findSpeakersByName()` to use unified API

---

## 10. Risk Assessment

### Low Risk ✅
- Database tables are ready
- Utilities exist and are tested
- RLS is properly configured

### Medium Risk ⚠️
- Performance with large datasets
- Full-text search on JSONB performance
- Cross-table query complexity

### High Risk 🔴
- None identified - all dependencies are manageable

---

## 11. Conclusion

**Overall Assessment:** ✅ **READY TO IMPLEMENT**

**Key Dependencies:**
- ✅ All required database tables exist
- ✅ Fuzzy matching utilities are available
- ✅ Normalization utilities are comprehensive
- ⚠️ Full-text indexes need to be added (migration)
- ⚠️ Rate limiting needs to be added

**Blockers:** None

**Estimated Effort:** 3-4 days (as per recommendations)

**Recommendation:** Proceed with implementation. All dependencies are either ready or can be created as part of the implementation.

