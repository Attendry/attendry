import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        database: 'unknown',
        cron: 'unknown'
      }
    };

    // Test database connectivity
    try {
      const supabase = await supabaseServer();
      if (supabase) {
        const { data, error } = await supabase
          .from('collected_events')
          .select('count', { count: 'exact', head: true });
        
        if (!error) {
          health.services.database = 'healthy';
          health.database = {
            connected: true,
            eventCount: data?.length || 0
          };
        } else {
          health.services.database = 'error';
          health.database = { connected: false, error: error.message };
        }
      }
    } catch (dbError: any) {
      health.services.database = 'error';
      health.database = { connected: false, error: dbError.message };
    }

    // Check if cron secret is configured
    if (process.env.CRON_SECRET) {
      health.services.cron = 'configured';
    } else {
      health.services.cron = 'not_configured';
    }

    // Determine overall health
    const allHealthy = Object.values(health.services).every(status => 
      status === 'healthy' || status === 'configured'
    );
    
    health.status = allHealthy ? 'healthy' : 'degraded';

    return NextResponse.json(health, { 
      status: allHealthy ? 200 : 503 
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 });
  }
}
