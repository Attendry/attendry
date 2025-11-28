/**
 * PHASE 3: Weekly Discovery Opportunities Cron Job
 * 
 * Wrapper for weekly discovery frequency
 */

import { NextRequest } from "next/server";
import { GET as baseGET } from "../discover-opportunities/route";

export async function GET(req: NextRequest) {
  // Create a new request with frequency parameter
  const url = new URL(req.url);
  url.searchParams.set('frequency', 'weekly');
  const newReq = new NextRequest(url, req);
  
  return baseGET(newReq);
}


