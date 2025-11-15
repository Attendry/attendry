import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ConfigService } from "@/lib/services/config-service";

// Default industry templates
const INDUSTRY_TEMPLATES = {
  "legal-compliance": {
    name: "Legal & Compliance",
    description: "Legal technology, compliance, and regulatory events",
    baseQuery: "(legal OR compliance OR investigation OR \"e-discovery\" OR ediscovery OR \"legal tech\" OR \"legal technology\" OR \"regulatory\" OR \"governance\" OR \"risk management\" OR \"audit\" OR \"whistleblowing\" OR \"data protection\" OR \"GDPR\" OR \"privacy\" OR \"cybersecurity\" OR \"regtech\" OR \"ESG\" OR recht OR rechtskonformität OR regelkonformität OR \"rechtliche technologie\" OR \"recht tech\" OR \"datenschutz\" OR \"hinweisgeberschutz\" OR \"geldwäsche\" OR sanktionen OR \"interne untersuchung\" OR \"compliance management\") (conference OR summit OR forum OR \"trade show\" OR exhibition OR convention OR \"industry event\" OR \"business event\" OR konferenz OR kongress OR symposium OR veranstaltung OR fachkongress OR fachkonferenz OR fachmesse OR fachforum OR workshop OR seminar OR webinar OR \"training\" OR \"certification\") (2025 OR \"next year\" OR upcoming OR \"this year\" OR \"September 2025\" OR \"Oktober 2025\" OR \"November 2025\" OR \"Dezember 2025\" OR \"Q1 2025\" OR \"Q2 2025\" OR \"Q3 2025\" OR \"Q4 2025\")",
    excludeTerms: "reddit Mumsnet \"legal advice\" forum",
    industryTerms: ["compliance", "investigations", "regtech", "ESG", "sanctions", "governance", "legal ops", "risk", "audit", "whistleblow", "legal tech", "legal technology", "e-discovery", "ediscovery", "data protection", "GDPR", "privacy", "cybersecurity", "regulatory", "risk management", "internal audit", "external audit", "compliance management", "regulatory affairs", "legal operations", "contract management", "litigation", "dispute resolution", "corporate governance", "ethics", "anti-corruption", "AML", "KYC", "financial crime", "fraud prevention", "internal controls", "SOX", "MiFID", "Basel", "IFRS", "GAAP"],
    icpTerms: ["general counsel", "chief compliance officer", "investigations lead", "compliance manager", "legal operations", "legal counsel", "compliance officer"],
    speakerPrompts: {
      extraction: "Extract ALL speakers on the page(s). For each, return name, organization (org), title/role if present, and profile_url if linked. Look for sections labelled Speakers, Referenten, Referent:innen, Sprecher, Vortragende, Mitwirkende, Panel, Agenda/Programm/Fachprogramm. Do not invent names; only list people visible on the pages.",
      normalization: "You are a data normalizer. Merge duplicate speakers across pages. Return clean JSON with fields: name, org, title, profile_url, source_url (one of the pages), confidence (0-1). Do not invent people. Keep only real names (≥2 tokens)."
    }
  },
  "fintech": {
    name: "FinTech",
    description: "Financial technology and digital banking events",
    baseQuery: "(fintech OR \"financial technology\" OR \"digital banking\" OR \"payment systems\" OR \"blockchain\" OR \"cryptocurrency\")",
    excludeTerms: "reddit forum gambling casino",
    industryTerms: ["fintech", "digital banking", "payments", "blockchain", "cryptocurrency", "regtech", "insurtech", "wealthtech", "lending", "trading"],
    icpTerms: ["chief technology officer", "head of digital", "product manager", "compliance officer", "risk manager"],
    speakerPrompts: {
      extraction: "Extract ALL speakers on the page(s). For each, return name, organization (org), title/role if present, and profile_url if linked. Look for sections labelled Speakers, Keynotes, Panelists, Presenters, Moderators. Focus on fintech, banking, and financial services professionals. Do not invent names; only list people visible on the pages.",
      normalization: "You are a data normalizer. Merge duplicate speakers across pages. Return clean JSON with fields: name, org, title, profile_url, source_url (one of the pages), confidence (0-1). Do not invent people. Keep only real names (≥2 tokens)."
    }
  },
  "healthcare": {
    name: "Healthcare Technology",
    description: "Healthcare technology and digital health events",
    baseQuery: "(healthtech OR \"healthcare technology\" OR \"digital health\" OR \"medical technology\" OR \"healthcare innovation\")",
    excludeTerms: "reddit forum medical advice",
    industryTerms: ["healthtech", "digital health", "medical technology", "telemedicine", "healthcare innovation", "patient care", "healthcare data", "medical devices"],
    icpTerms: ["chief medical officer", "head of digital health", "healthcare IT director", "clinical informatics", "healthcare innovation lead"],
    speakerPrompts: {
      extraction: "Extract ALL speakers on the page(s). For each, return name, organization (org), title/role if present, and profile_url if linked. Look for sections labelled Speakers, Keynotes, Panelists, Medical Experts, Healthcare Leaders. Focus on healthcare, medical, and healthtech professionals. Do not invent names; only list people visible on the pages.",
      normalization: "You are a data normalizer. Merge duplicate speakers across pages. Return clean JSON with fields: name, org, title, profile_url, source_url (one of the pages), confidence (0-1). Do not invent people. Keep only real names (≥2 tokens)."
    }
  },
  "general": {
    name: "General Business",
    description: "General business and professional events",
    baseQuery: "(conference OR summit OR \"business event\" OR \"professional development\" OR networking)",
    excludeTerms: "reddit forum personal blog",
    industryTerms: ["business", "professional development", "networking", "leadership", "innovation", "strategy", "management"],
    icpTerms: ["executive", "manager", "director", "business leader", "entrepreneur"],
    speakerPrompts: {
      extraction: "Extract ALL speakers on the page(s). For each, return name, organization (org), title/role if present, and profile_url if linked. Look for sections labelled Speakers, Keynotes, Panelists, Presenters. Do not invent names; only list people visible on the pages.",
      normalization: "You are a data normalizer. Merge duplicate speakers across pages. Return clean JSON with fields: name, org, title, profile_url, source_url (one of the pages), confidence (0-1). Do not invent people. Keep only real names (≥2 tokens)."
    }
  }
};

export async function GET(req: NextRequest) {
  try {
    // Try to get configuration from database, but fallback to default if it fails
    let config = null;
    
    try {
      // Admin client to bypass RLS/read issues for global config
      const admin = supabaseAdmin();
      const { data, error } = await admin
        .from("search_configurations")
        .select("*")
        .eq("is_active", true)
        .single();
      if (!error && data) config = data as any;
    } catch (dbError) {
      // Database not available or table doesn't exist - use default
      console.warn('Database not available for search config, using default:', dbError);
    }

    // Build normalized camelCase config; include snake_case for admin compatibility
    let currentConfig: any;
    if (config) {
      const normalized = {
        id: config.id,
        name: config.name,
        industry: config.industry,
        baseQuery: config.base_query,
        excludeTerms: config.exclude_terms,
        industryTerms: config.industry_terms || [],
        icpTerms: config.icp_terms || [],
        speakerPrompts: config.speaker_prompts || {},
        is_active: config.is_active,
        created_at: config.created_at,
        updated_at: config.updated_at,
      };
      // expose both key styles so existing admin UI (snake_case) and search API (camelCase) both work
      currentConfig = { ...config, ...normalized };
    } else {
      const def = {
        id: "default",
        name: "Default Configuration",
        industry: "legal-compliance",
        baseQuery: INDUSTRY_TEMPLATES["legal-compliance"].baseQuery,
        excludeTerms: INDUSTRY_TEMPLATES["legal-compliance"].excludeTerms,
        industryTerms: INDUSTRY_TEMPLATES["legal-compliance"].industryTerms,
        icpTerms: INDUSTRY_TEMPLATES["legal-compliance"].icpTerms,
        speakerPrompts: INDUSTRY_TEMPLATES["legal-compliance"].speakerPrompts,
        is_active: true,
        created_at: new Date().toISOString()
      };
      currentConfig = {
        ...def,
        // add snake_case mirrors for admin UI
        base_query: def.baseQuery,
        exclude_terms: def.excludeTerms,
        industry_terms: def.industryTerms,
        icp_terms: def.icpTerms,
        speaker_prompts: def.speakerPrompts,
      };
    }

    // PERF-3.2.3: Edge caching for search config (1 hour TTL)
    return NextResponse.json({
      config: currentConfig,
      templates: INDUSTRY_TEMPLATES
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (error: any) {
    // Ultimate fallback - return default configuration
    console.error('Search config API error:', error);
    // PERF-3.2.3: Edge caching for fallback config (1 hour TTL)
    return NextResponse.json({
      config: {
        id: "fallback",
        name: "Fallback Configuration",
        industry: "legal-compliance",
        baseQuery: INDUSTRY_TEMPLATES["legal-compliance"].baseQuery,
        excludeTerms: INDUSTRY_TEMPLATES["legal-compliance"].excludeTerms,
        industryTerms: INDUSTRY_TEMPLATES["legal-compliance"].industryTerms,
        icpTerms: INDUSTRY_TEMPLATES["legal-compliance"].icpTerms,
        speakerPrompts: INDUSTRY_TEMPLATES["legal-compliance"].speakerPrompts,
        is_active: true,
        created_at: new Date().toISOString()
      },
      templates: INDUSTRY_TEMPLATES
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      name,
      industry,
      baseQuery,
      excludeTerms,
      industryTerms,
      icpTerms,
      speakerPrompts,
      isActive = true
    } = await req.json();

    if (!name || !industry) {
      return NextResponse.json({ error: "Name and industry are required" }, { status: 400 });
    }

    console.log('Saving configuration:', { name, industry, isActive });

    // Use shared configuration service
    const success = await ConfigService.saveSearchConfig({
      name,
      industry,
      baseQuery,
      excludeTerms,
      industryTerms,
      icpTerms,
      speakerPrompts,
      is_active: isActive
    });

    if (!success) {
      return NextResponse.json({ 
        error: "Failed to save configuration"
      }, { status: 500 });
    }

    console.log('Configuration saved successfully');
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error:', error);
    return NextResponse.json({ 
      error: "Failed to save configuration", 
      details: errorMessage 
    }, { status: 500 });
  }
}
