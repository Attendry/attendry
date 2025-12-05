# Research Grounding Improvements

## Issues Identified

### 1. **Hallucinations in Research**
- **Problem**: The research function was asking Gemini to generate information without actual web search, leading to fabricated facts
- **Root Cause**: No grounding - just prompting Gemini to "find" information without providing real sources
- **Impact**: Generated drafts contained made-up information that couldn't be verified

### 2. **Draft Saving Issues**
- **Problem**: Drafts weren't being saved properly
- **Root Cause**: Missing user_id check in update query, potential security/RLS issues
- **Impact**: Users couldn't persist their generated drafts

### 3. **Unstable Model**
- **Problem**: Using `gemini-2.0-flash-exp` (experimental model)
- **Impact**: Unpredictable behavior, potential API changes, less reliable outputs

## Solutions Implemented

### 1. **Fact-Grounded Research** ✅
- **Before**: Gemini generates information from its training data (hallucinations)
- **After**: 
  1. First performs actual web search using Google Custom Search Engine (CSE)
  2. Collects real search results with titles, snippets, and URLs
  3. Passes those results to Gemini for synthesis
  4. Gemini can ONLY use information from provided sources
  5. All facts are traceable to source URLs

**Key Changes:**
```typescript
// STEP 1: Perform actual web search
const searchQueries = [
  `${name} ${company}`,
  `"${name}" "${company}"`,
  // ... more queries
];

// STEP 2: Synthesize search results with strict rules
const prompt = `
IMPORTANT RULES:
1. ONLY use information explicitly stated in search results
2. DO NOT make up, infer, or assume information
3. Cite specific sources when mentioning facts
4. If information not available, say "Information not found"
`;
```

### 2. **Improved Draft Saving** ✅
- Added `user_id` check to update query for security
- Added logging to debug save operations
- Better error handling

### 3. **Stable Model** ✅
- Switched from `gemini-2.0-flash-exp` to `gemini-1.5-flash`
- More reliable, production-ready model
- Better consistency in outputs

## Current Model Usage

**Model**: `gemini-1.5-flash`
- **Type**: Stable production model
- **Use Case**: Fast, efficient text generation
- **Alternatives Considered**:
  - `gemini-1.5-pro`: Better for complex reasoning, but slower
  - `gemini-2.0-flash-exp`: Experimental, not recommended for production

## Requirements

For fact-grounded research to work, you need:
1. ✅ `GEMINI_API_KEY` - For AI synthesis
2. ✅ `GOOGLE_CSE_KEY` - For web search
3. ✅ `GOOGLE_CSE_CX` - For web search

If Google CSE keys are missing, the system will:
- Return a message indicating no search results found
- Not generate hallucinated information
- Suggest checking LinkedIn directly

## Verification

All research now includes:
- ✅ Source URLs for every fact mentioned
- ✅ Search result titles and snippets
- ✅ Traceable information (can verify each claim)
- ✅ Clear indication when information is not available

## Recommendations

### Short-term
1. ✅ **DONE**: Implement fact-grounded research
2. ✅ **DONE**: Switch to stable model
3. ✅ **DONE**: Fix draft saving

### Medium-term
1. **Add Firecrawl Integration**: For deeper content extraction from source URLs
2. **Cache Search Results**: Avoid duplicate searches for same contact
3. **Add Source Verification**: Highlight which facts come from which sources in UI
4. **Rate Limiting**: Implement proper rate limiting for Google CSE API

### Long-term
1. **Multi-Source Research**: Combine Google CSE, LinkedIn API, company websites
2. **Fact Extraction**: Use structured extraction to pull specific facts (job titles, achievements, etc.)
3. **Update Monitoring**: Automatically re-search contacts periodically
4. **Confidence Scoring**: Rate research quality based on source reliability

## Testing

To verify the improvements:

1. **Test Research**:
   - Add a well-known contact (e.g., "Tim Cook Apple")
   - Check that research includes actual source URLs
   - Verify facts can be traced to sources

2. **Test Draft Saving**:
   - Generate a draft
   - Check browser console for save confirmation logs
   - Refresh page - draft should persist

3. **Test Hallucination Prevention**:
   - Add a contact with minimal online presence
   - Research should say "Information not found" rather than making up facts

## Notes

- The research function now takes longer (web search + synthesis) but is much more accurate
- If Google CSE quota is exceeded, research will gracefully fail with a clear message
- All source links are stored in `contact_research.grounding_links` for future reference

