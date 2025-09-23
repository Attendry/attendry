import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// Default industry templates
const INDUSTRY_TEMPLATES = {
  "legal-compliance": {
    name: "Legal & Compliance",
    description: "Legal technology, compliance, and regulatory events",
    baseQuery: "(legal OR compliance OR investigation OR \"e-discovery\" OR ediscovery OR \"legal tech\" OR \"legal technology\" OR \"regulatory\" OR \"governance\" OR \"risk management\" OR \"audit\" OR \"whistleblowing\" OR \"data protection\" OR \"GDPR\" OR \"privacy\" OR \"cybersecurity\" OR \"regtech\" OR \"ESG\") (conference OR summit OR forum OR \"trade show\" OR exhibition OR convention OR \"industry event\" OR \"business event\" OR konferenz OR kongress OR symposium OR veranstaltung OR workshop OR seminar OR webinar OR \"training\" OR \"certification\") (2025 OR \"next year\" OR upcoming OR \"this year\" OR \"25. September\" OR \"September 2025\" OR \"Oktober 2025\" OR \"November 2025\" OR \"Dezember 2025\" OR \"Q1 2025\" OR \"Q2 2025\" OR \"Q3 2025\" OR \"Q4 2025\")",
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
      const supabase = await supabaseServer();
      
      // Ensure logged in
      const { data: me, error: meErr } = await supabase.auth.getUser();
      if (meErr || !me?.user) {
        // If not authenticated, return default config
        console.warn('User not authenticated for search config, using default');
      } else {
        // Get current search configuration
        const { data, error } = await supabase
          .from("search_configurations")
          .select("*")
          .eq("is_active", true)
          .single();

        if (!error && data) {
          config = data;
        }
      }
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

    return NextResponse.json({
      config: currentConfig,
      templates: INDUSTRY_TEMPLATES
    });
  } catch (error: any) {
    // Ultimate fallback - return default configuration
    console.error('Search config API error:', error);
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
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();

    // Ensure logged in
    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user) {
      console.error('Authentication error:', meErr);
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    console.log('User authenticated:', me.user.id);

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

    // Deactivate current configuration
    const { error: deactivateError } = await supabase
      .from("search_configurations")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) {
      console.error('Error deactivating current config:', deactivateError);
      // Continue anyway, this might be the first config
    }

    // Create new configuration
    const { data, error } = await supabase
      .from("search_configurations")
      .insert({
        name,
        industry,
        base_query: baseQuery,
        exclude_terms: excludeTerms,
        industry_terms: industryTerms,
        icp_terms: icpTerms,
        speaker_prompts: speakerPrompts,
        is_active: isActive
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ 
        error: "Failed to save configuration", 
        details: error.message,
        code: error.code 
      }, { status: 500 });
    }

    console.log('Configuration saved successfully:', data);
    return NextResponse.json({ config: data });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error:', error);
    return NextResponse.json({ 
      error: "Failed to save configuration", 
      details: errorMessage 
    }, { status: 500 });
  }
}
