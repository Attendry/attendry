/**
 * PERF-3.2.1: Keep Functions Warm
 * 
 * This cron job pings key API endpoints to prevent cold starts
 * Runs every 5 minutes to keep serverless functions warm
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

const WARM_ENDPOINTS = [
  '/api/events/search',
  '/api/events/trending',
  '/api/events/extract',
  '/api/config/search',
];

async function warmEndpoint(endpoint: string, baseUrl: string): Promise<{ endpoint: string; status: number; duration: number; success: boolean }> {
  const startTime = Date.now();
  try {
    const url = `${baseUrl}${endpoint}`;
    
    // For search endpoint, send a minimal POST request
    if (endpoint === '/api/events/search') {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: 'conference',
          country: 'DE',
          from: new Date().toISOString().split('T')[0],
          to: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }),
        // Don't wait for full response, just connection
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      const duration = Date.now() - startTime;
      return {
        endpoint,
        status: response.status,
        duration,
        success: response.ok || response.status === 400 // 400 is OK for warm-up (invalid request)
      };
    }
    
    // For other endpoints, use GET
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    const duration = Date.now() - startTime;
    return {
      endpoint,
      status: response.status,
      duration,
      success: response.ok || response.status === 401 || response.status === 400 // Auth errors are OK for warm-up
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.warn(`[keep-warm] Failed to warm ${endpoint}:`, error.message);
    return {
      endpoint,
      status: 0,
      duration,
      success: false,
      error: error.message
    };
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify this is a cron request
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                  'http://localhost:3000';

  console.log('[keep-warm] Starting function warming...');
  const startTime = Date.now();

  // Warm all endpoints in parallel
  const results = await Promise.allSettled(
    WARM_ENDPOINTS.map(endpoint => warmEndpoint(endpoint, baseUrl))
  );

  const successful: string[] = [];
  const failed: Array<{ endpoint: string; error?: string }> = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        successful.push(result.value.endpoint);
      } else {
        failed.push({ 
          endpoint: result.value.endpoint,
          error: `Status ${result.value.status}` 
        });
      }
    } else {
      failed.push({ 
        endpoint: WARM_ENDPOINTS[index],
        error: result.reason?.message || 'Unknown error'
      });
    }
  });

  const totalDuration = Date.now() - startTime;

  console.log(`[keep-warm] Completed in ${totalDuration}ms. Successful: ${successful.length}/${WARM_ENDPOINTS.length}`);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    endpoints: {
      total: WARM_ENDPOINTS.length,
      successful: successful.length,
      failed: failed.length
    },
    results: {
      successful,
      failed
    }
  });
}

