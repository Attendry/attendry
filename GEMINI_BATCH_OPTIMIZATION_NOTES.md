# Gemini 2.5 Flash Batch Optimization - Technical Notes

**Date:** 2025-11-15  
**Based on:** Gemini 2.5 Flash Documentation Review

---

## Key Findings

### Gemini API Architecture

1. **No Native Batch API**
   - Gemini doesn't have a separate batch endpoint
   - Instead, combine multiple items into a single prompt
   - Use the large context window (1M tokens) to include many chunks

2. **Large Context Window**
   - **Gemini 2.5 Flash:** 1,048,576 input tokens
   - Can handle extensive datasets in a single call
   - Perfect for batching multiple chunks/events

3. **Structured JSON Responses**
   - Gemini 2.5 Flash supports `responseSchema` for structured output
   - Already used in `extractAndEnhanceSpeakers()` 
   - Can request array of results in single call

4. **Existing Pattern**
   - `BatchGeminiService.processUrlPrioritizationBatch()` already implements this pattern
   - Combines multiple URLs into single prompt
   - Returns structured JSON with results for all items

---

## Implementation Approach

### Current Flow (Sequential API Calls)

```
Event 1: Chunk 1 → Gemini API Call 1 (2-3s)
         Chunk 2 → Gemini API Call 2 (2-3s)
         Chunk 3 → Gemini API Call 3 (2-3s)
Event 2: Chunk 1 → Gemini API Call 4 (2-3s)
         Chunk 2 → Gemini API Call 5 (2-3s)
         ...
Total: 10-15 API calls × 2-3s = 20-45s
```

### Optimized Flow (Single Batch Call)

```
All Events: [Chunk 1, Chunk 2, ..., Chunk N] → Single Gemini API Call (2-3s)
            ↓
            Parse JSON response
            ↓
            Distribute results to events
Total: 1 API call × 2-3s = 2-3s
```

---

## Prompt Structure

### Batch Metadata Extraction Prompt

```typescript
const batchPrompt = `Extract event metadata from the following chunks.
Each chunk is labeled with its event index and chunk index.

CHUNKS:
${allChunks.map((c, idx) => `
--- Event ${c.eventIdx}, Chunk ${c.chunkIdx} (Index ${idx}) ---
URL: ${c.url}
Content:
${c.chunk}
`).join('\n')}

Return JSON array with metadata for each chunk:
[
  {
    "chunkIndex": 0,
    "eventIndex": 0,
    "metadata": {
      "title": "...",
      "date": "...",
      "location": "...",
      "organizer": "...",
      "website": "...",
      "description": "..."
    }
  },
  {
    "chunkIndex": 1,
    "eventIndex": 0,
    "metadata": { ... }
  },
  ...
]`;
```

### Batch Speaker Extraction Prompt

```typescript
const batchPrompt = `Extract speakers from the following chunks.
Each chunk is labeled with its event index and chunk index.

CHUNKS:
${allChunks.map((c, idx) => `
--- Event ${c.eventIdx}, Chunk ${c.chunkIdx} (Index ${idx}) ---
URL: ${c.url}
Content:
${c.chunk}
`).join('\n')}

Return JSON array with speakers for each chunk:
[
  {
    "chunkIndex": 0,
    "eventIndex": 0,
    "speakers": [
      {
        "name": "Dr. Sarah Johnson",
        "title": "General Counsel",
        "company": "ABC Corporation",
        "bio": "..."
      },
      ...
    ]
  },
  ...
]`;
```

---

## Response Schema

### Batch Metadata Schema

```typescript
const batchMetadataSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      chunkIndex: { type: 'number' },
      eventIndex: { type: 'number' },
      metadata: {
        type: 'object',
        properties: {
          title: { type: 'string', nullable: true },
          date: { type: 'string', nullable: true },
          location: { type: 'string', nullable: true },
          organizer: { type: 'string', nullable: true },
          website: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true }
        }
      }
    },
    required: ['chunkIndex', 'eventIndex', 'metadata']
  }
};
```

### Batch Speaker Schema

```typescript
const batchSpeakerSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      chunkIndex: { type: 'number' },
      eventIndex: { type: 'number' },
      speakers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            title: { type: 'string', nullable: true },
            company: { type: 'string', nullable: true },
            bio: { type: 'string', nullable: true }
          },
          required: ['name']
        }
      }
    },
    required: ['chunkIndex', 'eventIndex', 'speakers']
  }
};
```

---

## Token Management

### Token Estimation

**Per Chunk:**
- Chunk content: ~2000-5000 tokens
- Prompt overhead: ~100 tokens
- Response: ~200-500 tokens

**Batch Size:**
- 4 events × 6 chunks = 24 chunks
- Total input: ~48,000-120,000 tokens
- Total output: ~4,800-12,000 tokens
- **Well within 1M token limit** ✅

### Token Monitoring

```typescript
// Monitor token usage
const estimatedInputTokens = allChunks.reduce((sum, c) => 
  sum + estimateTokens(c.chunk), 0
);

if (estimatedInputTokens > 800000) { // 80% of limit
  console.warn('Batch size approaching token limit, splitting...');
  // Split into smaller batches
}
```

---

## Error Handling

### Fallback Strategy

```typescript
try {
  // Attempt batch processing
  const batchResults = await processBatch(allChunks);
  return batchResults;
} catch (error) {
  console.error('Batch processing failed, falling back to individual calls:', error);
  
  // Fallback to current parallel approach
  const chunkPromises = chunks.map((chunk, i) => 
    processMetadataChunk(chunk, i)
  );
  const chunkResults = await Promise.allSettled(chunkPromises);
  return chunkResults;
}
```

### Partial Failure Handling

```typescript
// If batch response is incomplete, fill gaps with individual calls
const batchResults = await processBatch(allChunks);
const missingChunks = identifyMissingResults(batchResults, allChunks);

if (missingChunks.length > 0) {
  console.warn(`Batch processing missed ${missingChunks.length} chunks, processing individually...`);
  const individualResults = await processChunksIndividually(missingChunks);
  mergeResults(batchResults, individualResults);
}
```

---

## Performance Considerations

### Benefits

1. **Reduced API Calls**
   - Current: N chunks = N API calls
   - Optimized: N chunks = 1 API call
   - **Reduction:** 10-15 calls → 1 call

2. **Reduced Latency**
   - Current: N × (API latency + processing time)
   - Optimized: 1 × (API latency + processing time)
   - **Reduction:** ~80-85% faster

3. **Better Context**
   - Gemini sees all chunks together
   - Can make better cross-chunk inferences
   - More consistent extraction

### Risks

1. **Token Limits**
   - Mitigation: Monitor token usage, split if needed
   - Current chunks well within limits

2. **Response Parsing**
   - Mitigation: Use structured schema, validate response
   - Fallback to individual calls on parse failure

3. **Partial Failures**
   - Mitigation: Identify missing results, fill gaps individually
   - Quality gate ensures data completeness

---

## Testing Strategy

### Unit Tests

```typescript
describe('Batch Metadata Extraction', () => {
  it('should combine multiple chunks into single call', async () => {
    const chunks = [/* test chunks */];
    const result = await extractMetadataBatch(chunks);
    expect(result).toHaveLength(chunks.length);
  });

  it('should correctly map results to chunks', async () => {
    const chunks = [/* test chunks */];
    const result = await extractMetadataBatch(chunks);
    chunks.forEach((chunk, idx) => {
      expect(result[idx].chunkIndex).toBe(idx);
    });
  });

  it('should fallback on batch failure', async () => {
    // Mock batch failure
    // Verify fallback to individual calls
  });
});
```

### Integration Tests

```typescript
describe('Batch Extraction Integration', () => {
  it('should extract metadata for 4 events with 6 chunks each', async () => {
    const events = [/* test events */];
    const startTime = Date.now();
    const results = await extractMetadataBatch(events);
    const duration = Date.now() - startTime;
    
    expect(results).toHaveLength(events.length);
    expect(duration).toBeLessThan(5000); // Should be <5s
  });
});
```

---

## Monitoring

### Metrics to Track

1. **Batch Size**
   - Number of chunks per batch
   - Average tokens per batch

2. **Performance**
   - Batch processing time
   - Individual fallback rate
   - Token usage

3. **Quality**
   - Extraction completeness
   - Error rate
   - Fallback frequency

### Alerts

- Batch failure rate > 5%
- Token usage > 80% of limit
- Processing time > 5s
- Fallback rate > 10%

---

## References

1. **Gemini 2.5 Flash Documentation**
   - Context window: 1,048,576 tokens
   - Structured JSON responses via `responseSchema`
   - Cost-efficient for large batches

2. **Existing Implementation**
   - `BatchGeminiService.processUrlPrioritizationBatch()`
   - Pattern: Combine items → Single prompt → Parse results

3. **Current Code**
   - `src/lib/event-analysis.ts` - `extractEventMetadata()`
   - `src/lib/event-analysis.ts` - `extractAndEnhanceSpeakers()`
   - `src/lib/services/batch-gemini-service.ts` - Reference implementation

---

**Last Updated:** 2025-11-15

