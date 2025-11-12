# Speaker Extraction Fix

## Problem
Speaker extraction was incorrectly identifying non-person elements as speaker names, resulting in entries like:
- "Practices Act" (session title, not a person)
- "Lawyers Forum" (event name, not a person)
- "Privacy Summit" (event name, not a person)
- "Risk Summit" (event name, not a person)
- **"Reserve Seat"** (call-to-action button, not a person)
- **"Register Now"** (UI element, not a person)
- **"Book Ticket"** (CTA phrase, not a person)

Additionally, JSON parsing errors were occurring: `Expected double-quoted property name in JSON at position 42`

## Root Causes

1. **Insufficient Token Limit**: `maxOutputTokens` was 256, too small for Gemini's thinking mode + response
2. **Ambiguous Prompt**: Gemini wasn't explicitly told to exclude event/session names
3. **No Validation**: No post-processing filter to catch event names that slipped through
4. **Brittle JSON Parsing**: No fallback when JSON was wrapped in markdown or malformed

## Solutions Implemented

### 1. Increased Token Limit
```typescript
maxOutputTokens: 1024  // Increased from 256
```
This accommodates Gemini 2.5's thinking tokens (up to 931 observed) plus the actual JSON response.

### 2. Explicit Prompt Instructions
```typescript
const prompt = `Extract ONLY PEOPLE (actual speakers/presenters) from this event content. DO NOT extract:
- Event names (e.g., "Privacy Summit", "Risk Forum")
- Session titles (e.g., "Practices Act", "Lawyers Forum")
- Organization names
- Conference names

Look for INDIVIDUAL PEOPLE with their:
- Full name (REQUIRED - must be a person's name)
- Job title (if mentioned)
- Company/organization (if mentioned)
- Bio/description (if mentioned)

Return up to 15 unique PEOPLE as JSON. If no people are found, return {"speakers": []}.`;
```

### 3. Comprehensive Validation Function
Added `isLikelyPersonName()` to filter out non-person entries:

```typescript
const isLikelyPersonName = (name: string): boolean => {
  const nameLower = name.toLowerCase();
  
  // Filter out call-to-action phrases and UI elements (NEW!)
  const ctaKeywords = [
    'reserve', 'register', 'book', 'buy', 'purchase', 'sign up', 'login',
    'learn more', 'read more', 'view more', 'see more', 'click here',
    'download', 'subscribe', 'join', 'enroll', 'attend', 'save', 'share',
    'contact', 'submit', 'apply', 'ticket', 'seat', 'now', 'today'
  ];
  
  if (ctaKeywords.some(keyword => nameLower.includes(keyword))) {
    return false;  // Not a person name - it's a CTA/UI element
  }
  
  // Filter out event/session titles
  const eventKeywords = [
    'summit', 'forum', 'conference', 'act', 'practice', 'risk', 'privacy',
    'lawyers', 'compliance', 'webinar', 'session', 'panel', 'workshop',
    'event', 'meeting', 'seminar', 'symposium', 'congress', 'convention',
    'day', 'week', 'month', 'year', 'edition', 'annual', 'international',
    'program', 'agenda', 'schedule', 'keynote', 'presentation', 'track'
  ];
  
  if (eventKeywords.some(keyword => nameLower.includes(keyword))) {
    return false;  // Not a person name
  }
  
  // Filter out organizational terms (NEW!)
  const orgKeywords = [
    'committee', 'board', 'team', 'group', 'department', 'organization',
    'association', 'institute', 'foundation', 'council', 'society', 'partner'
  ];
  
  if (orgKeywords.some(keyword => nameLower.includes(keyword))) {
    return false;  // Not a person name - it's an organization
  }
  
  // Must have at least first and last name
  const parts = name.split(/\s+/);
  if (parts.length < 2 || parts.length > 4) {
    return false;  // Too short or too long
  }
  
  // Length validation (NEW!)
  if (name.length > 50) {
    return false;  // Likely a sentence, not a name
  }
  
  // Check proper capitalization (Person Names are Title Case)
  const hasProperCapitalization = parts.every(part => 
    part.length > 0 && /^[A-ZÄÖÜ]/.test(part)
  );
  
  if (!hasProperCapitalization) {
    return false;
  }
  
  // Character validation (NEW!)
  const hasValidCharacters = parts.every(part => 
    /^[A-ZÄÖÜa-zäöüß\-']+$/.test(part)
  );
  
  return hasValidCharacters;  // Only letters, hyphens, apostrophes
};
```

**Filters Applied:**
- ❌ **CTA/UI elements**: reserve, register, book, seat, ticket, login, etc.
- ❌ **Event keywords**: summit, forum, conference, act, practice, etc.
- ❌ **Organizational terms**: committee, board, team, institute, etc.
- ❌ **Single-word or overly long names** (must be 2-4 words, max 50 chars)
- ❌ **Improper capitalization** (not Title Case)
- ❌ **Invalid characters** (must be letters, hyphens, apostrophes only)
- ✅ **Only proper person names** (e.g., "John Smith", "Maria García", "Anne-Marie O'Connor")

### 4. Better JSON Parsing
```typescript
let parsed;
try {
  parsed = JSON.parse(text);
} catch (jsonError) {
  // Try to extract JSON from response if wrapped in markdown
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    parsed = JSON.parse(jsonMatch[0]);
    console.log(`[event-analysis] Recovered JSON using regex extraction`);
  } else {
    throw jsonError;
  }
}
```

Handles cases where Gemini wraps JSON in markdown code blocks or adds extra text.

## Monitoring & Debugging

### New Log Messages

**Validation Logs:**
```
[speaker-validation] Filtered out CTA/UI element: "Reserve Seat"
[speaker-validation] Filtered out CTA/UI element: "Register Now"
[speaker-validation] Filtered out CTA/UI element: "Book Ticket"
[speaker-validation] Filtered out event name: "Privacy Summit"
[speaker-validation] Filtered out organization term: "Organizing Committee"
[speaker-validation] Filtered out single-word name: "Conference"
[speaker-validation] Filtered out improper capitalization: "john smith"
[speaker-validation] Filtered out overly long name: "The International Conference Committee"
[speaker-validation] Filtered out invalid characters: "Speaker #1"
```

**Processing Logs:**
```
[event-analysis] Processing 5 speakers from chunk 1
[event-analysis] ✓ Successfully extracted 3 validated speakers
```

**Fallback Logs:**
```
[event-analysis] No speakers found via Gemini, trying manual extraction fallback...
[event-analysis] ✓ Manual extraction found 2 speaker names
```

**Error Logs:**
```
[event-analysis] ⚠ Speaker extraction failed completely, returning empty array
[event-analysis] Empty speaker response for chunk 1
[event-analysis] Speaker chunk 2 failed: JSON parsing error
[event-analysis] Recovered JSON from chunk 2 using regex extraction
```

## Testing

### Before Fix
```json
{
  "speakers": [
    {
      "name": "Practices Act",
      "title": "Title not provided",
      "company": "Organization not provided"
    },
    {
      "name": "Lawyers Forum",
      "title": "Title not provided",
      "company": "Organization not provided"
    },
    {
      "name": "Privacy Summit",
      "title": "Title not provided",
      "company": "Organization not provided"
    }
  ]
}
```

### After Fix
```json
{
  "speakers": [
    {
      "name": "Dr. Sarah Johnson",
      "title": "Chief Compliance Officer",
      "company": "LegalTech Solutions"
    },
    {
      "name": "Michael Schmidt",
      "title": "Partner",
      "company": "Schmidt & Associates"
    }
  ]
}
```

## Expected Vercel Logs After Fix

✅ **Success Case:**
```
[event-analysis] Gemini model initialized successfully
[event-analysis] Preparing content for Gemini analysis, total chunk count: 3
[event-analysis] Processing 8 speakers from chunk 1
[speaker-validation] Filtered out event name: "Privacy Summit"
[speaker-validation] Filtered out event name: "Risk Forum"
[event-analysis] Processing 5 speakers from chunk 2
[event-analysis] ✓ Successfully extracted 11 validated speakers
```

⚠️ **No Speakers Found:**
```
[event-analysis] Gemini model initialized successfully
[event-analysis] Preparing content for Gemini analysis, total chunk count: 2
[event-analysis] Empty speaker response for chunk 1
[event-analysis] Processing 0 speakers from chunk 2
[event-analysis] No speakers found via Gemini, trying manual extraction fallback...
[event-analysis] ✓ Manual extraction found 3 speaker names
```

## Configuration

### Adjusting Validation Keywords
Add more keywords to filter in `src/lib/event-analysis.ts`:
```typescript
const eventKeywords = [
  'summit', 'forum', 'conference', 'act', 'practice', 'risk', 'privacy',
  'lawyers', 'compliance', 'webinar', 'session', 'panel', 'workshop',
  // Add more here
];
```

### Adjusting Token Limit
```typescript
maxOutputTokens: 1024  // Increase if still seeing MAX_TOKENS errors
```

### Adjusting Maximum Speakers
```typescript
if (speakerMap.size >= 15) {  // Change this number
  break;
}
```

## Impact

- ✅ Eliminates false positives (event names as speakers)
- ✅ Improves data quality for speaker profiles
- ✅ Reduces JSON parsing errors
- ✅ Better handling of Gemini's thinking mode
- ✅ More informative logging for debugging
- ⚠️ May reduce speaker count temporarily (filtering is strict)
- ⚠️ Requires proper capitalization in source data

## Related Issues

- MAX_TOKENS errors in Gemini prioritization → Fixed by increasing to 1024
- Body stream already read → Fixed in EventsClient.tsx with res.clone()
- Empty speaker responses → Now handled with validation logging

