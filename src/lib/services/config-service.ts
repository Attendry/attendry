import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Configuration Service
 * 
 * Handles loading and caching of application configurations
 */

export interface UserProfile {
  id?: string;
  full_name?: string;
  company?: string;
  competitors?: string[];
  icp_terms?: string[];
  industry_terms?: string[];
  use_in_basic_search?: boolean;
}

export interface SearchConfig {
  id?: string;
  name: string;
  industry: string;
  baseQuery: string;
  excludeTerms: string;
  industryTerms: string[];
  icpTerms: string[];
  speakerPrompts: {
    extraction: string;
    normalization: string;
  };
  is_active?: boolean;
}

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

/**
 * Configuration Service Class
 */
export class ConfigService {
  private static configCache: SearchConfig | null = null;
  private static configCacheTime: number = 0;
  private static readonly CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get search configuration with caching
   */
  static async getSearchConfig(): Promise<{
    config: SearchConfig;
    templates: typeof INDUSTRY_TEMPLATES;
  }> {
    // Check cache first
    const now = Date.now();
    if (this.configCache && (now - this.configCacheTime) < this.CONFIG_CACHE_TTL) {
      return {
        config: this.configCache,
        templates: INDUSTRY_TEMPLATES
      };
    }

    try {
      // Try to get configuration from database
      const admin = supabaseAdmin();
      const { data, error } = await admin
        .from("search_configurations")
        .select("*")
        .eq("is_active", true)
        .single();
      
      if (!error && data) {
        const config: SearchConfig = {
          id: data.id,
          name: data.name,
          industry: data.industry,
          baseQuery: data.base_query,
          excludeTerms: data.exclude_terms,
          industryTerms: data.industry_terms || [],
          icpTerms: data.icp_terms || [],
          speakerPrompts: data.speaker_prompts || {
            extraction: "",
            normalization: ""
          },
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        // Cache the config
        this.configCache = config;
        this.configCacheTime = now;

        return {
          config,
          templates: INDUSTRY_TEMPLATES
        };
      }
    } catch (dbError) {
      console.warn('Database not available for search config, using default:', dbError);
    }

    // Return default configuration
    const defaultConfig: SearchConfig = {
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

    // Cache the default config
    this.configCache = defaultConfig;
    this.configCacheTime = now;

    return {
      config: defaultConfig,
      templates: INDUSTRY_TEMPLATES
    };
  }

  /**
   * Get user profile
   */
  static async getUserProfile(): Promise<UserProfile | null> {
    try {
      const supabase = await supabaseServer();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return null;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return null;
      }

      return {
        id: profile.id,
        full_name: profile.full_name,
        company: profile.company,
        competitors: profile.competitors || [],
        icp_terms: profile.icp_terms || [],
        industry_terms: profile.industry_terms || [],
        use_in_basic_search: profile.use_in_basic_search ?? true
      };
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  }

  /**
   * Save user profile
   */
  static async saveUserProfile(profile: Omit<UserProfile, 'id'>): Promise<boolean> {
    try {
      const supabase = await supabaseServer();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return false;
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: profile.full_name,
          company: profile.company,
          competitors: profile.competitors,
          icp_terms: profile.icp_terms,
          industry_terms: profile.industry_terms,
          use_in_basic_search: profile.use_in_basic_search
        });

      return !error;
    } catch (error) {
      console.error('Error saving user profile:', error);
      return false;
    }
  }

  /**
   * Save search configuration
   */
  static async saveSearchConfig(config: Omit<SearchConfig, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      const supabase = await supabaseServer();

      // Deactivate current configuration
      await supabase
        .from("search_configurations")
        .update({ is_active: false })
        .eq("is_active", true);

      // Create new configuration
      const { error } = await supabase
        .from("search_configurations")
        .insert({
          name: config.name,
          industry: config.industry,
          base_query: config.baseQuery,
          exclude_terms: config.excludeTerms,
          industry_terms: config.industryTerms,
          icp_terms: config.icpTerms,
          speaker_prompts: config.speakerPrompts,
          is_active: config.is_active
        });

      if (!error) {
        // Clear cache to force reload
        this.configCache = null;
        this.configCacheTime = 0;
      }

      return !error;
    } catch (error) {
      console.error('Error saving search configuration:', error);
      return false;
    }
  }

  /**
   * Clear configuration cache
   */
  static clearCache(): void {
    this.configCache = null;
    this.configCacheTime = 0;
  }
}
