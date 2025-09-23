# 🤖 Automated Cron Jobs Setup Guide

## Overview
Automated cron jobs continuously collect event data in the background, providing users with instant, comprehensive search results.

## What Cron Jobs Do

### **Daily Collection (2 AM UTC)**
- **Scope**: Key markets (Germany, France, UK, US)
- **Industries**: Legal & Compliance, FinTech, Healthcare
- **Time Range**: 6 months ahead
- **Purpose**: Keep core data fresh and up-to-date

### **Weekly Deep Collection (3 AM UTC, Sundays)**
- **Scope**: Extended markets (14 countries across Europe)
- **Industries**: All industries including General Business
- **Time Range**: 12 months ahead
- **Purpose**: Comprehensive coverage and discovery of new events

## Benefits for Users

### **Before Cron Jobs:**
- ❌ 30-60 second wait times for search results
- ❌ Limited to user's specific search parameters
- ❌ Inconsistent data quality
- ❌ No historical event data

### **After Cron Jobs:**
- ✅ Instant search results (milliseconds)
- ✅ Comprehensive event database
- ✅ Consistent, high-quality data
- ✅ Rich historical and future event data

## Setup Instructions

### 1. Environment Variables
Add to your `.env.local` file:
```bash
# Cron Job Security Token
CRON_SECRET=your_secure_random_token_here

# Other required variables...
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GOOGLE_CSE_CX=your_google_cse_cx
GOOGLE_CSE_KEY=your_google_cse_key
FIRECRAWL_KEY=your_firecrawl_key
```

### 2. Vercel Deployment
The cron jobs are already configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/collect-events",
      "schedule": "0 2 * * *"  // Daily at 2 AM UTC
    },
    {
      "path": "/api/cron/collect-events?type=deep",
      "schedule": "0 3 * * 0"  // Weekly on Sundays at 3 AM UTC
    }
  ]
}
```

### 3. Manual Testing
Test the cron job manually:
```bash
# Standard collection
curl -X POST https://your-domain.vercel.app/api/cron/collect-events \
  -H "Authorization: Bearer your_cron_secret"

# Deep collection
curl -X POST https://your-domain.vercel.app/api/cron/collect-events?type=deep \
  -H "Authorization: Bearer your_cron_secret"
```

## Data Flow

```
Cron Trigger → Search APIs → Extract Events → Store in Database → User Gets Instant Results
```

## Monitoring

### **Check Cron Status:**
```bash
curl https://your-domain.vercel.app/api/cron/collect-events
```

### **Expected Response:**
```json
{
  "lastRun": "2025-01-15T02:00:00.000Z",
  "status": "healthy",
  "nextScheduledRun": "2025-01-16T02:00:00.000Z"
}
```

## Collection Statistics

### **Daily Collection:**
- **12 jobs** (3 industries × 4 countries)
- **~6 months** of future events
- **~5-10 minutes** execution time

### **Weekly Deep Collection:**
- **56 jobs** (4 industries × 14 countries)
- **~12 months** of future events
- **~20-30 minutes** execution time

## Troubleshooting

### **Common Issues:**
1. **Cron not running**: Check Vercel deployment and environment variables
2. **No events collected**: Verify API keys and search configuration
3. **Database errors**: Check Supabase connection and permissions

### **Logs:**
Check Vercel function logs for detailed execution information.

## Cost Considerations

- **Vercel Cron**: Free tier includes 2 cron jobs
- **API Usage**: Google CSE (100 queries/day free), Firecrawl (usage-based)
- **Database**: Supabase (generous free tier)

## Next Steps

1. Deploy to Vercel with environment variables
2. Monitor first cron execution
3. Verify data collection in database
4. Test user search performance improvements
