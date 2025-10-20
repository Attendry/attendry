import { NextRequest, NextResponse } from "next/server";

// Simple test endpoint to verify routing is working
export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ 
    success: true,
    message: "Analysis status test endpoint is working",
    timestamp: new Date().toISOString()
  });
}
