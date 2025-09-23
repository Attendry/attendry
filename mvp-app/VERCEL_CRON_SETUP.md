# 🚀 Vercel Cron Jobs Setup - Complete Guide

## Prerequisites Checklist

### ✅ Required Environment Variables
You'll need these in your Vercel project settings:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Custom Search (Required for event discovery)
GOOGLE_CSE_CX=your_google_custom_search_engine_id
GOOGLE_CSE_KEY=your_google_api_key

# Firecrawl (Required for event extraction)
FIRECRAWL_KEY=your_firecrawl_key

# Cron Security (Required for cron jobs)
CRON_SECRET=your_secure_random_token_here

# Site URL (Optional, defaults to localhost)
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

## Step-by-Step Vercel Setup

### Step 1: Deploy to Vercel

1. **Connect your GitHub repository to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Select the `mvp-app` folder as the root directory

2. **Configure build settings:**
   - Framework Preset: `Next.js`
   - Root Directory: `mvp-app`
   - Build Command: `npm run build`
   - Output Directory: `.next`

### Step 2: Add Environment Variables

1. **In your Vercel project dashboard:**
   - Go to Settings → Environment Variables
   - Add each variable from the list above

2. **Generate a secure CRON_SECRET:**
   ```bash
   # You can generate a secure token using:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Important:** Make sure to add environment variables for all environments:
   - Production
   - Preview
   - Development

### Step 3: Verify Cron Configuration

The cron jobs are already configured in your `vercel.json`:

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

### Step 4: Deploy and Test

1. **Deploy your project:**
   - Push your code to GitHub
   - Vercel will automatically deploy
   - Wait for deployment to complete

2. **Test the cron endpoint manually:**
   ```bash
   # Replace YOUR_DOMAIN with your actual Vercel domain
   curl -X POST https://YOUR_DOMAIN.vercel.app/api/cron/collect-events \
     -H "Authorization: Bearer YOUR_CRON_SECRET" \
     -H "Content-Type: application/json"
   ```

3. **Check cron status:**
   ```bash
   curl https://YOUR_DOMAIN.vercel.app/api/cron/collect-events
   ```

## Monitoring Your Cron Jobs

### Vercel Dashboard
1. Go to your project in Vercel dashboard
2. Click on "Functions" tab
3. Look for cron job executions in the logs

### Expected Log Output
```
[CRON] Starting standard event collection
[CRON] Collecting events for legal-compliance in de
[CRON] Collecting events for legal-compliance in fr
...
[CRON] Collection complete: 12/12 successful, 45 total events
```

### Database Verification
1. Go to your Supabase dashboard
2. Check the `collected_events` table
3. You should see new events being added

## Troubleshooting

### Common Issues

#### 1. Cron Jobs Not Running
**Symptoms:** No logs in Vercel functions
**Solutions:**
- Check that `vercel.json` is in the root directory
- Verify environment variables are set
- Ensure CRON_SECRET is correctly configured

#### 2. Authentication Errors
**Symptoms:** 401 Unauthorized errors
**Solutions:**
- Verify CRON_SECRET matches in environment variables
- Check that Authorization header is correctly formatted

#### 3. API Rate Limits
**Symptoms:** Google CSE or Firecrawl errors
**Solutions:**
- Check API key quotas
- Verify API keys are valid
- Consider upgrading API plans if needed

#### 4. Database Connection Issues
**Symptoms:** Supabase connection errors
**Solutions:**
- Verify Supabase environment variables
- Check database permissions
- Ensure tables exist (run migrations)

### Debug Commands

```bash
# Test individual collection
curl -X POST https://YOUR_DOMAIN.vercel.app/api/events/collect \
  -H "Content-Type: application/json" \
  -d '{"industry":"legal-compliance","country":"de","monthsAhead":6}'

# Check database connection
curl https://YOUR_DOMAIN.vercel.app/api/health

# View recent events
curl https://YOUR_DOMAIN.vercel.app/api/events/collect?industry=legal-compliance&country=de
```

## Expected Results

### After First Cron Run
- **Database**: 50-200 new events in `collected_events` table
- **Logs**: Successful collection messages
- **Performance**: Faster user searches

### After One Week
- **Database**: 500-1000+ events
- **Coverage**: Multiple industries and countries
- **User Experience**: Near-instant search results

## Cost Considerations

### Vercel
- **Free Tier**: 2 cron jobs (perfect for our setup)
- **Function Execution**: 100GB-hours free per month
- **Bandwidth**: 100GB free per month

### External APIs
- **Google CSE**: 100 queries/day free
- **Firecrawl**: Usage-based pricing
- **Supabase**: Generous free tier

## Next Steps After Setup

1. **Monitor first cron execution** (next 2 AM UTC)
2. **Verify data collection** in Supabase
3. **Test user search performance**
4. **Set up monitoring alerts** (optional)
5. **Consider expanding collection scope** (optional)

## Support

If you encounter issues:
1. Check Vercel function logs
2. Verify all environment variables
3. Test individual API endpoints
4. Check Supabase database connectivity

The cron jobs will transform your app from a basic search tool into a comprehensive event discovery platform! 🎉
