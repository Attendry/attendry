# 🔍 Search Configuration Guide

## Problem Identified

Your search is returning **0 results** because the required external search provider API keys are **not configured**.

## Root Cause

The Attendry application uses external search providers to find events:

1. **Firecrawl** (Primary) - Web crawling and search
2. **Google Custom Search Engine** (Fallback) - Google's search API
3. **Database** (Last resort) - Local cached events

Currently, **none of these providers are configured**, so all searches return 0 results.

## Solution Paths

### Option 1: Configure Firecrawl (Recommended)

Firecrawl is the primary search provider and provides the best results.

1. **Sign up for Firecrawl**
   - Visit: https://firecrawl.dev/
   - Create an account
   - Get your API key from the dashboard

2. **Add to your environment**
   ```bash
   # Create or edit .env.local
   FIRECRAWL_KEY=your_firecrawl_api_key_here
   ```

3. **Restart the dev server**
   ```bash
   npm run dev
   ```

### Option 2: Configure Google Custom Search Engine

If you prefer Google CSE or want a fallback:

1. **Create a Google Custom Search Engine**
   - Visit: https://programmablesearchengine.google.com/
   - Create a new search engine
   - Configure it to search the entire web
   - Get your Search Engine ID (CX)

2. **Get Google API Key**
   - Visit: https://console.cloud.google.com/
   - Enable Custom Search API
   - Create credentials (API key)

3. **Add to your environment**
   ```bash
   # Create or edit .env.local
   GOOGLE_CSE_KEY=your_google_api_key_here
   GOOGLE_CSE_CX=your_search_engine_id_here
   ```

4. **Restart the dev server**
   ```bash
   npm run dev
   ```

### Option 3: Seed Database with Test Data (Quick Testing)

For quick testing without API keys, you can seed the database with sample events.

1. **Check if you have sample data script**
   ```bash
   # Look for migration files or seed scripts
   ls supabase/migrations/
   ```

2. **Or create a simple test script** (see below)

## Quick Test with Mock Data

If you want to test the UI immediately without setting up external APIs, you can create a mock search endpoint:

1. Create `src/app/api/events/run/test-data.ts`:

```typescript
export const mockEvents = [
  {
    id: "1",
    title: "Legal Tech Conference 2025",
    source_url: "https://example.com/event1",
    starts_at: "2025-11-15",
    ends_at: "2025-11-17",
    city: "Berlin",
    country: "DE",
    location: "Berlin Convention Center",
    venue: "Hall 1",
    description: "Annual legal technology conference",
    confidence: 0.95,
    speakers: [
      {
        name: "Dr. Jane Smith",
        title: "Partner",
        org: "Smith & Associates",
        bio: "Legal tech expert",
        confidence: 0.9
      }
    ],
    sponsors: [],
    sessions: []
  },
  {
    id: "2",
    title: "Digital Law Summit Germany",
    source_url: "https://example.com/event2",
    starts_at: "2025-12-01",
    ends_at: "2025-12-03",
    city: "Munich",
    country: "DE",
    location: "Munich Conference Hall",
    venue: "Main Auditorium",
    description: "Digital transformation in legal services",
    confidence: 0.92,
    speakers: [],
    sponsors: [],
    sessions: []
  }
];
```

2. Modify `src/app/api/events/run/route.ts` temporarily to return mock data in development.

## Verifying Configuration

Run this command to check your configuration:

```bash
node test-search-config.js
```

You should see:
```
✓ At least one search provider is configured
```

## Next Steps

1. **Choose a solution path** (Option 1 recommended)
2. **Configure the API keys**
3. **Restart your development server**
4. **Test the search** - You should now see results!

## Support Resources

- **Firecrawl Docs**: https://docs.firecrawl.dev/
- **Google CSE Docs**: https://developers.google.com/custom-search/v1/overview
- **Supabase Docs**: https://supabase.com/docs

## Cost Considerations

- **Firecrawl**: Free tier available, ~500 searches/month
- **Google CSE**: Free tier 100 queries/day, $5 per 1000 queries after
- **Database fallback**: Free (uses your Supabase storage)

---

*Last updated: 2025-10-31*


