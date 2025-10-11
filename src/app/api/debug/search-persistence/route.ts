import { NextRequest, NextResponse } from 'next/server';
import { stageCounter } from '@/lib/obs/triage-metrics';

export async function GET(_req: NextRequest) {
  stageCounter('debug', [], [], []);
  return NextResponse.json({ ok: true });
}



