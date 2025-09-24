// src/app/api/profile/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ConfigService } from "@/lib/services/config-service";

export async function POST(req: NextRequest) {
  const {
    full_name,
    company,
    competitors = [],
    icp_terms = [],
    industry_terms = [],
    use_in_basic_search = true,
  } = await req.json();

  const success = await ConfigService.saveUserProfile({
    full_name,
    company,
    competitors,
    icp_terms,
    industry_terms,
    use_in_basic_search,
  });

  if (!success) {
    return NextResponse.json({ error: "Failed to save profile" }, { status: 400 });
  }
  
  return NextResponse.json({ ok: true });
}
