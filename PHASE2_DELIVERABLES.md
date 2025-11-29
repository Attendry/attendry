# Phase 2: Deep Work - Deliverables & Implementation Guide

**Timeline:** 2-6 Weeks (31-40 hours)  
**Goal:** Schema changes and quality improvements  
**Expected Impact:** +70% precision, +25% recall, -18% latency, -8% cost, +180% trust

---

## Overview

Phase 2 focuses on **deep architectural improvements** that require schema changes, new services, and more complex logic. Unlike Phase 1's quick wins, these items need careful planning, database migrations, and thorough testing.

### Key Characteristics
- **Schema Changes:** Items 8, 10, 12 require database migrations
- **New Services:** Items 8, 10 require new service files
- **Dependencies:** Item 10 depends on Item 9 (taxonomy)
- **Higher Risk:** Schema changes require careful migration planning
- **Feature Flags:** All changes should be behind feature flags for safe rollout

---

## Deliverables Breakdown

### Item 7: Fuzzy Speaker Matching
**Priority:** High (foundation for Item 8)  
**Effort:** M (3-4 hours)  
**Dependencies:** Levenshtein library (or implement)

#### Deliverables:
1. **Levenshtein distance function** (`src/lib/utils/levenshtein.ts`)
   - Pure function implementation or use `fast-levenshtein` package
   - Threshold: 2 character differences max

2. **Name normalization function** (`src/lib/event-pipeline/extract.ts`)
   - Remove titles (Dr., Prof., Mr., Mrs., Ms.)
   - Expand initials (J. Smith → j smith)
   - Lowercase, trim whitespace

3. **Fuzzy matching logic** (`src/lib/event-pipeline/extract.ts:307-368`)
   - Compare normalized names with Levenshtein distance
   - Require org similarity > 0.6 (Jaccard similarity on words)
   - Merge if: name_similarity > 0.8 AND org_similarity > 0.6

4. **Confidence scoring updates**
   - Lower confidence for fuzzy matches vs exact matches
   - Flag uncertain matches for manual review

#### Files to Modify:
- `src/lib/event-pipeline/extract.ts` (lines 307-368)
- `src/lib/utils/levenshtein.ts` (new file, or add to existing utils)

#### Testing Requirements:
- Unit tests for name normalization
- Unit tests for Levenshtein distance
- Integration tests for fuzzy matching with various name formats
- Test edge cases: "John Smith" vs "J. Smith", "Dr. John Smith" vs "John Smith"

#### Success Criteria:
- Speaker-match F1 ≥ 0.85 (baseline: 0.70)
- No false positives (different speakers merged incorrectly)
- Confidence scores reflect match certainty

---

### Item 8: Speaker Event History Table
**Priority:** High (enables new capabilities)  
**Effort:** L (6-8 hours)  
**Dependencies:** Database migration, Item 7 (fuzzy matching)

#### Deliverables:

1. **Database Migration** (`supabase/migrations/XXXXX_add_speaker_history.sql`)
   ```sql
   CREATE TABLE speaker_event_history (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     speaker_key TEXT NOT NULL, -- hash(normalizedName + normalizedOrg)
     event_id UUID REFERENCES collected_events(id),
     speaker_name TEXT NOT NULL,
     speaker_org TEXT,
     speaker_title TEXT,
     talk_title TEXT,
     session_name TEXT,
     appeared_at TIMESTAMPTZ DEFAULT NOW(),
     confidence DECIMAL(3,2),
     UNIQUE(speaker_key, event_id)
   );
   
   CREATE INDEX idx_speaker_history_key ON speaker_event_history(speaker_key);
   CREATE INDEX idx_speaker_history_event ON speaker_event_history(event_id);
   CREATE INDEX idx_speaker_history_appeared ON speaker_event_history(appeared_at DESC);
   ```

2. **Speaker Service** (`src/lib/services/speaker-service.ts` - new file)
   - `linkSpeakerToEvent(speaker, eventId)` - Store speaker-event relationship
   - `getSpeakerHistory(speakerKey)` - Retrieve cross-event history
   - `enrichSpeakerWithHistory(speaker)` - Add history to speaker object
   - `generateSpeakerKey(speaker)` - Create canonical speaker key

3. **Integration Points:**
   - Update `src/app/api/events/speakers/route.ts` to call `linkSpeakerToEvent()`
   - Update `src/lib/event-pipeline/extract.ts` to enrich speakers with history
   - Add history to speaker response schema

4. **Speaker History Response Schema:**
   ```typescript
   interface SpeakerHistory {
     totalAppearances: number;
     recentEvents: Array<{
       eventTitle: string;
       eventDate: string;
       talkTitle: string | null;
       session: string | null;
     }>;
     talkThemes: string[];
   }
   ```

#### Files to Create:
- `supabase/migrations/XXXXX_add_speaker_history.sql`
- `src/lib/services/speaker-service.ts`

#### Files to Modify:
- `src/app/api/events/speakers/route.ts`
- `src/lib/event-pipeline/extract.ts`
- `src/lib/types/core.ts` (add SpeakerHistory interface)

#### Testing Requirements:
- Migration test (create table, indexes, constraints)
- Unit tests for speaker service methods
- Integration test: link speaker to multiple events, retrieve history
- Test speaker key generation consistency
- Test UNIQUE constraint handling

#### Success Criteria:
- Migration runs successfully without downtime
- Speaker history persists correctly
- Cross-event queries return accurate results
- No data loss or corruption

#### Rollback Plan:
- Keep old speaker extraction logic (feature flag)
- Migration is additive (no data deletion)
- Can disable history enrichment via feature flag

---

### Item 9: Topic Taxonomy & Normalization
**Priority:** High (foundation for Item 10)  
**Effort:** M (4-5 hours)  
**Dependencies:** None (but Item 10 depends on this)

#### Deliverables:

1. **Topic Taxonomy Definition** (`src/lib/data/topic-taxonomy.ts` - new file)
   ```typescript
   const TOPIC_TAXONOMY = {
     'legal-compliance': {
       aliases: ['legal', 'compliance', 'regulation', 'governance', 'regulatory'],
       parent: null
     },
     'technology-ai': {
       aliases: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'technology', 'tech'],
       parent: null
     },
     'data-privacy-gdpr': {
       aliases: ['gdpr', 'data privacy', 'privacy', 'data protection', 'dsgvo'],
       parent: 'legal-compliance'
     },
     // ... 20 core topics total
   };
   ```

2. **Topic Normalizer** (`src/lib/utils/topic-normalizer.ts` - new file)
   - `normalizeTopicToTaxonomy(topic: string, version: string = '1.0')` - Map topic to taxonomy
   - `findTopicAlias(topic: string)` - Find matching alias
   - `getTopicHierarchy(topicId: string)` - Get parent/child relationships
   - Handle versioning (v1.0, v1.1, etc.)

3. **Integration Points:**
   - Update extraction to normalize topics before storage
   - Update trend analysis to use normalized topics
   - Add "unknown" category for unmapped topics

4. **Versioning Strategy:**
   - Store taxonomy version with each event
   - Migration path: v1.0 → v1.1 (add new topics, deprecate old)
   - Backward compatibility: Map old topics to new

#### Files to Create:
- `src/lib/data/topic-taxonomy.ts`
- `src/lib/utils/topic-normalizer.ts`

#### Files to Modify:
- `src/app/api/events/extract/route.ts` (normalize topics after extraction)
- `src/lib/services/trend-analysis-service.ts` (use normalized topics)

#### Testing Requirements:
- Unit tests for topic normalization (all aliases map correctly)
- Test versioning (v1.0 → v1.1 migration)
- Test "unknown" category for unmapped topics
- Test parent/child relationships

#### Success Criteria:
- All common topic aliases map to correct taxonomy
- Versioning works correctly
- No topics lost during normalization
- Taxonomy coverage >80% (80% of topics mapped)

#### Rollback Plan:
- Allow free-text topics alongside normalized topics
- Keep old topic extraction (feature flag)
- Taxonomy is additive (no data deletion)

---

### Item 10: Trend Snapshot Rollups
**Priority:** Medium (depends on Item 9)  
**Effort:** L (8-10 hours)  
**Dependencies:** Item 9 (topic taxonomy), database migration

#### Deliverables:

1. **Database Migration** (`supabase/migrations/XXXXX_add_trend_snapshots.sql`)
   ```sql
   CREATE TABLE trend_snapshots (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     snapshot_date DATE NOT NULL,
     time_window TEXT NOT NULL, -- 'week', 'month', 'quarter'
     taxonomy_version TEXT NOT NULL DEFAULT '1.0',
     
     -- Topic trends
     topic_frequencies JSONB NOT NULL, -- {topic_id: count, ...}
     topic_growth_rates JSONB, -- {topic_id: growth_pct, ...}
     
     -- Sponsor trends
     sponsor_tiers JSONB, -- {platinum: count, gold: count, ...}
     sponsor_industries JSONB, -- {industry: count, ...}
     
     -- Org trends
     org_types JSONB, -- {type: count, ...}
     org_sectors JSONB, -- {sector: count, ...}
     
     -- Event trends
     event_count INTEGER,
     avg_attendees INTEGER,
     avg_speakers_per_event DECIMAL(5,2),
     
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(snapshot_date, time_window)
   );
   
   CREATE INDEX idx_trend_snapshots_date ON trend_snapshots(snapshot_date DESC);
   CREATE INDEX idx_trend_snapshots_window ON trend_snapshots(time_window, snapshot_date DESC);
   ```

2. **Rollup Service** (`src/lib/services/trend-analysis-service.ts` - enhance existing)
   - `generateTrendSnapshot(timeWindow, taxonomyVersion)` - Create snapshot
   - `getPreviousSnapshot(timeWindow)` - Get previous period for comparison
   - `calculateGrowthRates(current, previous)` - Calculate topic growth
   - `aggregateSponsorTiers(events)` - Aggregate sponsor data
   - `aggregateSponsorIndustries(events)` - Aggregate by industry

3. **Cron Job/Scheduler** (optional, can be manual trigger initially)
   - Weekly rollup (every Sunday)
   - Monthly rollup (first day of month)
   - Quarterly rollup (first day of quarter)

4. **API Endpoint** (`src/app/api/events/trends/snapshots/route.ts` - new)
   - GET: Retrieve snapshots by time window
   - POST: Trigger manual snapshot generation
   - Query parameters: timeWindow, startDate, endDate

#### Files to Create:
- `supabase/migrations/XXXXX_add_trend_snapshots.sql`
- `src/app/api/events/trends/snapshots/route.ts` (optional)

#### Files to Modify:
- `src/lib/services/trend-analysis-service.ts` (major enhancement)

#### Testing Requirements:
- Migration test
- Unit tests for rollup calculations
- Integration test: generate snapshot, compare to previous
- Test growth rate calculations
- Test JSONB aggregation queries

#### Success Criteria:
- Snapshots generate correctly for all time windows
- Growth rates calculated accurately
- Queries are fast (<1s for snapshot retrieval)
- Trend stability index ≥ 0.80

#### Rollback Plan:
- Keep old trend analysis (feature flag)
- Migration is additive
- Can disable snapshots via feature flag

---

### Item 11: Org Name Normalization
**Priority:** Medium  
**Effort:** M (4-5 hours)  
**Dependencies:** None

#### Deliverables:

1. **Org Alias Map** (`src/lib/utils/org-normalizer.ts` - new file)
   ```typescript
   const ORG_ALIASES: Record<string, string> = {
     'ibm': 'International Business Machines',
     'microsoft': 'Microsoft Corporation',
     'google': 'Google LLC',
     'accenture': 'Accenture',
     'deloitte': 'Deloitte',
     // ... 100+ common aliases
   };
   ```

2. **Normalization Functions:**
   - `normalizeOrg(org: string)` - Map alias to canonical name
   - `findOrgAlias(org: string)` - Find matching alias (fuzzy)
   - `getOrgVariations(canonicalName: string)` - Get all known aliases

3. **Integration Points:**
   - Update speaker extraction to normalize org names
   - Update sponsor extraction to normalize org names
   - Use in speaker matching (Item 7)

#### Files to Create:
- `src/lib/utils/org-normalizer.ts`

#### Files to Modify:
- `src/lib/event-pipeline/extract.ts` (normalize orgs in speakers)
- `src/app/api/events/extract/route.ts` (normalize orgs in sponsors)
- `src/lib/services/speaker-service.ts` (use in speaker matching)

#### Testing Requirements:
- Unit tests for org normalization (all aliases map correctly)
- Test fuzzy matching for org names
- Test case insensitivity
- Test edge cases: "IBM Corp" vs "IBM"

#### Success Criteria:
- 100+ common org aliases mapped
- Org matching accuracy +20%
- No false positives (different orgs merged)

#### Rollback Plan:
- Keep original org names (feature flag)
- Normalization is additive (store both normalized and original)

---

### Item 12: Enhanced Extraction Schema with Evidence
**Priority:** High (reduces hallucinations)  
**Effort:** L (6-8 hours)  
**Dependencies:** Item 6 (evidence tagging prompts - already done in Phase 1)

#### Deliverables:

1. **Enhanced Event Schema** (`src/app/api/events/extract/route.ts`)
   - Add `EvidenceTag[]` to EVENT_SCHEMA
   - Update TypeScript interfaces
   - Add validation for evidence tags

2. **Evidence Validation** (`src/app/api/events/extract/route.ts`)
   - `validateExtraction(event)` - Ensure all non-null fields have evidence
   - `calculateConfidence(event)` - Confidence based on evidence quality
   - Auto-null fields without evidence (hallucination guard)

3. **Database Schema Update** (if storing evidence)
   - Add `evidence` JSONB column to `collected_events` table (optional)
   - Or keep evidence in extraction cache only

4. **Evidence Tag Interface:**
   ```typescript
   interface EvidenceTag {
     field: string;
     source_url: string;
     source_section: string; // "title", "description", "header"
     snippet: string; // Max 500 chars
     confidence: number; // 0-1
     extracted_at: string; // ISO timestamp
   }
   ```

#### Files to Modify:
- `src/app/api/events/extract/route.ts` (schema, validation)
- `src/lib/types/core.ts` (add EvidenceTag interface)
- `src/lib/validation/schemas.ts` (add evidence validation)

#### Testing Requirements:
- Unit tests for evidence validation
- Test hallucination guard (null fields without evidence)
- Test confidence calculation
- Integration test: extraction with evidence tags

#### Success Criteria:
- All non-null fields have evidence tags
- Hallucination rate <5% (baseline: ~10-15%)
- Extraction accuracy ≥ 0.90 (baseline: 0.75)
- Confidence scores reflect evidence quality

#### Rollback Plan:
- Make evidence optional (feature flag)
- Keep old extraction schema (feature flag)
- Evidence is additive (doesn't break existing data)

---

## Implementation Order & Dependencies

### Recommended Sequence:

**Week 3:**
1. **Item 9: Topic Taxonomy** (Day 1-2) - No dependencies, enables Item 10
2. **Item 11: Org Normalization** (Day 3-4) - No dependencies, helps Item 7
3. **Item 7: Fuzzy Speaker Matching** (Day 5) - Uses Item 11

**Week 4:**
4. **Item 8: Speaker History** (Day 1-3) - Uses Item 7, requires migration
5. **Item 8: Service Implementation** (Day 4-5) - Complete speaker history

**Week 5:**
6. **Item 10: Trend Snapshots** (Day 1-3) - Uses Item 9, requires migration
7. **Item 10: Rollup Service** (Day 4-5) - Complete trend snapshots

**Week 6:**
8. **Item 12: Enhanced Schema** (Day 1-3) - Uses Item 6 (already done)
9. **Item 12: Validation** (Day 4-5) - Complete evidence validation

### Dependency Graph:
```
Item 9 (Taxonomy) → Item 10 (Trend Snapshots)
Item 11 (Org Norm) → Item 7 (Fuzzy Matching) → Item 8 (Speaker History)
Item 6 (Evidence Prompts) → Item 12 (Enhanced Schema)
```

---

## Risk Mitigation Strategies

### 1. Database Migrations (Items 8, 10)
**Risk:** Breaking changes, data loss, downtime

**Mitigation:**
- Use backward-compatible migrations (add columns, don't remove)
- Test migrations on staging first
- Run during low-traffic periods
- Keep old schema fields for 30 days before deprecation
- Use feature flags to toggle new schema usage

**Rollback:**
- Keep old schema intact
- Feature flags allow instant rollback
- Migrations are additive (no data deletion)

### 2. Schema Changes (Item 12)
**Risk:** Breaking API contracts, frontend compatibility

**Mitigation:**
- Make evidence optional in API response
- Version API endpoints (v1, v2)
- Update frontend gradually
- Keep old extraction format available

**Rollback:**
- Feature flag to disable evidence requirement
- Keep old schema as fallback

### 3. Fuzzy Matching False Positives (Item 7)
**Risk:** Different speakers merged incorrectly

**Mitigation:**
- Require org similarity > 0.6 in addition to name similarity
- Use confidence scoring to flag uncertain matches
- Manual review queue for low-confidence merges
- Start with threshold of 1, increase to 2 if precision maintained

**Rollback:**
- Increase threshold to 1 or disable fuzzy matching
- Feature flag to toggle fuzzy matching

### 4. Topic Taxonomy Rigidity (Item 9)
**Risk:** Fixed taxonomy may miss emerging topics

**Mitigation:**
- Version taxonomy (v1.0, v1.1) with migration paths
- Allow "unknown" topic category for unmapped topics
- Quarterly taxonomy review and updates
- Track taxonomy coverage (% of topics mapped)

**Rollback:**
- Allow free-text topics alongside normalized topics
- Feature flag to disable normalization

---

## Testing Strategy

### Unit Tests (Required for all items):
- All utility functions (normalization, matching, etc.)
- Service methods (speaker service, trend service)
- Validation functions

### Integration Tests (Required for Items 8, 10, 12):
- Database migrations
- End-to-end speaker history flow
- End-to-end trend snapshot generation
- Evidence validation in extraction pipeline

### Manual Testing:
- Test with real event data
- Verify speaker matching accuracy
- Verify trend snapshot accuracy
- Verify evidence tags in extractions

### Performance Testing:
- Migration execution time
- Query performance (trend snapshots)
- Speaker history lookup performance

---

## Success Criteria

### Overall Phase 2 Success:
- ✅ All 6 items deployed with feature flags
- ✅ Metrics show: +70% precision, +25% recall, -18% latency
- ✅ Schema migrations completed without downtime
- ✅ Speaker history operational
- ✅ Trend snapshots generating
- ✅ Zero critical bugs
- ✅ No data loss or corruption

### Per-Item Success Criteria:
- **Item 7:** Speaker-match F1 ≥ 0.85
- **Item 8:** Speaker history persists, cross-event queries work
- **Item 9:** Taxonomy coverage >80%
- **Item 10:** Trend stability index ≥ 0.80
- **Item 11:** Org matching accuracy +20%
- **Item 12:** Hallucination rate <5%, extraction accuracy ≥ 0.90

---

## Feature Flags Required

All Phase 2 items should be behind feature flags for safe rollout:

```typescript
// Feature flags
const FEATURE_FLAGS = {
  fuzzySpeakerMatching: boolean;
  speakerEventHistory: boolean;
  topicTaxonomy: boolean;
  trendSnapshots: boolean;
  orgNormalization: boolean;
  evidenceValidation: boolean;
};
```

**Rollout Strategy:**
1. Deploy with flags disabled (dark launch)
2. Enable for 10% of traffic
3. Monitor metrics for 1 week
4. Increase to 50% if successful
5. Full rollout if all success criteria met

---

## Deliverables Checklist

### Code Deliverables:
- [ ] Item 7: Fuzzy speaker matching implementation
- [ ] Item 8: Speaker history migration + service
- [ ] Item 9: Topic taxonomy + normalizer
- [ ] Item 10: Trend snapshots migration + service
- [ ] Item 11: Org normalizer
- [ ] Item 12: Enhanced schema + validation

### Database Deliverables:
- [ ] Migration: speaker_event_history table
- [ ] Migration: trend_snapshots table
- [ ] Migration: evidence column (optional)

### Documentation Deliverables:
- [ ] API documentation for new endpoints
- [ ] Migration runbook
- [ ] Feature flag documentation
- [ ] Rollback procedures

### Testing Deliverables:
- [ ] Unit tests (all items)
- [ ] Integration tests (Items 8, 10, 12)
- [ ] Performance tests (migrations, queries)
- [ ] Manual test plan

---

## Estimated Timeline

**Total Effort:** 31-40 hours

**Week 3:** 12-15 hours (Items 9, 11, 7)  
**Week 4:** 6-8 hours (Item 8)  
**Week 5:** 8-10 hours (Item 10)  
**Week 6:** 6-8 hours (Item 12)

**Buffer:** Add 20% buffer for unexpected issues = **37-48 hours total**

---

## Recommendations

### Before Starting:
1. **Validate Phase 1 metrics** - Ensure Phase 1 is performing as expected
2. **Database backup** - Full backup before any migrations
3. **Feature flag infrastructure** - Ensure feature flags are set up
4. **Staging environment** - Test all migrations on staging first
5. **Taxonomy review** - Get product approval for 20-topic taxonomy

### During Implementation:
1. **One item at a time** - Don't parallelize schema changes
2. **Test frequently** - Run tests after each item
3. **Monitor closely** - Watch for regressions
4. **Document decisions** - Keep notes on design decisions

### After Implementation:
1. **Monitor metrics** - Track improvements vs. baseline
2. **Gather feedback** - User feedback on new capabilities
3. **Iterate** - Adjust based on real-world usage
4. **Plan Phase 3** - Evaluate if Phase 3 items are still needed

---

**Ready to proceed when instructed!**





