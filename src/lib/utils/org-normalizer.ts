/**
 * PHASE 2 OPTIMIZATION: Organization Name Normalization
 * 
 * Normalizes organization names to canonical forms to improve matching accuracy
 * and reduce false positives in speaker/sponsor deduplication.
 * 
 * Features:
 * - 100+ common organization aliases
 * - Case-insensitive matching
 * - Fuzzy matching for variations
 * - Handles common suffixes (Corp, Inc, LLC, etc.)
 */

/**
 * Canonical organization names mapped to their common aliases
 * Format: canonical_name -> [alias1, alias2, ...]
 */
const ORG_ALIASES: Record<string, string[]> = {
  // Technology Companies
  'International Business Machines': ['ibm', 'ibm corp', 'ibm corporation', 'international business machines corp'],
  'Microsoft Corporation': ['microsoft', 'microsoft corp', 'msft', 'microsoft inc'],
  'Google LLC': ['google', 'google inc', 'alphabet', 'alphabet inc', 'google llc'],
  'Apple Inc': ['apple', 'apple inc', 'apple computer', 'apple corp'],
  'Amazon.com Inc': ['amazon', 'amazon.com', 'amazon inc', 'aws', 'amazon web services'],
  'Meta Platforms Inc': ['meta', 'facebook', 'facebook inc', 'meta platforms', 'meta inc'],
  'Oracle Corporation': ['oracle', 'oracle corp', 'oracle inc'],
  'Salesforce.com Inc': ['salesforce', 'salesforce.com', 'sfdc', 'salesforce inc'],
  'SAP SE': ['sap', 'sap ag', 'sap se', 'sap systems'],
  'Adobe Inc': ['adobe', 'adobe systems', 'adobe inc', 'adobe systems inc'],
  'Intel Corporation': ['intel', 'intel corp', 'intel corporation'],
  'Cisco Systems Inc': ['cisco', 'cisco systems', 'cisco inc', 'cisco corp'],
  'Dell Technologies Inc': ['dell', 'dell technologies', 'dell inc', 'dell corp'],
  'HP Inc': ['hp', 'hewlett-packard', 'hp inc', 'hp corp', 'hewlett packard'],
  'VMware Inc': ['vmware', 'vmware inc', 'vmware corp'],
  'ServiceNow Inc': ['servicenow', 'servicenow inc', 'now'],
  'Workday Inc': ['workday', 'workday inc'],
  'Splunk Inc': ['splunk', 'splunk inc'],
  'Palantir Technologies Inc': ['palantir', 'palantir technologies', 'palantir inc'],
  
  // Consulting & Professional Services
  'Accenture': ['accenture', 'accenture plc', 'accenture llp'],
  'Deloitte': ['deloitte', 'deloitte llp', 'deloitte touche tohmatsu', 'deloitte consulting'],
  'PricewaterhouseCoopers': ['pwc', 'pricewaterhousecoopers', 'pwc llp', 'price waterhouse coopers'],
  'Ernst & Young': ['ey', 'ernst & young', 'ernst and young', 'ey llp', 'ernst & young llp'],
  'KPMG': ['kpmg', 'kpmg llp', 'kpmg international'],
  'McKinsey & Company': ['mckinsey', 'mckinsey & company', 'mckinsey and company', 'mckinsey & co'],
  'Boston Consulting Group': ['bcg', 'boston consulting group', 'boston consulting'],
  'Bain & Company': ['bain', 'bain & company', 'bain and company', 'bain & co'],
  'Capgemini': ['capgemini', 'capgemini se'],
  'Cognizant Technology Solutions': ['cognizant', 'cognizant technology', 'cts', 'cognizant tech solutions'],
  'Infosys Limited': ['infosys', 'infosys ltd', 'infosys limited'],
  'Wipro Limited': ['wipro', 'wipro ltd', 'wipro limited'],
  'Tata Consultancy Services': ['tcs', 'tata consultancy services', 'tata consulting'],
  'Atos SE': ['atos', 'atos se', 'atos origin'],
  
  // Law Firms (common in legal/compliance events)
  'Latham & Watkins LLP': ['latham & watkins', 'latham and watkins', 'latham watkins', 'l&w'],
  'Kirkland & Ellis LLP': ['kirkland & ellis', 'kirkland and ellis', 'kirkland ellis', 'k&e'],
  'Skadden Arps Slate Meagher & Flom': ['skadden', 'skadden arps', 'skadden arps slate', 'skadden arps slate meagher'],
  'Sullivan & Cromwell LLP': ['sullivan & cromwell', 'sullivan and cromwell', 's&c'],
  'White & Case LLP': ['white & case', 'white and case', 'w&c'],
  'Cleary Gottlieb Steen & Hamilton LLP': ['cleary gottlieb', 'cleary gottlieb steen', 'cleary', 'cgs&h'],
  'Davis Polk & Wardwell LLP': ['davis polk', 'davis polk & wardwell', 'davis polk and wardwell', 'dpw'],
  'Simpson Thacher & Bartlett LLP': ['simpson thacher', 'simpson thacher & bartlett', 'st&b'],
  'Cravath Swaine & Moore LLP': ['cravath', 'cravath swaine', 'cravath swaine & moore', 'csm'],
  'Wachtell Lipton Rosen & Katz': ['wachtell lipton', 'wachtell', 'wlrk'],
  'Freshfields Bruckhaus Deringer': ['freshfields', 'freshfields bruckhaus', 'freshfields bhd'],
  'Clifford Chance LLP': ['clifford chance', 'clifford chance llp'],
  'Linklaters LLP': ['linklaters', 'linklaters llp'],
  'Allen & Overy LLP': ['allen & overy', 'allen and overy', 'a&o'],
  'Herbert Smith Freehills': ['herbert smith', 'herbert smith freehills', 'hsf'],
  'Baker McKenzie': ['baker mckenzie', 'baker & mckenzie'],
  'DLA Piper': ['dla piper', 'dla piper llp'],
  'Hogan Lovells': ['hogan lovells', 'hogan & lovells'],
  'Norton Rose Fulbright': ['norton rose', 'norton rose fulbright'],
  
  // Financial Services
  'JPMorgan Chase & Co': ['jpmorgan', 'jpmorgan chase', 'jp morgan', 'jpm', 'jpmorgan chase & co'],
  'Goldman Sachs Group Inc': ['goldman sachs', 'goldman sachs group', 'gs', 'goldman'],
  'Morgan Stanley': ['morgan stanley', 'ms', 'morgan stanley & co'],
  'Bank of America Corp': ['bank of america', 'bofa', 'boa', 'bank of america corp'],
  'Citigroup Inc': ['citigroup', 'citi', 'citibank', 'citigroup inc'],
  'Deutsche Bank AG': ['deutsche bank', 'db', 'deutsche bank ag'],
  'Credit Suisse Group AG': ['credit suisse', 'cs', 'credit suisse group'],
  'UBS Group AG': ['ubs', 'ubs group', 'ubs ag'],
  'Barclays PLC': ['barclays', 'barclays plc', 'barclays bank'],
  'HSBC Holdings PLC': ['hsbc', 'hsbc holdings', 'hsbc bank'],
  
  // Healthcare & Pharma
  'Johnson & Johnson': ['j&j', 'johnson & johnson', 'johnson and johnson', 'jnj'],
  'Pfizer Inc': ['pfizer', 'pfizer inc'],
  'Merck & Co Inc': ['merck', 'merck & co', 'merck and co', 'msd'],
  'Novartis AG': ['novartis', 'novartis ag'],
  'Roche Holding AG': ['roche', 'roche holding', 'roche ag'],
  'GlaxoSmithKline PLC': ['gsk', 'glaxosmithkline', 'glaxo smith kline'],
  'AstraZeneca PLC': ['astrazeneca', 'astra zeneca', 'az'],
  'Bayer AG': ['bayer', 'bayer ag'],
  'Sanofi SA': ['sanofi', 'sanofi sa'],
  'AbbVie Inc': ['abbvie', 'abbvie inc'],
  
  // Automotive
  'Volkswagen AG': ['vw', 'volkswagen', 'volkswagen ag', 'vokswagen'],
  'BMW AG': ['bmw', 'bmw ag', 'bayerische motoren werke'],
  'Daimler AG': ['daimler', 'mercedes-benz', 'mercedes benz', 'daimler ag'],
  'Audi AG': ['audi', 'audi ag'],
  'Porsche AG': ['porsche', 'porsche ag'],
  
  // Energy & Utilities
  'Exxon Mobil Corporation': ['exxon', 'exxon mobil', 'exxonmobil', 'exxon mobil corp'],
  'Shell PLC': ['shell', 'royal dutch shell', 'shell plc', 'shell oil'],
  'BP PLC': ['bp', 'british petroleum', 'bp plc'],
  'TotalEnergies SE': ['total', 'total energies', 'totalenergies', 'total sa'],
  'Chevron Corporation': ['chevron', 'chevron corp'],
  
  // Retail & Consumer
  'Walmart Inc': ['walmart', 'walmart inc', 'walmart stores'],
  'The Coca-Cola Company': ['coca-cola', 'coca cola', 'coke', 'coca-cola company'],
  'PepsiCo Inc': ['pepsico', 'pepsi', 'pepsico inc'],
  'Nestlé SA': ['nestle', 'nestlé', 'nestle sa'],
  'Unilever PLC': ['unilever', 'unilever plc'],
  'Procter & Gamble Co': ['p&g', 'procter & gamble', 'procter and gamble', 'pg'],
  
  // Telecommunications
  'AT&T Inc': ['at&t', 'att', 'at and t', 'at&t inc'],
  'Verizon Communications Inc': ['verizon', 'verizon communications', 'verizon inc'],
  'Vodafone Group PLC': ['vodafone', 'vodafone group', 'vodafone plc'],
  'Deutsche Telekom AG': ['deutsche telekom', 'dt', 'telekom', 'dt ag'],
  'Telefónica SA': ['telefonica', 'telefónica', 'telefonica sa'],
  
  // Industrial & Manufacturing
  'Siemens AG': ['siemens', 'siemens ag'],
  'General Electric Company': ['ge', 'general electric', 'general electric co', 'ge company'],
  'Honeywell International Inc': ['honeywell', 'honeywell international', 'honeywell inc'],
  '3M Company': ['3m', '3m company', 'minnesota mining'],
  'Caterpillar Inc': ['caterpillar', 'cat', 'caterpillar inc'],
  
  // Government & Public Sector
  'European Commission': ['ec', 'european commission', 'eu commission'],
  'European Parliament': ['ep', 'european parliament', 'eu parliament'],
  'European Council': ['european council', 'eu council'],
  'Federal Trade Commission': ['ftc', 'federal trade commission'],
  'Securities and Exchange Commission': ['sec', 'securities and exchange commission'],
  'Federal Communications Commission': ['fcc', 'federal communications commission'],
  
  // Non-Profit & Standards Bodies
  'International Organization for Standardization': ['iso', 'international organization for standardization'],
  'World Wide Web Consortium': ['w3c', 'world wide web consortium'],
  'Internet Engineering Task Force': ['ietf', 'internet engineering task force'],
  'European Data Protection Board': ['edpb', 'european data protection board'],
  'International Association of Privacy Professionals': ['iapp', 'international association of privacy professionals'],
};

/**
 * Common organization suffixes that should be normalized
 */
const ORG_SUFFIXES = [
  'corp', 'corporation', 'corp.', 'corp,',
  'inc', 'incorporated', 'inc.', 'inc,',
  'llc', 'l.l.c.', 'l.l.c,',
  'llp', 'l.l.p.', 'l.l.p,',
  'ltd', 'limited', 'ltd.', 'ltd,',
  'plc', 'p.l.c.', 'p.l.c,',
  'ag', 'a.g.', 'a.g,',
  'sa', 's.a.', 's.a,',
  'se', 's.e.', 's.e,',
  'gmbh', 'g.m.b.h.', 'g.m.b.h,',
  'co', 'company', 'co.', 'co,',
  'lp', 'l.p.', 'l.p,',
  'pc', 'p.c.', 'p.c,',
];

/**
 * Normalize organization name by removing common suffixes and cleaning
 */
function normalizeOrgName(org: string): string {
  if (!org || typeof org !== 'string') return '';
  
  let normalized = org.trim();
  
  // Remove common suffixes (case-insensitive)
  for (const suffix of ORG_SUFFIXES) {
    const regex = new RegExp(`\\s+${suffix.replace(/\./g, '\\.')}\\s*$`, 'i');
    normalized = normalized.replace(regex, '');
  }
  
  // Remove trailing punctuation
  normalized = normalized.replace(/[.,;:]+$/, '').trim();
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Find canonical organization name from alias map
 * Returns the canonical name if found, otherwise returns the normalized input
 */
export function normalizeOrg(org: string | null | undefined): string {
  if (!org || typeof org !== 'string') return '';
  
  const orgLower = org.toLowerCase().trim();
  if (!orgLower) return '';
  
  // Direct lookup (exact match)
  for (const [canonical, aliases] of Object.entries(ORG_ALIASES)) {
    if (aliases.some(alias => alias.toLowerCase() === orgLower)) {
      if (canonical !== org) {
        console.log('[phase2-org-normalization]', {
          original: org,
          normalized: canonical,
          method: 'exact_alias_match'
        });
      }
      return canonical;
    }
  }
  
  // Normalize and try again (handles suffixes)
  const normalized = normalizeOrgName(org);
  const normalizedLower = normalized.toLowerCase();
  
  for (const [canonical, aliases] of Object.entries(ORG_ALIASES)) {
    if (aliases.some(alias => alias.toLowerCase() === normalizedLower)) {
      if (canonical !== org) {
        console.log('[phase2-org-normalization]', {
          original: org,
          normalized: canonical,
          method: 'normalized_alias_match'
        });
      }
      return canonical;
    }
    
    // Also check if normalized input matches canonical
    if (canonical.toLowerCase() === normalizedLower) {
      if (canonical !== org) {
        console.log('[phase2-org-normalization]', {
          original: org,
          normalized: canonical,
          method: 'canonical_match'
        });
      }
      return canonical;
    }
  }
  
  // No match found, return normalized version
  if (normalized !== org) {
    console.log('[phase2-org-normalization]', {
      original: org,
      normalized: normalized,
      method: 'suffix_removed'
    });
  }
  return normalized || org;
}

/**
 * Find organization alias (fuzzy match)
 * Returns canonical name if fuzzy match found, otherwise null
 */
export function findOrgAlias(org: string | null | undefined): string | null {
  if (!org || typeof org !== 'string') return null;
  
  const orgLower = org.toLowerCase().trim();
  if (!orgLower) return null;
  
  // Try exact match first
  const exact = normalizeOrg(org);
  if (exact && exact.toLowerCase() !== normalizeOrgName(org).toLowerCase()) {
    return exact; // Found in alias map
  }
  
  // Fuzzy matching: check if org contains or is contained by any alias
  for (const [canonical, aliases] of Object.entries(ORG_ALIASES)) {
    const canonicalLower = canonical.toLowerCase();
    
    // Check if input contains canonical or vice versa
    if (orgLower.includes(canonicalLower) || canonicalLower.includes(orgLower)) {
      return canonical;
    }
    
    // Check aliases
    for (const alias of aliases) {
      const aliasLower = alias.toLowerCase();
      if (orgLower.includes(aliasLower) || aliasLower.includes(orgLower)) {
        return canonical;
      }
    }
  }
  
  return null;
}

/**
 * Get all known aliases for a canonical organization name
 */
export function getOrgVariations(canonicalName: string): string[] {
  const variations = ORG_ALIASES[canonicalName] || [];
  return [canonicalName, ...variations];
}

/**
 * Check if two organization names refer to the same organization
 * Returns true if they normalize to the same canonical name
 */
export function areSameOrg(org1: string | null | undefined, org2: string | null | undefined): boolean {
  if (!org1 || !org2) return false;
  
  const normalized1 = normalizeOrg(org1).toLowerCase();
  const normalized2 = normalizeOrg(org2).toLowerCase();
  
  if (!normalized1 || !normalized2) return false;
  
  return normalized1 === normalized2;
}

/**
 * Calculate Jaccard similarity between two organization names
 * Used for fuzzy matching in speaker disambiguation
 * Returns a value between 0 and 1
 */
export function orgSimilarity(org1: string | null | undefined, org2: string | null | undefined): number {
  if (!org1 || !org2) return 0;
  
  const normalized1 = normalizeOrg(org1).toLowerCase();
  const normalized2 = normalizeOrg(org2).toLowerCase();
  
  if (!normalized1 || !normalized2) return 0;
  
  // Exact match
  if (normalized1 === normalized2) return 1.0;
  
  // Check if they're the same org via alias map
  if (areSameOrg(org1, org2)) return 1.0;
  
  // Jaccard similarity on words
  const words1 = new Set(normalized1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(normalized2.split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

