/**
 * PHASE 3: Daily Discovery Opportunities Cron Job
 * 
 * Wrapper for daily discovery frequency
 */

import { NextRequest } from "next/server";
import { GET as baseGET } from "../discover-opportunities/route";

export async function GET(req: NextRequest) {
  // Create a new request with frequency parameter
  const url = new URL(req.url);
  url.searchParams.set('frequency', 'daily');
  const newReq = new NextRequest(url, req);
  
  return baseGET(newReq);
}

