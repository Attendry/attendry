// common/search/config.ts
import { supabaseAdmin } from '@/lib/supabase-admin';

export type ActiveConfig = {
  id: string;
  name: string;
  industry: string;
  baseQuery: string;
  excludeTerms?: string;
  // snake_case mirrors allowed too
  base_query?: string;
  exclude_terms?: string;
};

let cached: ActiveConfig | null = null;

// Default industry templates (same as in the API route)
const INDUSTRY_TEMPLATES = {
  "legal-compliance": {
    name: "Legal & Compliance",
    description: "Legal technology, compliance, and regulatory events",
    baseQuery: "(legal OR compliance OR investigation OR \"e-discovery\" OR ediscovery OR \"legal tech\" OR \"legal technology\" OR \"regulatory\" OR \"governance\" OR \"risk management\" OR \"audit\" OR \"whistleblowing\" OR \"data protection\" OR \"GDPR\" OR \"privacy\" OR \"cybersecurity\" OR \"regtech\" OR \"ESG\" OR recht OR rechtskonformität OR regelkonformität OR \"rechtliche technologie\" OR \"recht tech\" OR \"datenschutz\" OR \"hinweisgeberschutz\" OR \"geldwäsche\" OR sanktionen OR \"interne untersuchung\" OR \"compliance management\") (conference OR summit OR forum OR \"trade show\" OR exhibition OR convention OR \"industry event\" OR \"business event\" OR konferenz OR kongress OR symposium OR veranstaltung OR fachkongress OR fachkonferenz OR fachmesse OR fachforum OR workshop OR seminar OR webinar OR \"training\" OR \"certification\") (2025 OR \"next year\" OR upcoming OR \"this year\" OR \"September 2025\" OR \"Oktober 2025\" OR \"November 2025\" OR \"Dezember 2025\" OR \"Q1 2025\" OR \"Q2 2025\" OR \"Q3 2025\" OR \"Q4 2025\")",
    excludeTerms: "reddit Mumsnet \"legal advice\" forum",
  }
};

export async function loadActiveConfig(): Promise<ActiveConfig> {
  if (cached) return cached;
  
  try {
    // Try to get configuration from database using admin client
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("search_configurations")
      .select("*")
      .eq("is_active", true)
      .single();
    
    if (!error && data) {
      const cfg = data as any;
      // normalize camelCase first, then fall back to snake_case
      const baseQuery = cfg.baseQuery || cfg.base_query || '';
      const excludeTerms = cfg.excludeTerms || cfg.exclude_terms || '';
      cached = { 
        id: cfg.id,
        name: cfg.name,
        industry: cfg.industry,
        baseQuery,
        excludeTerms
      };
      return cached!;
    }
  } catch (dbError) {
    console.warn('Database not available for search config, using default:', dbError);
  }

  // Fallback to default template
  const defaultTemplate = INDUSTRY_TEMPLATES["legal-compliance"];
  const defaultConfig: ActiveConfig = {
    id: 'default',
    name: defaultTemplate.name,
    industry: 'legal-compliance',
    baseQuery: defaultTemplate.baseQuery,
    excludeTerms: defaultTemplate.excludeTerms
  };
  
  cached = defaultConfig;
  return defaultConfig;
}
