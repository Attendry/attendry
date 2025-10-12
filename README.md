# Attendry - Event Search Platform

This is a [Next.js](https://nextjs.org) project for searching and discovering professional events, conferences, and summits.

## Search Pipeline Architecture

The application uses two distinct search pipelines:

### Enhanced Pipeline (`/api/events/run`)
- **Used by**: Main search UI (`/search` page)
- **Features**: 
  - Multi-provider search (Firecrawl, Google CSE)
  - AI-powered content extraction and speaker detection
  - Related page discovery and enrichment
  - Advanced filtering and scoring
- **Data Sources**: Firecrawl scraping, Google Custom Search, Gemini AI

### Legacy Pipeline (`/api/events/search`)
- **Used by**: Basic search endpoints and legacy integrations
- **Features**: 
  - Google Custom Search Engine only
  - Basic filtering and caching
  - Limited content extraction
- **Data Sources**: Google Custom Search Engine

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Required environment variables:
- `GOOGLE_CSE_KEY` - Google Custom Search API key
- `FIRECRAWL_KEY` - Firecrawl API key for content extraction
- `GEMINI_API_KEY` - Google Gemini API key for AI processing

## Search Debugging

The enhanced pipeline includes comprehensive logging and instrumentation:
- `stageCounter` tracks input/output counts at each processing stage
- `logSuppressedSamples` captures examples of filtered content
- Correlation IDs link related log entries across the pipeline

Check Vercel logs for detailed pipeline execution traces.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
