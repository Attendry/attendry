# Speaker Extraction Optimization Analysis

## Current Architecture Review

### Flow Overview
```
1. deepCrawlEvent(eventUrl)
   ├─ Scrape main page (12s timeout)
   ├─ Extract sub-page URLs
   └─ Scrape 2 sub-pages (8s timeout each)

2. extractAndEnhanceSpeakers(crawlResults)
   ├─ Chunk content (1200 chars, 150 overlap, max 6 chunks)
   ├─ Process chunks sequentially (15s timeout each)
   ├─ Send to Gemini (1024 tokens)
   ├─ Validate with filters (POST-extraction)
   └─ Merge & deduplicate speakers
```

### Current Strengths ✅
1. **Robust validation**: Comprehensive filters for CTAs, events, orgs
2. **Token management**: 1024 tokens handles Gemini's thinking mode
3. **Deduplication**: Speaker map prevents duplicates
4. **Fallback**: Manual regex extraction if Gemini fails
5. **Timeout protection**: Individual chunk timeouts prevent hangs

### Identified Issues ❌

#### 1. **Sub-Page Selection is Blind**
```typescript
// Current: Takes first 2 sub-pages found
const subPageUrls = extractSubPageUrls(eventUrl, results[0]?.content || '');
const subPagePromises = subPageUrls.slice(0, 2).map(async (subUrl, index) => {
```

**Problem**: We don't prioritize speaker/agenda pages. We might crawl "Privacy Policy" instead of "Speakers".

**Impact**: Missing actual speaker data from dedicated speaker pages.

#### 2. **Gemini Prompt Lacks Negative Examples**
```typescript
const prompt = `Extract ONLY PEOPLE (actual speakers/presenters) from this event content. DO NOT extract:
- Event names (e.g., "Privacy Summit", "Risk Forum")
- Session titles (e.g., "Practices Act", "Lawyers Forum")
- Organization names
- Conference names
```

**Problem**: Doesn't mention CTAs, UI elements, button text, which we're seeing ("Reserve Seat").

**Impact**: Gemini extracts UI elements, requiring post-validation filtering.

#### 3. **Sequential Chunk Processing**
```typescript
for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];
  const result = await model.generateContent({...}); // Sequential!
}
```

**Problem**: Processes 6 chunks sequentially = ~90 seconds total (15s * 6).

**Impact**: Slow speaker extraction, approaching Vercel timeout limits.

#### 4. **No Content Pre-Filtering**
**Problem**: Sends ALL content to Gemini, including:
- Navigation menus
- Footer links
- Cookie banners
- "Register Now" sections

**Impact**: Wastes tokens, increases false positives, slows processing.

#### 5. **Chunking Strategy is Generic**
```typescript
return chunkText(sectionText, 1200, 150).slice(0, 2);
```

**Problem**: Fixed chunk size doesn't account for content density or speaker sections.

**Impact**: May split speaker info across chunks or include too much irrelevant content.

## Recommended Optimizations

### Priority 1: Intelligent Sub-Page Selection 🎯

**Current**:
```typescript
const subPageUrls = extractSubPageUrls(eventUrl, results[0]?.content || '');
const crawledSubPages = subPageUrls.slice(0, 2);
```

**Optimized**:
```typescript
function prioritizeSubPageUrls(urls: string[], mainContent: string): string[] {
  // Priority scoring
  const scored = urls.map(url => {
    const urlLower = url.toLowerCase();
    let score = 0;
    
    // High priority: speaker/agenda pages
    if (urlLower.includes('speaker') || urlLower.includes('referent')) score += 100;
    if (urlLower.includes('agenda') || urlLower.includes('program')) score += 90;
    if (urlLower.includes('faculty') || urlLower.includes('presenters')) score += 85;
    
    // Medium priority: schedule/sessions
    if (urlLower.includes('schedule') || urlLower.includes('session')) score += 50;
    
    // Low priority: general info
    if (urlLower.includes('about') || urlLower.includes('info')) score += 20;
    
    // Negative: non-speaker pages
    if (urlLower.includes('register') || urlLower.includes('ticket')) score -= 50;
    if (urlLower.includes('sponsor') || urlLower.includes('partner')) score -= 30;
    if (urlLower.includes('venue') || urlLower.includes('hotel')) score -= 20;
    if (urlLower.includes('privacy') || urlLower.includes('terms')) score -= 100;
    
    return { url, score };
  });
  
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(s => s.url);
}
```

**Impact**: 🚀 Significantly increases chance of finding actual speaker data.

### Priority 2: Enhanced Gemini Prompt 📝

**Current**: Generic "DO NOT extract" list

**Optimized**:
```typescript
const prompt = `Extract ONLY PEOPLE (actual speakers/presenters) from this event content.

REQUIRED: Each entry must be a REAL PERSON with a full name.

DO NOT EXTRACT:
✗ Event names: "Privacy Summit", "Risk Forum", "Compliance Day"
✗ Session titles: "Practices Act", "Keynote Address", "Panel Discussion"
✗ Organization names: "ABC Corporation", "Legal Institute"
✗ UI/CTA elements: "Reserve Seat", "Register Now", "Book Ticket", "Learn More"
✗ Buttons/Links: "Sign Up", "Download", "Contact", "View More"
✗ Generic roles: "Moderator", "Organizer", "Committee"
✗ Organizational terms: "Organizing Committee", "Advisory Board"

ONLY EXTRACT:
✓ Full person names: "Dr. Sarah Johnson", "Michael Schmidt"
✓ With context: job title, company, bio if available

Return JSON with "speakers" array. If NO PEOPLE found, return {"speakers": []}.

Content chunk ${i + 1}/${chunks.length}:
${chunk}`;
```

**Impact**: 🎯 Reduces false positives at source, less reliance on post-validation.

### Priority 3: Parallel Chunk Processing ⚡

**Current**: Sequential (slow)

**Optimized**:
```typescript
// Process chunks in parallel with concurrency limit
const chunkPromises = chunks.map((chunk, i) => 
  processChunkWithTimeout(chunk, i, model)
);

// Use Promise.allSettled to handle failures gracefully
const chunkResults = await Promise.allSettled(chunkPromises);

chunkResults.forEach((result, i) => {
  if (result.status === 'fulfilled' && result.value) {
    result.value.forEach(upsertSpeaker);
  } else {
    console.warn(`[event-analysis] Chunk ${i + 1} failed:`, result.reason);
  }
});
```

**Impact**: ⚡ 6x faster (6 chunks in ~15s instead of ~90s).

### Priority 4: Content Pre-Filtering 🧹

**Current**: Sends everything to Gemini

**Optimized**:
```typescript
function preprocessContentForSpeakers(content: string): string {
  // Remove obvious non-speaker sections
  let cleaned = content;
  
  // Remove navigation/footer patterns
  cleaned = cleaned.replace(/^(Home|About|Contact|Privacy|Terms).*$/gmi, '');
  
  // Remove common UI patterns
  cleaned = cleaned.replace(/(Register Now|Book Now|Sign Up|Learn More|Download)/gi, '');
  
  // Remove cookie banners
  cleaned = cleaned.replace(/.*cookies?.*accept.*/gi, '');
  
  // Focus on speaker-rich sections (if identifiable)
  const speakerSections = extractSpeakerSections(cleaned);
  if (speakerSections.length > 0) {
    return speakerSections.join('\n\n');
  }
  
  return cleaned;
}

function extractSpeakerSections(content: string): string[] {
  const sections = [];
  
  // Look for speaker headings
  const speakerHeadingRegex = /#{1,3}\s*(Speakers?|Presenters?|Faculty|Referent|Moderators?)/i;
  const lines = content.split('\n');
  
  let inSpeakerSection = false;
  let currentSection = [];
  
  for (const line of lines) {
    if (speakerHeadingRegex.test(line)) {
      if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
      }
      currentSection = [line];
      inSpeakerSection = true;
    } else if (inSpeakerSection) {
      // Continue until next major heading
      if (line.startsWith('##') && !speakerHeadingRegex.test(line)) {
        sections.push(currentSection.join('\n'));
        currentSection = [];
        inSpeakerSection = false;
      } else {
        currentSection.push(line);
      }
    }
  }
  
  if (currentSection.length > 0) {
    sections.push(currentSection.join('\n'));
  }
  
  return sections;
}
```

**Impact**: 🎯 Cleaner input = fewer false positives, faster processing.

### Priority 5: Smart Chunking 🧩

**Current**: Fixed 1200-char chunks

**Optimized**:
```typescript
function smartChunkForSpeakers(content: string): string[] {
  // First, try to extract speaker sections
  const speakerSections = extractSpeakerSections(content);
  
  if (speakerSections.length > 0) {
    // Chunk speaker sections more granularly
    return speakerSections.flatMap(section => 
      chunkText(section, 800, 100) // Smaller chunks for speaker-dense content
    ).slice(0, 6);
  }
  
  // Fallback to generic chunking
  return chunkText(content, 1200, 150).slice(0, 6);
}
```

**Impact**: 📊 Better chunk boundaries, less speaker data split across chunks.

## Implementation Priority

### Phase 1 (Quick Wins - 1-2 hours) ⭐⭐⭐
1. ✅ **Enhanced Gemini Prompt** - 5 minutes
2. ✅ **Intelligent Sub-Page Selection** - 30 minutes
3. ✅ **Parallel Chunk Processing** - 20 minutes

**Expected Impact**: 60% improvement in speaker quality, 4-5x speed increase

### Phase 2 (Medium Effort - 2-4 hours) ⭐⭐
4. **Content Pre-Filtering** - 1-2 hours
5. **Smart Chunking** - 1 hour

**Expected Impact**: Additional 20% improvement in speaker quality

### Phase 3 (Advanced - Optional) ⭐
6. **Machine Learning Pre-Classification** - Use lightweight model to identify speaker sections
7. **OCR Integration** - Extract speakers from images (speaker photos with captions)
8. **LinkedIn Integration** - Enrich speaker data with professional profiles

## Metrics to Track

### Before Optimization
- ❌ False positive rate: ~40-60% (CTAs, event names)
- ⏱️ Processing time: ~90-120 seconds
- 📊 Speaker extraction success rate: ~30-40%
- 🎯 Relevant speakers found: 20-30%

### After Phase 1 (Expected)
- ✅ False positive rate: ~10-20%
- ⏱️ Processing time: ~20-30 seconds
- 📊 Speaker extraction success rate: ~60-70%
- 🎯 Relevant speakers found: 50-60%

### After Phase 2 (Expected)
- ✅ False positive rate: ~5-10%
- ⏱️ Processing time: ~15-25 seconds
- 📊 Speaker extraction success rate: ~70-80%
- 🎯 Relevant speakers found: 60-70%

## Code Quality Notes

### Maintainability
- Move validation logic to separate module: `src/lib/speaker-validation.ts`
- Create speaker extraction config: `SPEAKER_EXTRACTION_CONFIG`
- Add comprehensive logging with structured data
- Add unit tests for validation functions

### Performance
- Consider caching speaker extractions by URL
- Add metrics collection for optimization tracking
- Implement adaptive timeout based on content size
- Add circuit breaker for failing Gemini calls

### Error Handling
- Better handling of partial speaker data
- Graceful degradation when Gemini fails
- Clear error messages for debugging
- Fallback to manual extraction with quality scores

## Next Steps

1. **Implement Phase 1 optimizations** (this session)
2. **Test with real events** from current search results
3. **Monitor Vercel logs** for improvements
4. **Iterate based on results**
5. **Implement Phase 2** if needed

## Questions to Consider

1. **Should we extract speakers from event descriptions/bios even if no dedicated speaker page?**
   - Pros: More data
   - Cons: Lower quality, more noise

2. **Should we prioritize keynote speakers over session speakers?**
   - Pros: Higher value targets
   - Cons: May miss important speakers

3. **How aggressive should validation be?**
   - Current: Very strict (may miss some real speakers)
   - Alternative: More lenient with confidence scoring

4. **Should we enrich speaker data post-extraction?**
   - LinkedIn lookup
   - Company website scraping
   - Social media profiles

