// src/app/api/profile/get/route.ts
import { NextResponse } from "next/server";
import { ConfigService } from "@/lib/services/config-service";

export async function GET() {
  const profile = await ConfigService.getUserProfile();
  return NextResponse.json({ profile });
}
