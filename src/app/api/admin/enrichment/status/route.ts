/**
 * Admin Enrichment Service Management API
 * 
 * Allows admins to view and manage enrichment service status
 */

import { NextRequest, NextResponse } from "next/server";
import { getEnrichmentCircuitBreaker } from "@/lib/services/enrichment-circuit-breaker";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // TODO: Check if user is admin
    // For now, allow any authenticated user (add admin check later)
    
    const breaker = getEnrichmentCircuitBreaker();
    const statuses = breaker.getAllServiceStatuses();
    
    return NextResponse.json({
      success: true,
      services: statuses,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[admin-enrichment-status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // TODO: Check if user is admin
    
    const body = await req.json();
    const { action, service } = body;
    
    if (!action || !service) {
      return NextResponse.json(
        { error: "action and service are required" },
        { status: 400 }
      );
    }

    const breaker = getEnrichmentCircuitBreaker();
    
    switch (action) {
      case 'enable':
        await breaker.setServiceEnabled(service, true);
        return NextResponse.json({ success: true, message: `Service ${service} enabled` });
      
      case 'disable':
        await breaker.setServiceEnabled(service, false);
        return NextResponse.json({ success: true, message: `Service ${service} disabled` });
      
      case 'reset':
        await breaker.resetService(service);
        return NextResponse.json({ success: true, message: `Service ${service} reset` });
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[admin-enrichment-status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

