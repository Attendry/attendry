// src/app/api/profile/get/route.ts
import { NextResponse } from "next/server";
import { ConfigService } from "@/lib/services/config-service";
import { 
  ProfileGetResponse, 
  ErrorResponse 
} from "@/lib/types/api";

export async function GET(): Promise<NextResponse<ProfileGetResponse | ErrorResponse>> {
  try {
    const profile = await ConfigService.getUserProfile();
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to get profile',
      profile: null 
    }, { status: 500 });
  }
}
