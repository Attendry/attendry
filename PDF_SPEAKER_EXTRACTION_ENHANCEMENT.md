# PDF Speaker Extraction Enhancement

## Problem
Events often have speakers listed in PDF documents (programs, brochures, speaker lists) linked from the main event page. The system was only finding 1 speaker for "Annual Conference on European Competition Law 2025" when the PDF contains 13 speakers.

**Example:** https://www.era.int/upload/dokumente/27129.pdf contains a complete speaker list with 13 speakers, but only 1 was being extracted.

## Solution
Enhanced Firecrawl's crawler and extraction prompts to explicitly discover and extract speakers from PDF documents.

## Changes Made

### 1. Updated Crawler Prompts
**File:** `src/app/api/events/extract/route.ts`

**Changes:**
- Updated all crawler prompts (in `extractBatch` and `extractOne` functions) to explicitly instruct Firecrawl to discover PDF documents
- Added instructions to look for PDF files (.pdf) containing event programs, speaker lists, or detailed event information
- Updated 3 occurrences across the file

**Before:**
```typescript
prompt: "Crawl pages related to event details, speakers, presenters, agenda, program, schedule, registration, tickets, and venue information. Focus on pages that contain event information, speaker bios, session details, and registration forms."
```

**After:**
```typescript
prompt: "Crawl pages and documents related to event details, speakers, presenters, agenda, program, schedule, registration, tickets, and venue information. CRITICAL: Also discover and crawl PDF documents (programs, brochures, speaker lists, event guides) linked from the page, as they often contain complete speaker information. Look for links to PDF files (.pdf) containing event programs, speaker lists, or detailed event information. Focus on pages and PDFs that contain event information, speaker bios, session details, and registration forms."
```

### 2. Enhanced Extraction Prompts
**File:** `src/app/api/events/extract/route.ts`

**Changes:**
- Updated extraction prompts in both `extractBatch` and `extractOne` functions
- Added explicit instructions to extract speakers from PDF documents
- Emphasized that PDFs often contain the most complete speaker information

**Before:**
```typescript
5. Extract speakers ONLY if explicitly listed as speakers/presenters/keynote speakers
```

**After:**
```typescript
5. Extract speakers ONLY if explicitly listed as speakers/presenters/keynote speakers
   IMPORTANT: Speakers are often listed in PDF documents (programs, brochures, speaker lists) linked from the main page. 
   Extract ALL speakers from PDFs if available - they typically contain the most complete speaker information.
```

### 3. Added PDF-Specific Speaker Extraction Guidelines
**File:** `src/app/api/events/extract/route.ts`

**Added to extraction prompt:**
```typescript
CRITICAL: Speakers may be listed in PDF documents (programs, brochures, speaker lists) linked from the main page. 
- If the page links to a PDF (e.g., "program.pdf", "speakers.pdf", "event-brochure.pdf"), extract speakers from that PDF
- Look for speaker sections in PDFs with headings like "Speakers", "Faculty", "Presenters", "Keynote Speakers"
- Extract ALL speakers listed, including their full names, titles, organizations, and affiliations
- PDFs often contain the most complete and accurate speaker information
```

## How It Works

1. **Discovery Phase:** Firecrawl's crawler discovers PDF documents linked from event pages using the enhanced natural language prompt
2. **Crawl Phase:** Firecrawl automatically crawls and parses PDF documents (already configured with `parsers: ["pdf"]` and `pdfOptions`)
3. **Extraction Phase:** The LLM extracts speakers from both HTML pages and PDF content, with explicit instructions to prioritize PDF speaker lists

## Technical Details

### Firecrawl Configuration
- **PDF Parsing:** Already enabled with `parsers: ["pdf"]`
- **PDF Options:** Enhanced with `pdfOptions: { extractTitle: true, extractMetadata: true }`
- **Natural Language Crawling:** Uses AI-powered page discovery (language-agnostic)

### Optimized Orchestrator
- **PDF URL Filtering:** The orchestrator correctly filters out PDF URLs from being treated as event pages (lines 733, 960)
- **Deep Crawl:** Uses `deepCrawlEvent()` which leverages Firecrawl's crawler to discover and crawl PDFs during the crawl phase
- **No Changes Needed:** The orchestrator doesn't need changes - Firecrawl handles PDF discovery automatically

## Expected Impact

1. **More Complete Speaker Lists:** Events with speakers in PDFs will now have all speakers extracted
2. **Better Quality Scores:** More speakers = higher quality scores = better event ranking
3. **Improved User Experience:** Users will see complete speaker information for events

## Testing

To test this enhancement:
1. Search for "Kartellrecht" or "Annual Conference on European Competition Law"
2. Verify that events show all speakers from PDF documents
3. Check logs for PDF discovery and extraction

## Files Changed

- `src/app/api/events/extract/route.ts`:
  - Updated crawler prompts (3 occurrences)
  - Updated extraction prompts (2 occurrences)
  - Added PDF-specific speaker extraction guidelines

## Related Issues

- Issue: Events showing only 1 speaker when PDF contains 13 speakers
- Root Cause: Firecrawl wasn't explicitly instructed to discover and extract from PDF documents
- Solution: Enhanced prompts to prioritize PDF discovery and speaker extraction

