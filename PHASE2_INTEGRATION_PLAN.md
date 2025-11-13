# Phase 2 Integration Plan: Speaker History Linking

**Date:** 2025-11-13  
**Goal:** Integrate `linkSpeakerToEvent()` into saved profiles and Events Board workflows

---

## Overview

Phase 2 Item 8 (Speaker Event History) created the infrastructure but isn't being used. This plan integrates speaker history linking into two key user workflows:

1. **Saved Speaker Profiles** - When users save a speaker profile
2. **Events Board** - When users add events to their board

---

## Integration Points

### 1. Saved Speaker Profiles (`/api/profiles/saved`)

**Current Flow:**
1. User saves speaker via `/api/profiles/saved` POST
2. Speaker data stored in `saved_speaker_profiles` table
3. **Missing:** Link speaker to source event in `speaker_event_history`

**Integration:**
- Extract event context from request metadata (if available)
- Call `linkSpeakerToEvent()` after successful save
- Handle gracefully if event context is missing

**File:** `src/app/api/profiles/saved/route.ts`

**Changes:**
```typescript
// After successful save
if (requestData.metadata?.event_source_url && requestData.metadata?.event_id) {
  await linkSpeakerToEvent(
    {
      name: speaker_data.name,
      org: speaker_data.org,
      title: speaker_data.title
    },
    requestData.metadata.event_id,
    {
      talk_title: speaker_data.speech_title,
      session_name: speaker_data.session
    },
    requestData.metadata.confidence || null
  );
}
```

---

### 2. Events Board (`/api/events/board/add`)

**Current Flow:**
1. User adds event to board via `/api/events/board/add` POST
2. Event stored in `user_event_board` table
3. **Missing:** Link all event speakers to event in `speaker_event_history`

**Integration:**
- Extract speakers from `eventData.speakers` (if available)
- For each speaker, call `linkSpeakerToEvent()`
- Handle gracefully if speakers array is missing

**File:** `src/app/api/events/board/add/route.ts`

**Changes:**
```typescript
// After successful board add/update
if (eventData?.speakers && Array.isArray(eventData.speakers) && actualEventId) {
  for (const speaker of eventData.speakers) {
    if (speaker.name) {
      await linkSpeakerToEvent(
        {
          name: speaker.name,
          org: speaker.org,
          title: speaker.title
        },
        actualEventId,
        {
          talk_title: speaker.speech_title || speaker.talk_title,
          session_name: speaker.session
        },
        speaker.confidence || null
      );
    }
  }
}
```

---

## Implementation Details

### Error Handling

Both integration points should:
- **Not fail** if speaker history linking fails
- Log errors for debugging
- Continue with normal flow even if linking fails

```typescript
try {
  await linkSpeakerToEvent(...);
  console.log('[phase2-speaker-history] Linked speaker to event:', speaker.name, eventId);
} catch (error) {
  console.error('[phase2-speaker-history] Failed to link speaker:', error);
  // Don't throw - allow normal flow to continue
}
```

### Event ID Resolution

For Events Board:
- Use `actualEventId` (resolved from `collected_events` table)
- If event doesn't exist in `collected_events`, skip linking (no event_id available)

For Saved Profiles:
- Use `metadata.event_id` if provided
- If not provided, try to resolve from `metadata.event_source_url`
- If neither available, skip linking

---

## Testing Plan

### Test Case 1: Save Speaker Profile with Event Context
1. Save speaker from event search results
2. Verify speaker linked to event in `speaker_event_history`
3. Verify speaker history queryable via `getSpeakerHistory()`

### Test Case 2: Save Speaker Profile without Event Context
1. Save speaker without event metadata
2. Verify save succeeds (no error)
3. Verify no speaker history entry created (expected)

### Test Case 3: Add Event to Board with Speakers
1. Add event with speakers to board
2. Verify all speakers linked to event in `speaker_event_history`
3. Verify speaker history queryable

### Test Case 4: Add Event to Board without Speakers
1. Add event without speakers to board
2. Verify board add succeeds (no error)
3. Verify no speaker history entries created (expected)

---

## Rollout Strategy

1. **Phase 1:** Add integration with error handling (non-blocking)
2. **Phase 2:** Add logging to verify linking is working
3. **Phase 3:** Monitor for errors and adjust as needed
4. **Phase 4:** Add metrics tracking for linking success rate

---

## Success Criteria

- ✅ Speaker history linking works for saved profiles (when event context available)
- ✅ Speaker history linking works for Events Board (when speakers available)
- ✅ No errors block normal user workflows
- ✅ Speaker history queryable via `getSpeakerHistory()`
- ✅ Logging shows linking activity

---

## Future Enhancements

1. **Bulk Linking:** Link speakers during event extraction pipeline
2. **History Enrichment:** Show speaker history in UI when viewing saved profiles
3. **Cross-Event Queries:** "Where has this speaker presented before?"
4. **Analytics:** Track speaker appearance frequency across events

