# Smart Chunking Implementation Plan

## Objective
Replace generic fixed-size chunking (1200 chars) with intelligent chunking that focuses on speaker-dense sections, reducing noise and improving extraction quality.

---

## Current State Analysis

### Existing Chunking Logic
**Location**: `src/lib/event-analysis.ts` (lines ~934-940)

```typescript
const sectionChunks = crawlResults.flatMap(result => {
  const sectionText = `Page: ${result.title || 'Unknown'}\nURL: ${result.url}\nContent:\n${result.content || ''}`;
  return chunkText(sectionText, 1200, 150).slice(0, 2);
});

const chunks = sectionChunks.slice(0, 6);
```

### Problems with Current Approach
1. **Treats all content equally** - Navigation = Speaker bios = Footer links
2. **Fixed chunk size** - Doesn't adapt to content density
3. **May split speaker info** - A speaker's bio could be split across 2 chunks
4. **Includes noise** - Menus, footers, cookie banners sent to Gemini
5. **Wastes tokens** - Generic content consumes valuable token budget

### Example of Current Behavior
```
Chunk 1 (1200 chars):
  [Navigation: Home | About | Contact | Speakers]
  [Cookie Banner: We use cookies...]
  [Header: Welcome to Conference 2025]
  [First 3 paragraphs of intro text]
  [Start of speaker section...]

Chunk 2 (1200 chars):
  [...continuation of speaker 1 bio - SPLIT!]
  [Speaker 2: Full bio]
  [Speaker 3: Partial bio - SPLIT!]
  [Footer: Copyright 2025...]
```

**Result**: Speaker 1 and 3 split across chunks, lots of noise.

---

## Proposed Solution: Smart Chunking

### High-Level Strategy

```
1. Content Analysis Phase
   ├─ Identify speaker sections in content
   ├─ Score sections by speaker density
   └─ Extract high-value sections

2. Smart Chunking Phase
   ├─ If speaker sections found:
   │  ├─ Chunk speaker sections separately (smaller, focused)
   │  └─ Use 800 chars with 100 overlap (tighter)
   └─ Else (fallback):
       └─ Use current generic chunking (1200 chars, 150 overlap)

3. Validation Phase
   └─ Ensure minimum content quality
```

---

## Implementation Plan

### Phase 1: Speaker Section Detection (20 minutes)

#### 1.1 Section Header Detection
**Goal**: Find headings that indicate speaker sections

```typescript
function detectSpeakerSectionHeaders(content: string): Array<{
  index: number;
  text: string;
  type: 'primary' | 'secondary';
}> {
  const headers = [];
  
  // Markdown heading patterns
  const primaryHeadingPatterns = [
    /^#{1,2}\s*(Speakers?|Presenters?|Faculty|Keynote|Panelists?)/im,
    /^#{1,2}\s*(Referenten?|Sprecher|Moderatoren?)/im,  // German
    /^#{1,2}\s*(Featured|Guest)\s+(Speakers?|Presenters?)/im
  ];
  
  const secondaryHeadingPatterns = [
    /^#{3,4}\s*([A-Z][a-z]+ [A-Z][a-z]+)/m,  // Person names as H3/H4
    /^\*\*([A-Z][a-z]+ [A-Z][a-z]+)\*\*/m     // Bold person names
  ];
  
  // Find all matches with their positions
  // Return sorted by position
}
```

**Detection Signals**:
- ✅ Markdown headers: `## Speakers`, `### Keynote Speakers`
- ✅ Section titles: `**Featured Speakers**`, `Our Presenters:`
- ✅ German variants: `Referenten`, `Sprecher`
- ✅ Subsections: `Conference Speakers`, `Workshop Leaders`

#### 1.2 Content Pattern Recognition
**Goal**: Identify speaker-like content patterns

```typescript
function detectSpeakerContentPatterns(text: string): {
  speakerNameCount: number;
  titleCount: number;
  organizationCount: number;
  bioIndicators: number;
  density: number;  // speakers per 1000 chars
} {
  // Pattern: Name (Title Case) + Job Title + Company
  // Example: "John Smith, CEO at TechCorp, brings 20 years..."
  
  const patterns = {
    personName: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    jobTitle: /\b(CEO|CTO|Director|Manager|Head of|VP|President|Partner|Founder)\b/gi,
    organization: /\bat [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g,
    bioIndicators: /\b(experience|expert|specializes|background|works at|responsible for)\b/gi
  };
  
  // Calculate density score
  const speakerDensity = (matches / text.length) * 1000;
  
  return { speakerNameCount, titleCount, organizationCount, bioIndicators, density };
}
```

**Recognition Patterns**:
- Person names (Title Case)
- Job titles nearby
- Company/organization mentions
- Bio keywords: "experience", "expert", "specializes"

#### 1.3 Section Extraction
**Goal**: Extract speaker-rich sections with boundaries

```typescript
function extractSpeakerSections(content: string): Array<{
  startIndex: number;
  endIndex: number;
  heading: string;
  content: string;
  score: number;
}> {
  const sections = [];
  const lines = content.split('\n');
  
  let currentSection = null;
  let currentHeading = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line is a speaker section header
    if (isSpeakerHeader(line)) {
      // Save previous section if exists
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // Start new section
      currentHeading = line;
      currentSection = {
        startIndex: i,
        heading: line,
        lines: []
      };
    } 
    // Check if we hit a non-speaker section (end current)
    else if (isNonSpeakerHeader(line) && currentSection) {
      sections.push(currentSection);
      currentSection = null;
    }
    // Add line to current section
    else if (currentSection) {
      currentSection.lines.push(line);
    }
  }
  
  // Score and filter sections
  return sections
    .map(section => ({
      ...section,
      content: section.lines.join('\n'),
      score: scoreSectionQuality(section.lines.join('\n'))
    }))
    .filter(section => section.score > 0.3)  // Quality threshold
    .sort((a, b) => b.score - a.score);
}
```

**Quality Scoring**:
```typescript
function scoreSectionQuality(content: string): number {
  const patterns = detectSpeakerContentPatterns(content);
  
  let score = 0;
  
  // Strong signals
  if (patterns.speakerNameCount >= 2) score += 0.4;
  if (patterns.titleCount >= 2) score += 0.3;
  if (patterns.organizationCount >= 1) score += 0.2;
  
  // Density bonus
  if (patterns.density > 5) score += 0.2;  // 5+ speakers per 1000 chars
  
  // Noise penalties
  if (content.includes('Register Now')) score -= 0.2;
  if (content.includes('Cookie')) score -= 0.1;
  if (content.length < 200) score -= 0.3;  // Too short
  
  return Math.max(0, Math.min(1, score));  // Clamp 0-1
}
```

---

### Phase 2: Smart Chunking Logic (20 minutes)

#### 2.1 Adaptive Chunking Strategy

```typescript
function createSmartChunks(
  crawlResults: CrawlResult[],
  options: {
    preferredChunkSize: number;
    maxChunks: number;
    minChunkSize: number;
  }
): string[] {
  const allSections: SpeakerSection[] = [];
  
  // Extract speaker sections from all crawl results
  for (const result of crawlResults) {
    const sections = extractSpeakerSections(result.content || '');
    allSections.push(...sections.map(s => ({
      ...s,
      sourceUrl: result.url,
      sourceTitle: result.title
    })));
  }
  
  // Sort by quality score
  const sortedSections = allSections.sort((a, b) => b.score - a.score);
  
  if (sortedSections.length > 0) {
    console.log(`[smart-chunking] Found ${sortedSections.length} speaker sections`);
    return chunkSpeakerSections(sortedSections, options);
  } else {
    console.log('[smart-chunking] No speaker sections found, using generic chunking');
    return fallbackToGenericChunking(crawlResults, options);
  }
}
```

#### 2.2 Speaker-Focused Chunking

```typescript
function chunkSpeakerSections(
  sections: SpeakerSection[],
  options: ChunkOptions
): string[] {
  const chunks: string[] = [];
  
  for (const section of sections) {
    // For speaker sections, use smaller chunks to avoid splitting bios
    const sectionChunks = chunkText(
      section.content,
      800,   // Smaller than generic (was 1200)
      100    // Less overlap (was 150)
    );
    
    // Add context to each chunk
    const contextualChunks = sectionChunks.map((chunk, i) => 
      `Section: ${section.heading}\nURL: ${section.sourceUrl}\n\n${chunk}`
    );
    
    chunks.push(...contextualChunks);
    
    if (chunks.length >= options.maxChunks) {
      break;
    }
  }
  
  console.log(`[smart-chunking] Created ${chunks.length} speaker-focused chunks`);
  return chunks.slice(0, options.maxChunks);
}
```

**Chunking Strategy**:
- **Speaker sections**: 800 chars, 100 overlap (tighter focus)
- **Generic content**: 1200 chars, 150 overlap (current)
- **Rationale**: Speaker bios are typically 300-600 chars, so 800-char chunks keep them intact

#### 2.3 Boundary-Aware Chunking

```typescript
function smartChunkText(
  text: string,
  targetSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);  // Split by paragraph breaks
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // Would adding this paragraph exceed target size?
    if (currentChunk.length + paragraph.length > targetSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap (last N chars of previous chunk)
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + '\n\n' + paragraph;
    } else {
      // Add to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
```

**Benefits**:
- Respects paragraph boundaries
- Never splits a speaker bio mid-sentence
- Natural chunk breaks

---

### Phase 3: Integration & Fallback (10 minutes)

#### 3.1 Integration Point

**Location**: `src/lib/event-analysis.ts` in `extractAndEnhanceSpeakers()` function

**Current Code** (lines ~934-940):
```typescript
const sectionChunks = crawlResults.flatMap(result => {
  const sectionText = `Page: ${result.title || 'Unknown'}\nURL: ${result.url}\nContent:\n${result.content || ''}`;
  return chunkText(sectionText, 1200, 150).slice(0, 2);
});

const chunks = sectionChunks.slice(0, 6);
```

**Replace With**:
```typescript
// Smart chunking with fallback
const chunks = createSmartChunks(crawlResults, {
  preferredChunkSize: 800,  // For speaker sections
  maxChunks: 6,
  minChunkSize: 200
});

console.log('[smart-chunking] Chunk strategy:', {
  totalChunks: chunks.length,
  avgChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length),
  strategy: chunks[0]?.includes('Section:') ? 'speaker-focused' : 'generic'
});
```

#### 3.2 Fallback Strategy

```typescript
function fallbackToGenericChunking(
  crawlResults: CrawlResult[],
  options: ChunkOptions
): string[] {
  console.log('[smart-chunking] Falling back to generic chunking');
  
  // Use current approach as fallback
  const sectionChunks = crawlResults.flatMap(result => {
    const sectionText = `Page: ${result.title || 'Unknown'}\nURL: ${result.url}\nContent:\n${result.content || ''}`;
    return chunkText(sectionText, 1200, 150).slice(0, 2);
  });
  
  return sectionChunks.slice(0, options.maxChunks);
}
```

**Fallback Triggers**:
- No speaker sections detected (score < 0.3)
- All sections too short (< 200 chars)
- Content is mostly navigation/menus
- Error during smart chunking

---

## Code Structure

### New Functions to Add

```typescript
// Section Detection
function detectSpeakerSectionHeaders(content: string): SectionHeader[]
function detectSpeakerContentPatterns(text: string): ContentPatterns
function extractSpeakerSections(content: string): SpeakerSection[]
function scoreSectionQuality(content: string): number

// Smart Chunking
function createSmartChunks(crawlResults: CrawlResult[], options: ChunkOptions): string[]
function chunkSpeakerSections(sections: SpeakerSection[], options: ChunkOptions): string[]
function smartChunkText(text: string, targetSize: number, overlap: number): string[]
function fallbackToGenericChunking(crawlResults: CrawlResult[], options: ChunkOptions): string[]

// Utilities
function isSpeakerHeader(line: string): boolean
function isNonSpeakerHeader(line: string): boolean
```

### New Interfaces

```typescript
interface SectionHeader {
  index: number;
  text: string;
  type: 'primary' | 'secondary';
}

interface ContentPatterns {
  speakerNameCount: number;
  titleCount: number;
  organizationCount: number;
  bioIndicators: number;
  density: number;
}

interface SpeakerSection {
  startIndex: number;
  endIndex: number;
  heading: string;
  content: string;
  score: number;
  sourceUrl?: string;
  sourceTitle?: string;
}

interface ChunkOptions {
  preferredChunkSize: number;
  maxChunks: number;
  minChunkSize: number;
}
```

---

## Testing Strategy

### Unit Tests
```typescript
describe('Smart Chunking', () => {
  it('should detect speaker section headers', () => {
    const content = '## Speakers\nJohn Smith...';
    const headers = detectSpeakerSectionHeaders(content);
    expect(headers.length).toBeGreaterThan(0);
  });
  
  it('should score speaker-dense sections higher', () => {
    const highDensity = 'John Smith, CEO at TechCorp. Jane Doe, CTO at StartupX.';
    const lowDensity = 'Welcome to our website. Click here to register.';
    
    const patterns1 = detectSpeakerContentPatterns(highDensity);
    const patterns2 = detectSpeakerContentPatterns(lowDensity);
    
    expect(patterns1.density).toBeGreaterThan(patterns2.density);
  });
  
  it('should chunk at paragraph boundaries', () => {
    const text = 'Para 1\n\nPara 2\n\nPara 3';
    const chunks = smartChunkText(text, 20, 5);
    
    // Should not split paragraphs
    chunks.forEach(chunk => {
      expect(chunk).not.toMatch(/Para \d\nPara/);
    });
  });
  
  it('should fall back to generic chunking when no speakers found', () => {
    const content = 'Privacy Policy\nCookie Settings\nContact Us';
    const crawlResults = [{ url: 'test', content, title: 'Test' }];
    
    const chunks = createSmartChunks(crawlResults, {
      preferredChunkSize: 800,
      maxChunks: 6,
      minChunkSize: 200
    });
    
    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests
```typescript
describe('Smart Chunking Integration', () => {
  it('should process real speaker page', async () => {
    const mockCrawlResult = {
      url: 'https://event.com/speakers',
      title: 'Conference Speakers',
      content: `
        ## Featured Speakers
        
        Dr. Sarah Johnson, Chief Data Officer at TechCorp
        Sarah has over 15 years of experience in data science...
        
        Michael Schmidt, Partner at Legal Associates
        Michael specializes in compliance and regulatory law...
      `
    };
    
    const chunks = createSmartChunks([mockCrawlResult], {
      preferredChunkSize: 800,
      maxChunks: 6,
      minChunkSize: 200
    });
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toContain('Featured Speakers');
    expect(chunks[0]).toContain('Sarah Johnson');
  });
});
```

### Manual Testing Checklist
- [ ] Test with actual event pages (DIC, E-Discovery Day, etc.)
- [ ] Compare chunks before/after smart chunking
- [ ] Verify speaker bios aren't split
- [ ] Check fallback works when no speakers detected
- [ ] Monitor Gemini extraction quality improvement
- [ ] Verify performance (should not be slower)

---

## Performance Considerations

### Time Complexity
- **Section detection**: O(n) where n = content length
- **Pattern matching**: O(n) with regex
- **Chunking**: O(n) with smart boundaries
- **Overall**: Same as current approach (~1-2s)

### Memory
- **Additional memory**: Minimal (section metadata)
- **Chunk storage**: Same as current (6 chunks max)
- **No significant impact**: Chunks are streamed to Gemini

### Optimization Opportunities
```typescript
// Cache pattern regexes (compile once)
const SPEAKER_HEADER_REGEX = /^#{1,2}\s*(Speakers?|Presenters?)/im;

// Lazy section scoring (only score top N by length)
function lazyScoreSections(sections: SpeakerSection[]): SpeakerSection[] {
  return sections
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, 10)  // Only score top 10 by length
    .map(s => ({ ...s, score: scoreSectionQuality(s.content) }))
    .filter(s => s.score > 0.3);
}
```

---

## Expected Impact

### Before Smart Chunking
```
Chunk 1: [Nav] [Cookie Banner] [Header] [Intro] [Start speaker 1...]
Chunk 2: [...speaker 1 cont] [Speaker 2] [Speaker 3 partial...] [Footer]
Chunk 3: [...speaker 3 cont] [Sponsors] [Register CTA]

Gemini sees: 40% speakers, 60% noise
Extraction quality: Medium
```

### After Smart Chunking
```
Chunk 1: [Section: Keynote Speakers] [Speaker 1 full bio] [Speaker 2 full bio]
Chunk 2: [Section: Panel Speakers] [Speaker 3 full bio] [Speaker 4 full bio]
Chunk 3: [Section: Workshop Leaders] [Speaker 5 full bio]

Gemini sees: 90% speakers, 10% context
Extraction quality: High
```

### Metrics
- **Noise reduction**: 60% → 10% (6x cleaner)
- **Speaker bio completeness**: 70% → 95% (less splitting)
- **Extraction accuracy**: +20-30% improvement
- **False positives**: Further reduced (less noise to misinterpret)

---

## Rollout Plan

### Phase 1: Implementation (1 hour)
1. Add detection functions (20 min)
2. Add smart chunking logic (20 min)
3. Integrate with existing code (10 min)
4. Add logging for debugging (10 min)

### Phase 2: Testing (30 minutes)
1. Unit tests for detection
2. Integration tests with mock data
3. Manual testing with real events
4. Compare extraction quality

### Phase 3: Monitoring (Ongoing)
1. Log chunk strategy used (speaker-focused vs generic)
2. Track section detection rate
3. Monitor extraction quality improvement
4. A/B test if needed

---

## Risk Mitigation

### Risks
1. **Over-aggressive detection** - Misidentifies non-speaker sections
2. **Under-detection** - Misses speaker sections with unusual formatting
3. **Performance regression** - Takes longer than current approach
4. **Compatibility** - Breaks with non-English content

### Mitigations
1. **Conservative scoring threshold** (0.3) with logging
2. **Fallback to generic chunking** if detection fails
3. **Early performance benchmarking** and optimization
4. **Multilingual patterns** (German, French support)

---

## Success Criteria

✅ **Must Have**:
- [ ] No performance regression (< 2s additional processing)
- [ ] Fallback works correctly
- [ ] No errors/crashes
- [ ] Extraction quality >= current baseline

✅ **Should Have**:
- [ ] 20%+ improvement in speaker extraction accuracy
- [ ] Fewer false positives from noise
- [ ] Speaker bios not split across chunks
- [ ] Logging shows detection working

✅ **Nice to Have**:
- [ ] 30%+ improvement in extraction accuracy
- [ ] Works with non-English content
- [ ] Adaptive chunk sizes based on content
- [ ] Detection confidence scores logged

---

## Decision Points

### 1. Scoring Threshold
**Question**: What minimum score qualifies as a "speaker section"?

**Options**:
- Conservative (0.5): High precision, may miss some sections
- Moderate (0.3): **Recommended** - Balance of precision/recall
- Aggressive (0.2): High recall, may include noise

**Recommendation**: Start with 0.3, tune based on testing

### 2. Chunk Size
**Question**: What size for speaker-focused chunks?

**Options**:
- Tight (600 chars): Fits 1-2 speaker bios, very focused
- Medium (800 chars): **Recommended** - Fits 2-3 bios
- Loose (1000 chars): Fits 3-4 bios, may include noise

**Recommendation**: 800 chars (current is 1200 for generic)

### 3. Fallback Behavior
**Question**: When should we fall back to generic chunking?

**Options**:
- Strict: Only if zero sections detected
- Moderate: **Recommended** - If sections score < 0.3
- Lenient: If sections < 20% of total content

**Recommendation**: Moderate - maintains quality bar

---

## Next Steps

### To Implement (When Approved)
1. ✅ Create new functions in `src/lib/event-analysis.ts`
2. ✅ Add interfaces and types
3. ✅ Replace current chunking call
4. ✅ Add logging
5. ✅ Test with real data
6. ✅ Monitor results

### To Discuss
1. Should we combine Smart Chunking with Content Pre-Filtering?
2. Do we want A/B testing capability?
3. Should detection be configurable (strict/moderate/lenient)?

---

## Estimated Timeline

- **Implementation**: 1 hour
- **Testing**: 30 minutes  
- **Deployment**: 5 minutes
- **Total**: 1.5 hours

**Ready to implement upon approval** ✅

