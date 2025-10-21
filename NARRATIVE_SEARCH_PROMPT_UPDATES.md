# Narrative Search Prompt Updates Required

## 🎯 **Overview**
This document lists all Gemini prompts that need updates to work optimally with narrative search results from Firecrawl.

## 📋 **Prompts Requiring Updates**

### **1. Event Prioritization Prompts**
**Files to Update:**
- `src/lib/prompts/gemini-prompts.ts` - `createEventPrioritizationPrompt()` ✅ **COMPLETED**
- `src/lib/optimized-orchestrator.ts` - `prioritizeWithGemini()` 
- `src/lib/calendar-analysis.ts` - Event prioritization logic

**Current Status:** ✅ **UPDATED** - Added "industry events" focus

**Required Changes:**
- Update to handle narrative search results (more contextual URLs)
- Emphasize business relevance over keyword matching
- Add focus on professional development and industry events

### **2. Speaker Extraction Prompts**
**Files to Update:**
- `src/lib/prompts/gemini-prompts.ts` - `createSpeakerExtractionPrompt()` ✅ **COMPLETED**
- `src/lib/event-analysis.ts` - `extractAndEnhanceSpeakers()` ❌ **NEEDS UPDATE**
- `src/app/api/events/analyze/route.ts` - `extractAndEnhanceSpeakers()` ❌ **NEEDS UPDATE**
- `src/lib/services/batch-gemini-service.ts` - `buildSpeakerExtractionBatchPrompt()` ❌ **NEEDS UPDATE**

**Current Status:** ✅ **PARTIALLY UPDATED** - Main prompt updated, legacy prompts need updates

**Required Changes:**
- Update legacy prompts to use new prompt management system
- Add focus on business professionals and industry experts
- Emphasize keynote speakers and panelists
- Update to handle narrative search results (more contextual content)

### **3. Event Metadata Extraction Prompts**
**Files to Update:**
- `src/lib/prompts/gemini-prompts.ts` - `createEventMetadataPrompt()` ❌ **NEEDS UPDATE**
- `src/lib/calendar-analysis.ts` - `extractCalendarEventMetadata()` ❌ **NEEDS UPDATE**
- `src/app/api/events/analyze/route.ts` - `extractEventMetadata()` ❌ **NEEDS UPDATE**

**Current Status:** ❌ **NEEDS UPDATE** - Not yet updated for narrative search

**Required Changes:**
- Update to handle narrative search results (more contextual content)
- Emphasize business event metadata
- Add focus on professional development events

### **4. Speaker Enhancement Prompts**
**Files to Update:**
- `src/lib/prompts/gemini-prompts.ts` - `createSpeakerEnhancementPrompt()` ❌ **NEEDS UPDATE**
- `src/lib/optimized-orchestrator.ts` - `enhanceSpeakersWithGemini()` ❌ **NEEDS UPDATE**
- `src/app/api/events/speakers/route.ts` - `enrichSpeakersWithGemini()` ❌ **NEEDS UPDATE**

**Current Status:** ❌ **NEEDS UPDATE** - Not yet updated for narrative search

**Required Changes:**
- Update to handle narrative search results (more contextual speaker data)
- Emphasize business professional enhancement
- Add focus on industry expertise and connections

### **5. Content Filtering Prompts**
**Files to Update:**
- `src/lib/prompts/gemini-prompts.ts` - `createContentFilterPrompt()` ❌ **NEEDS UPDATE**

**Current Status:** ❌ **NEEDS UPDATE** - Not yet updated for narrative search

**Required Changes:**
- Update to handle narrative search results (more contextual content)
- Emphasize business and professional content filtering

## 🔧 **Implementation Priority**

### **High Priority (Critical for Narrative Search)**
1. ✅ **Event Prioritization** - COMPLETED
2. ❌ **Speaker Extraction (Legacy)** - Update legacy prompts to use new system
3. ❌ **Event Metadata Extraction** - Update for narrative search context

### **Medium Priority (Important for Quality)**
4. ❌ **Speaker Enhancement** - Update for narrative search results
5. ❌ **Content Filtering** - Update for narrative search context

### **Low Priority (Nice to Have)**
6. ❌ **Batch Processing** - Update batch prompts for narrative search
7. ❌ **Calendar Analysis** - Update calendar-specific prompts

## 📝 **Update Template**

For each prompt that needs updating, follow this pattern:

```typescript
// OLD: Keyword-focused prompt
const prompt = `Extract speakers from this content...`;

// NEW: Narrative search-optimized prompt  
const prompt = `Extract speakers from this business event content:

${content}

Return JSON: {"speakers": [{"name": "Full Name", "title": "Job Title", "company": "Company Name"}]}

Look for: ${SPEAKER_TERMS.german.slice(0, 5).join(", ")} or ${SPEAKER_TERMS.english.slice(0, 5).join(", ")}
Focus on: business professionals, industry experts, keynote speakers, panelists
Max ${maxSpeakers} speakers.`;
```

## 🎯 **Key Changes for All Prompts**

1. **Add business focus** - Emphasize professional and business context
2. **Update for narrative results** - Handle more contextual content from narrative search
3. **Use new prompt system** - Migrate to `src/lib/prompts/gemini-prompts.ts`
4. **Add system instructions** - Use system instructions for role definition
5. **Maintain localization** - Keep German/English term support

## ✅ **Completion Checklist**

- [x] Event Prioritization Prompts
- [ ] Speaker Extraction (Legacy)
- [ ] Event Metadata Extraction  
- [ ] Speaker Enhancement
- [ ] Content Filtering
- [ ] Batch Processing
- [ ] Calendar Analysis
- [ ] Integration Testing
