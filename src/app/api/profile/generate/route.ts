// src/app/api/profile/generate/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

type GenOut = { competitors: string[]; icp_terms: string[]; industry_terms: string[]; debug?: any };

const CLEAN_LIMITS = { competitors: 8, terms: 10 };

async function fallbackPayload(company: string): Promise<GenOut> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'}/api/config/search`);
    const data = await res.json();
    return {
      competitors: [],
      icp_terms: data.config?.icpTerms || ["general counsel", "chief compliance officer", "investigations lead"],
      industry_terms: data.config?.industryTerms || ["compliance", "investigations", "regtech", "ESG", "sanctions"],
    };
  } catch (error) {
    return {
      competitors: [],
      icp_terms: ["general counsel", "chief compliance officer", "investigations lead"],
      industry_terms: ["compliance", "investigations", "regtech", "ESG", "sanctions"],
    };
  }
}

/** Very simple brand-like token filter */
function normalizeBrand(raw: string) {
  let s = raw.trim();
  s = s.replace(/^[-•–—\s]+/, "").replace(/\s+\(.*?\)$/g, "");
  // remove obvious junk
  if (!s || s.length < 2) return "";
  // strip domain suffixes that show up in snippets
  s = s.replace(/\.com$|\.io$|\.ai$|\.co$|\.net$|\.org$/i, "");
  // title case-ish
  return s.replace(/\s+/g, " ").trim();
}

function extractCompetitorsFromText(text: string, company: string): string[] {
  // Split on commas, bullets, pipes; grab capitalized phrases
  const bits = text
    .split(/[,|•·\n\r;]+/g)
    .map(normalizeBrand)
    .filter(Boolean);
  const uniq = new Set<string>();
  for (const b of bits) {
    // skip the queried company itself
    if (b.toLowerCase() === company.toLowerCase()) continue;
    // heuristic: brand-y tokens (has uppercase letter)
    if (!/[A-Z]/.test(b)) continue;
    // keep shortish names; avoid sentences
    if (b.length > 60) continue;
    uniq.add(b);
  }
  return Array.from(uniq);
}

async function searchCSE(q: string) {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return { provider: "demo", items: [] as any[] };

  const params = new URLSearchParams({
    q,
    key,
    cx,
    num: "10",
    safe: "off",
  });
  const url = `https://www.googleapis.com/customsearch/v1?${params}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const items = (data.items || []).map((it: any) => ({
    title: it.title as string,
    snippet: it.snippet as string,
    link: it.link as string,
  }));
  return { provider: "cse", items };
}

export async function POST(req: NextRequest) {
  try {
    const { company, withWeb = true } = await req.json();

    if (!company || typeof company !== "string") {
      return NextResponse.json({ error: "Missing 'company'" }, { status: 400 });
    }

    // 1) Gather evidence from the web (if keys present)
    let webCompetitors: string[] = [];
    let industrySignals: string[] = [];

    if (withWeb && process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX) {
      const queries = [
        `${company} competitors`,
        `alternatives to ${company}`,
        `similar companies to ${company}`,
      ];

      const allItems: { title: string; snippet: string }[] = [];
      for (const q of queries) {
        const s = await searchCSE(q);
        allItems.push(...s.items);
      }

      const texts = allItems.flatMap((it) => [it.title, it.snippet].filter(Boolean)) as string[];
      const compSets = texts.map((t) => extractCompetitorsFromText(t, company));
      const compUniq = new Set<string>();
      compSets.flat().forEach((c) => compUniq.add(c));
      webCompetitors = Array.from(compUniq).slice(0, 20);

      // crude industry term seeds from snippets/titles
      const seedTerms = new Set<string>();
      for (const t of texts) {
        for (const m of t.toLowerCase().matchAll(/\b(compliance|ediscovery|investigation|privacy|esg|aml|governance|legal ops|risk|audit|sanctions|whistleblow\w*)\b/gi)) {
          seedTerms.add(m[0]);
        }
      }
      industrySignals = Array.from(seedTerms);
    }

    // 2) If we have the new GenAI SDK + key, use it to clean/rank + expand ICP/terms
    let competitors: string[] = webCompetitors;
    let icp_terms: string[] = [];
    let industry_terms: string[] = [];

    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

        const sys =
          `You are assisting with go-to-market targeting for a B2B product. ` +
          `Return STRICT JSON with keys: competitors (brand names only), icp_terms (buyer titles/roles), industry_terms (keywords). ` +
          `Keep competitors to ${CLEAN_LIMITS.competitors} max; icp_terms and industry_terms to ${CLEAN_LIMITS.terms} max each.`;

        const user =
          `Company: ${company}\n` +
          `Observed competitor candidates: ${JSON.stringify(webCompetitors)}\n` +
          `Observed industry signals: ${JSON.stringify(industrySignals)}\n` +
          `Instructions:\n` +
          `1) Validate competitor candidates (remove the company itself; dedupe; keep only likely brands).\n` +
          `2) Propose missing direct competitors if obvious.\n` +
          `3) Produce ICP terms (decision-maker roles/titles) specific to this company's market.\n` +
          `4) Produce industry_terms that are useful for event search filters.\n` +
          `Return strict JSON only.`;

        const resp = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "system", parts: [{ text: sys }] }, { role: "user", parts: [{ text: user }] }],
        });

        const text = (resp as any)?.text ?? "";
        if (text) {
          const parsed = JSON.parse(text);
          competitors = Array.isArray(parsed.competitors) ? parsed.competitors : competitors;
          icp_terms = Array.isArray(parsed.icp_terms) ? parsed.icp_terms : icp_terms;
          industry_terms = Array.isArray(parsed.industry_terms) ? parsed.industry_terms : industry_terms;
        }
      } catch (e) {
        // keep deterministic fallback behavior
      }
    }

    // 3) Fallbacks if model missing or too generic
    if (!competitors?.length && webCompetitors?.length) competitors = webCompetitors;
    if (!icp_terms?.length) {
      const fallback = await fallbackPayload(company);
      icp_terms = fallback.icp_terms;
    }
    if (!industry_terms?.length) {
      const fallback = await fallbackPayload(company);
      industry_terms = Array.from(new Set([...industrySignals, ...fallback.industry_terms]));
    }

    // 4) Final shaping/limits
    const uniq = (arr: string[]) =>
      Array.from(new Set(arr.map((x) => x.trim()).filter((x) => x && x.toLowerCase() !== company.toLowerCase())));

    const out: GenOut = {
      competitors: uniq(competitors).slice(0, CLEAN_LIMITS.competitors),
      icp_terms: uniq(icp_terms).slice(0, CLEAN_LIMITS.terms),
      industry_terms: uniq(industry_terms).slice(0, CLEAN_LIMITS.terms),
      debug: {
        usedWeb: !!(withWeb && process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX),
        seeds: { webCompetitors, industrySignals },
      },
    };

    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "generate failed", ...fallbackPayload("") }, { status: 200 });
  }
}