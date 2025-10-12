import { NextResponse } from 'next/server';
import { isNewPipelineEnabled } from '@/lib/event-pipeline/config';

export async function GET() {
  try {
    const pipelineEnabled = isNewPipelineEnabled();
    const envValue = process.env.ENABLE_NEW_PIPELINE;
    
    return NextResponse.json({
      success: true,
      pipelineEnabled,
      envValue,
      allEnvVars: {
        ENABLE_NEW_PIPELINE: process.env.ENABLE_NEW_PIPELINE,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'SET' : 'NOT_SET',
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
