# End-to-End Performance Review & Optimization Report

## 1. Executive Summary
The **Attendry** application uses a robust, albeit complex, architecture designed to balance real-time user searches with deep, AI-powered event intelligence. The primary performance challenges stem from **frontend N+1 API calls**, **synchronous AI blocking** in search paths, and **inefficient database query patterns** in the enhanced search flows.

Addressing these issues will significantly improve perceived latency (Time to Interactive) and reduce server/database load.

---

## 2. Critical Findings (High Priority)

### 2.1. Frontend N+1 API Problem (`EventCard.tsx`)
**Impact:** Severe. Linear latency increase with list size.
- **Observation:** The `EventCard` component (lines 140-160) executes a `fetch` to `/api/events/board/check` inside a `useEffect` on mount.
- **Consequence:** Rendering a list of 50 events triggers **50 simultaneous API calls**. This floods the browser's request queue and the server, delaying critical image/content loading.
- **Recommendation:**
  - **Batching:** Fetch board status for *all* displayed event IDs in a single call from the parent list component (`EventsBoard` or `EventList`).
  - **Prop Drilling:** Pass the `inBoard` status down to `EventCard` as a prop.

### 2.2. Internal API Round-Trips (`search/route.ts`)
**Impact:** Moderate. Adds 100ms+ to every search.
- **Observation:** The main search endpoint (`/api/events/search`) makes a `fetch` call to its *own* API (`/api/config/search`) to get configuration (lines 763-764).
- **Consequence:** This adds network overhead (DNS, TCP, TLS, HTTP) to what should be a simple function call.
- **Recommendation:** Directly import the configuration logic or the database helper used by `/api/config/search` into `search/route.ts`.

### 2.3. Inefficient Database Queries (`search-enhanced/route.ts`)
**Impact:** Moderate to High (scaling risk).
- **Observation:** `getPreCollectedEvents` uses a heavy `OR` condition: `query.or('title.ilike.%term%,topics.cs.{term}')`.
- **Consequence:** `ilike '%term%'` forces a **full table scan** unless a Trigram (pg_trgm) index is strictly utilized. Combining it with an array containment check (`topics.cs`) in an `OR` clause often prevents effective index usage.
- **Recommendation:**
  - Ensure `pg_trgm` extension is enabled and a GIN index exists on `title` (`gin(title gin_trgm_ops)`).
  - Split the query: Run the text search and the topic search separately if needed, or use Postgres `websearch_to_tsquery` for a unified Full Text Search (FTS) column which is much faster.

---

## 3. Architectural Analysis

### 3.1. Search Pipeline Complexity
The application maintains multiple search paths:
1.  **Fast Path (`/api/events/search`):** Google CSE + Gemini Filter.
2.  **Deep Path (`/api/events/run`):** Uses `optimized-orchestrator.ts`.
3.  **Enhanced Path (`/api/events/search-enhanced`):** Merges Real-time + DB.
4.  **Hybrid/RAG Path (`src/search/`):** Uses Vector search.

**Risk:** Fragmentation makes performance tuning difficult. The "Fast Path" is currently dependent on Google CSE latency (~1s) and Gemini Filter (~1-2s).
**Optimization:**
-   **Parallelize AI:** The `GeminiService.filterWithGemini` call is blocking. If possible, stream results to the UI and filter progressively, or use a faster model (Gemini Flash is already used, which is good) with strict timeout caps.

### 3.2. Vector Search (`retrieve.ts`)
**Observation:** `runSemanticQuery` uses `ORDER BY embedding <=> $1`.
-   **Risk:** Without an HNSW index, this is O(N).
-   **Recommendation:** Verify `search_documents` has a vector index: `CREATE INDEX ON search_documents USING hnsw (embedding vector_cosine_ops);`.

### 3.3. Serverless Timeouts
**Observation:** Heavy orchestration logic (`optimized-orchestrator.ts`) runs deep crawls and multiple AI calls.
-   **Risk:** This is prone to hitting Vercel's 10s (Hobby) or 60s (Pro) serverless function timeouts.
-   **Recommendation:** Ensure these run exclusively in **Background Jobs** (Cron) or use Inngest/Trigger.dev for durable execution. The current Cron setup is a good start, but user-initiated "deep runs" must be async.

---

## 4. Frontend Recommendations

1.  **Optimize `checkBoardStatus`:** (As mentioned in 2.1).
2.  **Virtualization:** Ensure `react-window` is correctly implemented in `events-board`. If `EventCard` heights are dynamic (variable descriptions/speakers), use `VariableSizeList` or a measurement cache.
3.  **Image Optimization:** `EventCard` does not seem to use `next/image`. If event images are external URLs, `next/image` requires whitelisting domains, which might be impractical for a crawler. However, basic `loading="lazy"` attributes should be verified on standard `<img>` tags.

## 5. Database Recommendations

1.  **Indexes:**
    -   Ensure `collected_events` has: `(starts_at, country)`, `(collected_at)`, and `GIN` on `title` / `topics`.
2.  **Connection Pooling:**
    -   Ensure `Supabase` client is using the Transaction Pooler (port 6543) for serverless functions to avoid exhausting connection limits.

---

## 6. Immediate Action Plan

1.  **Refactor `EventCard.tsx`** to remove the `useEffect` board check.
2.  **Refactor `/api/events/search/route.ts`** to import config logic directly.
3.  **Verify Indexes** in Supabase/Postgres for `collected_events` and `search_documents`.




