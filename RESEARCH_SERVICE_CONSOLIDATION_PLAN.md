# Consolidating Research Services - Detailed Analysis

## Current Situation

You have **two separate services** doing similar things:

### 1. `contact-research-service.ts` (Existing, Production-Ready)
**Location**: `src/lib/services/contact-research-service.ts`

**Features**:
- ✅ Uses `@google/generative-ai` SDK (official Google SDK)
- ✅ **Database integration** - `saveContactResearch()`, `getContactResearch()`, `updateContactResearchWithIntel()`
- ✅ Proper TypeScript interfaces (`ContactResearch`, `ContactResearchResult`)
- ✅ Uses `supabaseServer()` for server-side DB operations
- ✅ Functions: `researchContact()`, `checkForUpdates()`
- ✅ Model: `gemini-2.0-flash-exp`
- ✅ Used by: `/api/profiles/saved` route, bulk-save-service

**Missing Functions**:
- ❌ `generateLinkedInBio()` - Not present
- ❌ `generateEmailDraft()` - Not present  
- ❌ `optimizeDraft()` - Not present

---

### 2. `outreach-gemini.ts` (New, Outreach Orbit Specific)
**Location**: `src/lib/outreach-gemini.ts`

**Features**:
- ✅ Marked as `'use server'` (Next.js Server Actions)
- ✅ Uses `@google/genai` SDK (different package!)
- ✅ Functions: `researchContact()`, `checkForUpdates()`, `generateLinkedInBio()`, `generateEmailDraft()`, `optimizeDraft()`
- ✅ Model: `gemini-2.0-flash`
- ✅ Used by: `OutreachManager`, `ContactModal` (Outreach Orbit components)

**Issues**:
- ❌ **No database integration** - Research results not automatically saved
- ❌ **Different SDK** - Uses `@google/genai` instead of `@google/generative-ai`
- ❌ **Different model** - Uses `gemini-2.0-flash` vs `gemini-2.0-flash-exp`
- ❌ **Code duplication** - `researchContact()` and `checkForUpdates()` exist in both files

---

## Problems This Creates

### 1. **Code Duplication** 🔴
- `researchContact()` exists in both files with slightly different implementations
- `checkForUpdates()` exists in both files with different logic
- Maintenance burden: bug fixes need to be applied in two places

### 2. **Inconsistent Behavior** 🟡
- Different SDKs might have different API behaviors
- Different models might produce different results
- Different error handling approaches

### 3. **Missing Database Integration** 🟡
- `outreach-gemini.ts` doesn't save research to `contact_research` table
- Research results are only saved manually via `updateProfileInDb()`
- Other parts of the app (like `/api/profiles/saved`) use `contact-research-service` which auto-saves

### 4. **Package Confusion** 🟡
- Two different Google AI packages in the same codebase:
  - `@google/generative-ai` (used by contact-research-service)
  - `@google/genai` (used by outreach-gemini)
- Potential version conflicts or confusion about which to use

---

## Recommended Consolidation Plan

### Step 1: Extend `contact-research-service.ts`
Add the missing functions to the existing service:

```typescript
// Add to contact-research-service.ts

export async function generateLinkedInBio(
  name: string,
  company: string,
  backgroundInfo: string,
  language: string = "English"
): Promise<string> {
  // Implementation from outreach-gemini.ts
}

export async function generateEmailDraft(
  name: string,
  company: string,
  backgroundInfo: string,
  userNotes?: string,
  language?: string,
  tone?: string,
  type?: string,
  myCompanyUrl?: string,
  specificGoal?: string
): Promise<string> {
  // Implementation from outreach-gemini.ts
}

export async function optimizeDraft(
  draft: string,
  backgroundInfo: string,
  myCompanyUrl?: string,
  specificGoal?: string
): Promise<string> {
  // Implementation from outreach-gemini.ts
}
```

### Step 2: Update `researchContact()` to Auto-Save
Enhance the existing function to optionally save to DB:

```typescript
export async function researchContact(
  name: string,
  company: string,
  options?: {
    userId?: string;
    contactId?: string;
    autoSave?: boolean;
  }
): Promise<ContactResearchResult> {
  // ... existing research logic ...
  
  // If autoSave is true, save to database
  if (options?.autoSave && options.userId && options.contactId) {
    await saveContactResearch(
      options.userId,
      options.contactId,
      { text, chunks }
    );
  }
  
  return { text, chunks };
}
```

### Step 3: Update Outreach Components
Change imports in `OutreachManager.tsx` and `ContactModal.tsx`:

```typescript
// OLD:
import { researchContact, generateEmailDraft, ... } from '@/lib/outreach-gemini';

// NEW:
import { 
  researchContact, 
  generateEmailDraft, 
  generateLinkedInBio,
  optimizeDraft,
  checkForUpdates,
  saveContactResearch 
} from '@/lib/services/contact-research-service';
```

### Step 4: Update Function Calls
When calling `researchContact`, pass options for auto-save:

```typescript
// In processNewContact:
const researchResult = await researchContact(
  contact.name, 
  contact.company,
  {
    userId: userId!,
    contactId: contact.id,
    autoSave: true  // Automatically save to DB
  }
);
```

### Step 5: Remove `outreach-gemini.ts`
Once everything is migrated, delete the file.

---

## Benefits of Consolidation

### ✅ **Single Source of Truth**
- One place to maintain research logic
- Consistent behavior across the app
- Easier to test and debug

### ✅ **Automatic Database Integration**
- Research automatically saved to `contact_research` table
- No need for manual `updateProfileInDb()` calls for research
- Consistent with how other parts of the app work

### ✅ **Better Error Handling**
- `contact-research-service` has more robust error handling
- Proper TypeScript types throughout
- Better error messages

### ✅ **Package Consistency**
- Use only `@google/generative-ai` (official SDK)
- Remove `@google/genai` dependency
- Reduce package.json bloat

### ✅ **Model Consistency**
- Use `gemini-2.0-flash-exp` everywhere (or standardize on one model)
- Consistent AI behavior across features

---

## Migration Checklist

- [ ] Add `generateLinkedInBio()` to `contact-research-service.ts`
- [ ] Add `generateEmailDraft()` to `contact-research-service.ts`
- [ ] Add `optimizeDraft()` to `contact-research-service.ts`
- [ ] Update `researchContact()` to support auto-save option
- [ ] Update `OutreachManager.tsx` imports
- [ ] Update `ContactModal.tsx` imports
- [ ] Update all function calls to use new API
- [ ] Test research functionality
- [ ] Test email draft generation
- [ ] Test bio generation
- [ ] Verify database saves work correctly
- [ ] Remove `outreach-gemini.ts` file
- [ ] Remove `@google/genai` from package.json (if unused elsewhere)

---

## Potential Challenges

### 1. **SDK Differences**
- `@google/genai` vs `@google/generative-ai` might have different APIs
- Need to test that all functions work with the new SDK
- May need to adjust API calls

### 2. **Model Availability**
- `gemini-2.0-flash-exp` might not support all features
- May need to test Google Search grounding works
- Might need to use different model for different functions

### 3. **Server Actions**
- `outreach-gemini.ts` is marked `'use server'`
- `contact-research-service.ts` is not (it's a regular service)
- Need to ensure functions can be called from client components
- Might need to create API routes or keep as server actions

---

## Recommendation

**Priority: Medium** (not critical, but good for code quality)

**Effort: 2-3 hours**

**Risk: Low** (can be done incrementally, test as you go)

**Impact: High** (reduces technical debt, improves maintainability)

This consolidation will make the codebase cleaner and more maintainable, but it's not blocking any current functionality. It's a good refactoring to do when you have time.

