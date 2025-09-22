export const runtime = "nodejs";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

function mask(v?: string | null) {
  if (!v) return null;
  return v.length <= 8 ? "***" : `${v.slice(0, 3)}…${v.slice(-4)}`;
}

export async function GET() {
  try {
    const cwd = process.cwd();
    const envPath = path.join(cwd, ".env.local");
    const exists = fs.existsSync(envPath);
    let size = 0;
    let bom: string | null = null;

    if (exists) {
      const stat = fs.statSync(envPath);
      size = stat.size;
      const buf = fs.readFileSync(envPath);
      const hex = buf.slice(0, 2).toString("hex");
      bom = hex === "fffe" || hex === "feff" ? "utf-16-bom" : "none/utf8";
    }

    return NextResponse.json({
      cwd,
      envFile: { path: envPath, exists, size, bom },
      vars: {
        GOOGLE_CSE_KEY: !!process.env.GOOGLE_CSE_KEY ? mask(process.env.GOOGLE_CSE_KEY) : null,
        GOOGLE_CSE_CX: !!process.env.GOOGLE_CSE_CX ? mask(process.env.GOOGLE_CSE_CX) : null,
        FIRECRAWL_KEY: !!process.env.FIRECRAWL_KEY ? mask(process.env.FIRECRAWL_KEY) : null,
        GEMINI_API_KEY: !!process.env.GEMINI_API_KEY ? mask(process.env.GEMINI_API_KEY) : null,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 200 });
  }
}
