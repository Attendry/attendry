/**
 * System Health API
 * 
 * This endpoint provides system health monitoring and status checks
 * for various services and components.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Health check interface
 */
interface HealthCheck {
  service: string;
  status: 'healthy' | 'warning' | 'error';
  responseTime: number;
  lastChecked: string;
  message?: string;
}

/**
 * Health response
 */
interface HealthResponse {
  healthChecks: HealthCheck[];
  overallStatus: 'healthy' | 'warning' | 'error';
  timestamp: string;
}

/**
 * GET /api/admin/health
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  try {
    const supabase = await supabaseServer();
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!profile || !profile.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Perform health checks
    const healthChecks = await performHealthChecks(supabase);

    // Determine overall status
    const overallStatus = determineOverallStatus(healthChecks);

    return NextResponse.json({
      healthChecks,
      overallStatus,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('System health error:', error);
    return NextResponse.json(
      { error: 'Failed to check system health' },
      { status: 500 }
    );
  }
}

/**
 * Perform health checks for various services
 */
async function performHealthChecks(supabase: any): Promise<HealthCheck[]> {
  const healthChecks: HealthCheck[] = [];

  // Database health check
  const dbHealth = await checkDatabaseHealth(supabase);
  healthChecks.push(dbHealth);

  // API health check
  const apiHealth = await checkAPIHealth();
  healthChecks.push(apiHealth);

  // External services health check
  const externalHealth = await checkExternalServicesHealth();
  healthChecks.push(...externalHealth);

  // Storage health check
  const storageHealth = await checkStorageHealth(supabase);
  healthChecks.push(storageHealth);

  return healthChecks;
}

/**
 * Check database health
 */
async function checkDatabaseHealth(supabase: any): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        service: 'Database',
        status: 'error',
        responseTime,
        lastChecked: new Date().toISOString(),
        message: error.message,
      };
    }

    return {
      service: 'Database',
      status: responseTime > 1000 ? 'warning' : 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
      message: 'Database connection successful',
    };

  } catch (error) {
    return {
      service: 'Database',
      status: 'error',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      message: 'Database connection failed',
    };
  }
}

/**
 * Check API health
 */
async function checkAPIHealth(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Test internal API endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        service: 'API',
        status: 'error',
        responseTime,
        lastChecked: new Date().toISOString(),
        message: `API returned ${response.status}`,
      };
    }

    return {
      service: 'API',
      status: responseTime > 500 ? 'warning' : 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
      message: 'API responding normally',
    };

  } catch (error) {
    return {
      service: 'API',
      status: 'error',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      message: 'API connection failed',
    };
  }
}

/**
 * Check external services health
 */
async function checkExternalServicesHealth(): Promise<HealthCheck[]> {
  const healthChecks: HealthCheck[] = [];

  // Check Google CSE API
  const googleCSEHealth = await checkGoogleCSEHealth();
  healthChecks.push(googleCSEHealth);

  // Check Gemini API
  const geminiHealth = await checkGeminiHealth();
  healthChecks.push(geminiHealth);

  // Check Firecrawl API
  const firecrawlHealth = await checkFirecrawlHealth();
  healthChecks.push(firecrawlHealth);

  return healthChecks;
}

/**
 * Check Google CSE API health
 */
async function checkGoogleCSEHealth(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Simple test query
    const testQuery = 'test';
    const apiKey = process.env.GOOGLE_CSE_API_KEY;
    const searchEngineId = process.env.GOOGLE_CSE_SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      return {
        service: 'Google CSE',
        status: 'error',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        message: 'API credentials not configured',
      };
    }

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${testQuery}`,
      { method: 'GET' }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        service: 'Google CSE',
        status: 'error',
        responseTime,
        lastChecked: new Date().toISOString(),
        message: `API returned ${response.status}`,
      };
    }

    return {
      service: 'Google CSE',
      status: responseTime > 2000 ? 'warning' : 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
      message: 'API responding normally',
    };

  } catch (error) {
    return {
      service: 'Google CSE',
      status: 'error',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      message: 'API connection failed',
    };
  }
}

/**
 * Check Gemini API health
 */
async function checkGeminiHealth(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        service: 'Gemini AI',
        status: 'error',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        message: 'API key not configured',
      };
    }

    // Simple test request
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }],
        }),
      }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        service: 'Gemini AI',
        status: 'error',
        responseTime,
        lastChecked: new Date().toISOString(),
        message: `API returned ${response.status}`,
      };
    }

    return {
      service: 'Gemini AI',
      status: responseTime > 3000 ? 'warning' : 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
      message: 'API responding normally',
    };

  } catch (error) {
    return {
      service: 'Gemini AI',
      status: 'error',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      message: 'API connection failed',
    };
  }
}

/**
 * Check Firecrawl API health
 */
async function checkFirecrawlHealth(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const apiKey = process.env.FIRECRAWL_KEY;

    if (!apiKey) {
      return {
        service: 'Firecrawl',
        status: 'error',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        message: 'API key not configured',
      };
    }

    // Simple test request
    const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://example.com',
        formats: ['markdown'],
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        service: 'Firecrawl',
        status: 'error',
        responseTime,
        lastChecked: new Date().toISOString(),
        message: `API returned ${response.status}`,
      };
    }

    return {
      service: 'Firecrawl',
      status: responseTime > 5000 ? 'warning' : 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
      message: 'API responding normally',
    };

  } catch (error) {
    return {
      service: 'Firecrawl',
      status: 'error',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      message: 'API connection failed',
    };
  }
}

/**
 * Check storage health
 */
async function checkStorageHealth(supabase: any): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Test storage by checking if we can access the profiles table
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        service: 'Storage',
        status: 'error',
        responseTime,
        lastChecked: new Date().toISOString(),
        message: error.message,
      };
    }

    return {
      service: 'Storage',
      status: responseTime > 1000 ? 'warning' : 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
      message: 'Storage accessible',
    };

  } catch (error) {
    return {
      service: 'Storage',
      status: 'error',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      message: 'Storage access failed',
    };
  }
}

/**
 * Determine overall system status
 */
function determineOverallStatus(healthChecks: HealthCheck[]): 'healthy' | 'warning' | 'error' {
  if (healthChecks.some(check => check.status === 'error')) {
    return 'error';
  }
  if (healthChecks.some(check => check.status === 'warning')) {
    return 'warning';
  }
  return 'healthy';
}
