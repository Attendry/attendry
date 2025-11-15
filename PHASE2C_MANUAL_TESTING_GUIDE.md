# Phase 2C: Competitive Intelligence - Manual Testing Guide
**Date:** 2025-02-24  
**Purpose:** Step-by-step guide for manual testing of competitive intelligence features

---

## Prerequisites

1. ✅ Database migration applied
   ```bash
   # Run migration
   supabase migration up
   ```

2. ✅ User profile with competitors
   - Navigate to profile settings
   - Add at least 2-3 competitors to your profile
   - Example: "Competitor Corp", "Tech Solutions Inc"

3. ✅ Events with competitor presence
   - Find events where your competitors are speakers/sponsors/attendees
   - Or use test events with known competitor data

---

## Test Scenarios

### Scenario 1: Basic Competitor Detection

**Objective:** Verify competitors are detected in events

**Steps:**
1. Navigate to event search (Command Centre or Search page)
2. Find an event where one of your competitors is present
3. Look at the Event Intelligence QuickView
4. Expand the intelligence panel

**Expected Results:**
- ✅ "Competitive Intelligence" section appears
- ✅ Competitor name displayed
- ✅ Match type shown (speaker/sponsor/attendee)
- ✅ Confidence score displayed (e.g., "90% match")

**Screenshot Locations:**
- Event Intelligence QuickView (in search results)
- Event detail page

---

### Scenario 2: Multiple Competitors

**Objective:** Verify multiple competitors are detected

**Steps:**
1. Add 3+ competitors to your profile
2. Find event with multiple competitors present
3. View Event Intelligence QuickView

**Expected Results:**
- ✅ All competitors listed
- ✅ Each with match type and confidence
- ✅ Top 3 shown in QuickView (with "View Full" for more)

---

### Scenario 3: Competitive Alerts

**Objective:** Verify alerts are generated for high-value events

**Steps:**
1. Find event with:
   - Competitor present
   - High opportunity score (≥70%)
2. View Event Intelligence QuickView or Event Board insights

**Expected Results:**
- ✅ Alert displayed: "X competitor(s) in high-value event"
- ✅ Alert severity: "high"
- ✅ Recommended action shown
- ✅ Alert color: Red (high severity)

---

### Scenario 4: Activity Comparison

**Objective:** Verify activity comparison displays correctly

**Steps:**
1. Navigate to Event Board
2. Click on event card
3. Open insights panel
4. Click "Competitive" tab

**Expected Results:**
- ✅ "Activity Comparison" section visible
- ✅ Shows your event count vs. competitor event count
- ✅ Growth rate displayed (with trend indicator)
- ✅ Gap count shown (events competitor is in, you're not)

---

### Scenario 5: Competitive Gaps

**Objective:** Verify competitive gaps are identified

**Steps:**
1. Ensure you have events in your board
2. Ensure competitors are attending different events
3. View Event Board insights → Competitive tab

**Expected Results:**
- ✅ "Competitive Gaps" section visible
- ✅ Shows competitor name
- ✅ Lists events competitor is attending
- ✅ Highlights events you're not attending

---

### Scenario 6: Event Board Integration

**Objective:** Verify Competitive tab works in Event Board

**Steps:**
1. Navigate to Event Board
2. Click on any event card
3. Open insights panel
4. Click "Competitive" tab

**Expected Results:**
- ✅ Competitive tab visible in tab list
- ✅ Tab content loads correctly
- ✅ All sections display (if competitors present)
- ✅ Empty state shown (if no competitors)

---

### Scenario 7: Empty States

**Objective:** Verify graceful handling when no competitors

**Steps:**
1. Remove all competitors from profile (or use account without competitors)
2. View event intelligence

**Expected Results:**
- ✅ No competitive intelligence section shown
- ✅ No errors in console
- ✅ Other intelligence sections work normally

---

### Scenario 8: Fuzzy Matching

**Objective:** Verify fuzzy matching works for name variations

**Test Cases:**
1. Competitor: "Competitor Corp"
   - Event has: "Competitor Corp Inc" → Should match
   - Event has: "Competitor Corporation" → Should match
   - Event has: "Competitor & Co." → Should match

2. Competitor: "Tech Solutions"
   - Event has: "Tech Solutions Inc" → Should match
   - Event has: "Tech Solutions LLC" → Should match

**Expected Results:**
- ✅ Variations matched correctly
- ✅ Confidence scores reflect similarity
- ✅ False positives minimized

---

### Scenario 9: Performance

**Objective:** Verify no performance regression

**Steps:**
1. Time intelligence generation:
   - Without competitors: Note time
   - With competitors: Note time
2. Check for UI lag

**Expected Results:**
- ✅ Additional time < 200ms for competitor detection
- ✅ No UI lag or freezing
- ✅ QuickView expands smoothly

---

### Scenario 10: Database Caching

**Objective:** Verify competitive intelligence is cached

**Steps:**
1. Generate intelligence for event with competitors
2. Check database:
   ```sql
   SELECT competitive_context, competitive_alerts
   FROM event_intelligence
   WHERE competitive_context IS NOT NULL
   LIMIT 1;
   ```
3. Reload intelligence (should be faster)

**Expected Results:**
- ✅ Data stored in `competitive_context` field
- ✅ Alerts stored in `competitive_alerts` field
- ✅ Cached retrieval faster than generation

---

## Test Data Setup

### Create Test User Profile with Competitors

```sql
-- Update your profile with competitors
UPDATE profiles
SET competitors = ARRAY['Competitor Corp', 'Tech Solutions Inc', 'Rival Company']
WHERE id = '[your-user-id]';
```

### Create Test Event with Competitors

```sql
-- Insert test event with competitor data
INSERT INTO collected_events (
  source_url,
  title,
  starts_at,
  speakers,
  sponsors,
  participating_organizations
) VALUES (
  'https://example.com/test-event',
  'Test Conference 2024',
  '2024-06-15T10:00:00Z',
  '[{"name": "John Doe", "org": "Competitor Corp", "title": "CTO"}]'::jsonb,
  '[{"name": "Competitor Corp", "level": "gold"}]'::jsonb,
  ARRAY['Competitor Corp', 'Tech Solutions Inc']
);
```

---

## Browser Console Checks

### Check API Response

```javascript
// In browser console
const response = await fetch('/api/events/[eventId]/intelligence');
const data = await response.json();
console.log('Competitive Context:', data.competitiveContext);
console.log('Competitive Alerts:', data.competitiveAlerts);
```

### Check for Errors

```javascript
// Monitor console for errors
// Should see no errors related to competitive intelligence
```

---

## Validation Checklist

### Functional Tests
- [ ] Competitors detected in speakers
- [ ] Competitors detected in sponsors
- [ ] Competitors detected in attendees
- [ ] Competitors detected in organizer
- [ ] Multiple competitors detected
- [ ] Fuzzy matching works
- [ ] Confidence scores displayed
- [ ] Alerts generated for high-value events
- [ ] Activity comparison displays
- [ ] Competitive gaps identified
- [ ] Empty states handled

### UI Tests
- [ ] QuickView shows competitive section
- [ ] Event Board shows Competitive tab
- [ ] All sections display correctly
- [ ] Alerts show with correct colors
- [ ] Responsive design works
- [ ] No layout issues

### Performance Tests
- [ ] Detection completes quickly
- [ ] No UI lag
- [ ] Cache improves performance
- [ ] No memory leaks

### Integration Tests
- [ ] API returns competitive data
- [ ] Database caching works
- [ ] Event Intelligence includes competitive data
- [ ] Board insights include competitive data

---

## Common Issues & Solutions

### Issue: No competitive intelligence shown

**Possible Causes:**
1. User profile has no competitors
2. Event has no competitor presence
3. Migration not applied

**Solutions:**
1. Add competitors to profile
2. Find event with competitors
3. Run migration: `supabase migration up`

---

### Issue: False positive matches

**Possible Causes:**
1. Similar company names
2. Fuzzy matching too lenient

**Solutions:**
1. Check confidence score (should be ≥ 50%)
2. Review match details
3. Report for algorithm improvement

---

### Issue: Performance slow

**Possible Causes:**
1. Many competitors (20+)
2. Large event dataset
3. No caching

**Solutions:**
1. Reduce competitor list
2. Check database indexes
3. Verify caching is working

---

## Test Results Template

```
Date: [Date]
Tester: [Name]
Environment: [Dev/Staging/Prod]

Test Results:
- Scenario 1: [Pass/Fail] - Notes: [Notes]
- Scenario 2: [Pass/Fail] - Notes: [Notes]
- Scenario 3: [Pass/Fail] - Notes: [Notes]
...

Issues Found:
1. [Issue description]
2. [Issue description]

Recommendations:
1. [Recommendation]
2. [Recommendation]
```

---

## Success Criteria

✅ **All scenarios pass**
✅ **No console errors**
✅ **Performance acceptable**
✅ **UI displays correctly**
✅ **Database caching works**

---

**End of Manual Testing Guide**

