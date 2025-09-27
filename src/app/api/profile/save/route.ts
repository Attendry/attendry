// src/app/api/profile/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ConfigService } from "@/lib/services/config-service";
import { 
  ProfileSaveRequest, 
  ProfileSaveResponse, 
  ErrorResponse 
} from "@/lib/types/api";

export async function POST(req: NextRequest): Promise<NextResponse<ProfileSaveResponse | ErrorResponse>> {
  try {
    const requestData: ProfileSaveRequest = await req.json();
    const {
      full_name,
      company,
      competitors = [],
      icp_terms = [],
      industry_terms = [],
      use_in_basic_search = true,
    } = requestData;

    const success = await ConfigService.saveUserProfile({
      full_name,
      company,
      competitors,
      icp_terms,
      industry_terms,
      use_in_basic_search,
    });

    if (!success) {
      return NextResponse.json({ 
        success: false,
        error: "Failed to save profile" 
      }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save profile'
    }, { status: 500 });
  }
}
