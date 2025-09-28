// Enhanced orchestrator with full pipeline: Search → Prioritization → Extract
import { loadActiveConfig } from './config';
import { buildSearchQuery } from './queryBuilder';
import { search as firecrawlSearch } from '../../providers/firecrawl';
import { search as cseSearch } from '../../providers/cse';
import { search as databaseSearch } from '../../providers/database';

type ExecArgs = {
  userText?: string;
  country?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  locale?: 'de' | 'en';
  location?: string | null; // 'EU' or specific country codes
  timeframe?: string | null; // 'next_7', 'next_14', 'next_30', 'past_7', 'past_14', 'past_30'
};

// Helper function to process timeframe into date range
function processTimeframe(timeframe: string | null): { dateFrom: string | null; dateTo: string | null } {
  if (!timeframe) return { dateFrom: null, dateTo: null };
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (timeframe) {
    case 'next_7':
      return {
        dateFrom: today.toISOString().split('T')[0],
        dateTo: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
    case 'next_14':
      return {
        dateFrom: today.toISOString().split('T')[0],
        dateTo: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
    case 'next_30':
      return {
        dateFrom: today.toISOString().split('T')[0],
        dateTo: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
    case 'past_7':
      return {
        dateFrom: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0]
      };
    case 'past_14':
      return {
        dateFrom: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0]
      };
    case 'past_30':
      return {
        dateFrom: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0]
      };
    default:
      return { dateFrom: null, dateTo: null };
  }
}

// Helper function to process location into country codes
function processLocation(location: string | null): string[] {
  if (!location) return ['DE']; // Default to Germany
  
  if (location.toUpperCase() === 'EU') {
    return ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'LU', 'DK', 'SE', 'NO', 'FI', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'BG', 'RO', 'EE', 'LV', 'LT', 'MT', 'CY', 'IE', 'PT', 'GR'];
  }
  
  // Single country code
  return [location.toUpperCase()];
}

// Helper function to build location-aware query
function buildLocationAwareQuery(baseQuery: string, userText: string, location: string | null): string {
  const countries = processLocation(location);
  
  if (countries.length === 1) {
    // Single country - add country-specific terms
    const country = countries[0];
    const countryTerms = {
      'DE': ['Germany', 'Deutschland', 'Berlin', 'München', 'Frankfurt', 'Köln', 'Hamburg', 'Stuttgart'],
      'AT': ['Austria', 'Österreich', 'Wien', 'Salzburg', 'Graz', 'Innsbruck'],
      'CH': ['Switzerland', 'Schweiz', 'Zürich', 'Bern', 'Basel', 'Genf'],
      'FR': ['France', 'Frankreich', 'Paris', 'Lyon', 'Marseille', 'Toulouse'],
      'IT': ['Italy', 'Italien', 'Roma', 'Milano', 'Napoli', 'Torino'],
      'ES': ['Spain', 'Spanien', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla'],
      'NL': ['Netherlands', 'Niederlande', 'Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht'],
      'BE': ['Belgium', 'Belgien', 'Brussels', 'Brüssel', 'Antwerp', 'Antwerpen'],
      'LU': ['Luxembourg', 'Luxemburg'],
      'DK': ['Denmark', 'Dänemark', 'Copenhagen', 'Kopenhagen'],
      'SE': ['Sweden', 'Schweden', 'Stockholm', 'Göteborg', 'Malmö'],
      'NO': ['Norway', 'Norwegen', 'Oslo', 'Bergen', 'Trondheim'],
      'FI': ['Finland', 'Finnland', 'Helsinki', 'Tampere', 'Turku'],
      'PL': ['Poland', 'Polen', 'Warsaw', 'Warschau', 'Krakow', 'Krakau'],
      'CZ': ['Czech Republic', 'Tschechien', 'Prague', 'Prag', 'Brno'],
      'HU': ['Hungary', 'Ungarn', 'Budapest', 'Debrecen', 'Szeged'],
      'SK': ['Slovakia', 'Slowakei', 'Bratislava', 'Košice'],
      'SI': ['Slovenia', 'Slowenien', 'Ljubljana', 'Maribor'],
      'HR': ['Croatia', 'Kroatien', 'Zagreb', 'Split', 'Rijeka'],
      'BG': ['Bulgaria', 'Bulgarien', 'Sofia', 'Plovdiv', 'Varna'],
      'RO': ['Romania', 'Rumänien', 'Bucharest', 'Bukarest', 'Cluj-Napoca'],
      'EE': ['Estonia', 'Estland', 'Tallinn', 'Tartu'],
      'LV': ['Latvia', 'Lettland', 'Riga', 'Daugavpils'],
      'LT': ['Lithuania', 'Litauen', 'Vilnius', 'Kaunas'],
      'MT': ['Malta', 'Valletta', 'Sliema'],
      'CY': ['Cyprus', 'Zypern', 'Nicosia', 'Limassol'],
      'IE': ['Ireland', 'Irland', 'Dublin', 'Cork', 'Galway'],
      'PT': ['Portugal', 'Lissabon', 'Porto', 'Coimbra'],
      'GR': ['Greece', 'Griechenland', 'Athens', 'Athen', 'Thessaloniki']
    };
    
    const terms = countryTerms[country] || [country];
    const locationTerms = terms.slice(0, 3).join(' OR '); // Use first 3 terms
    return `${baseQuery} (${locationTerms})`;
  } else {
    // Multiple countries (EU) - add broader European terms
    const euTerms = ['Europe', 'Europa', 'European', 'Europäisch', 'EU'];
    const locationTerms = euTerms.join(' OR ');
    return `${baseQuery} (${locationTerms})`;
  }
}

// Simple Gemini prioritization (without full OptimizedAIService dependency)
async function prioritizeUrls(urls: string[], country: string, location: string | null): Promise<string[]> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[prioritization] No GEMINI_API_KEY, returning all URLs');
      return urls;
    }

    // Create a location-aware prompt for prioritization
    const countries = processLocation(location);
    const locationContext = countries.length === 1 ? 
      `in ${countries[0]}` : 
      `in European countries (${countries.slice(0, 5).join(', ')}...)`;
    
    const prompt = `You are a legal events expert. Given these URLs, return the top 10 most relevant for legal/compliance events ${locationContext}. 

URLs: ${urls.slice(0, 20).join(', ')}

Return only a JSON array of the most relevant URLs, like: ["url1", "url2", "url3"]`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      console.warn('[prioritization] Gemini API failed:', response.status);
      return urls.slice(0, 10); // Return first 10 as fallback
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.warn('[prioritization] No content in Gemini response');
      return urls.slice(0, 10);
    }

    try {
      const prioritized = JSON.parse(content);
      if (Array.isArray(prioritized)) {
        console.log('[prioritization] Successfully prioritized', prioritized.length, 'URLs');
        return prioritized;
      }
    } catch (parseError) {
      console.warn('[prioritization] Failed to parse Gemini response:', parseError);
    }

    return urls.slice(0, 10);
  } catch (error) {
    console.error('[prioritization] Error:', error);
    return urls.slice(0, 10);
  }
}

// Simple Firecrawl extraction
async function extractEventDetails(url: string): Promise<any> {
  try {
    const apiKey = process.env.FIRECRAWL_KEY || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.warn('[extract] No Firecrawl API key');
      return { title: null, description: null, starts_at: null, country: null, venue: null };
    }

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 1000
      })
    });

    if (!response.ok) {
      console.warn('[extract] Firecrawl scrape failed for', url, response.status);
      return { title: null, description: null, starts_at: null, country: null, venue: null };
    }

    const data = await response.json();
    const content = data.data?.markdown || '';
    
    // Simple extraction logic
    const title = extractTitle(content, url);
    const description = extractDescription(content);
    const starts_at = extractDate(content);
    const country = extractCountry(content, url);
    const venue = extractVenue(content);

    return { title, description, starts_at, country, venue };
  } catch (error) {
    console.error('[extract] Error extracting', url, error);
    return { title: null, description: null, starts_at: null, country: null, venue: null };
  }
}

// Simple extraction helpers
function extractTitle(content: string, url: string): string | null {
  // Try to find title in markdown
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) return titleMatch[1].trim();
  
  // Fallback to hostname
  try {
    return `Event from ${new URL(url).hostname}`;
  } catch {
    return 'Event';
  }
}

function extractDescription(content: string): string | null {
  // Take first paragraph
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 50);
  return paragraphs[0]?.trim() || null;
}

function extractDate(content: string): string | null {
  // Look for common date patterns
  const datePatterns = [
    /(\d{1,2}\.\d{1,2}\.\d{4})/g,
    /(\d{4}-\d{2}-\d{2})/g,
    /(\d{1,2}\/\d{1,2}\/\d{4})/g
  ];
  
  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) return match[0];
  }
  
  return null;
}

function extractCountry(content: string, url: string): string | null {
  // Check URL for country indicators
  if (url.includes('.de')) return 'DE';
  if (url.includes('.at')) return 'AT';
  if (url.includes('.ch')) return 'CH';
  
  // Check content for country mentions
  const countryPatterns = [
    /\b(Germany|Deutschland)\b/i,
    /\b(Austria|Österreich)\b/i,
    /\b(Switzerland|Schweiz)\b/i
  ];
  
  for (const pattern of countryPatterns) {
    if (pattern.test(content)) {
      if (pattern.source.includes('Germany')) return 'DE';
      if (pattern.source.includes('Austria')) return 'AT';
      if (pattern.source.includes('Switzerland')) return 'CH';
    }
  }
  
  return null;
}

function extractVenue(content: string): string | null {
  // Look for venue patterns
  const venuePatterns = [
    /venue[:\s]+([^\n]+)/i,
    /location[:\s]+([^\n]+)/i,
    /ort[:\s]+([^\n]+)/i
  ];
  
  for (const pattern of venuePatterns) {
    const match = content.match(pattern);
    if (match) return match[1].trim();
  }
  
  return null;
}

export async function executeEnhancedSearch(args: ExecArgs) {
  const { 
    userText = '', 
    country = 'DE', 
    dateFrom = null, 
    dateTo = null, 
    locale = 'de',
    location = null,
    timeframe = null
  } = args;

  const cfg = await loadActiveConfig();
  const baseQuery = cfg.baseQuery;
  const excludeTerms = cfg.excludeTerms || '';

  // Process timeframe into date range
  const timeframeDates = processTimeframe(timeframe);
  const effectiveDateFrom = dateFrom || timeframeDates.dateFrom;
  const effectiveDateTo = dateTo || timeframeDates.dateTo;

  // Build location-aware query
  const baseQ = buildSearchQuery({ baseQuery, userText, excludeTerms });
  const q = buildLocationAwareQuery(baseQ, userText, location);

  console.log('[enhanced_orchestrator] Search parameters:', {
    userText,
    country,
    location,
    timeframe,
    effectiveDateFrom,
    effectiveDateTo,
    query: q
  });

  const providersTried: string[] = [];
  const logs: any[] = [];

  // Step 1: Search for URLs
  console.log('[enhanced_orchestrator] Step 1: Searching for URLs');
  let urls: string[] = [];
  
  // Try Firecrawl first
  try {
    providersTried.push('firecrawl');
    const firecrawlRes = await firecrawlSearch({ q, dateFrom: effectiveDateFrom, dateTo: effectiveDateTo });
    urls = firecrawlRes?.items || [];
    logs.push({ at: 'search', provider: 'firecrawl', count: urls.length, q, dateFrom: effectiveDateFrom, dateTo: effectiveDateTo });
    console.log('[enhanced_orchestrator] Firecrawl found', urls.length, 'URLs');
  } catch (error) {
    console.warn('[enhanced_orchestrator] Firecrawl failed:', error);
  }

  // Try CSE if Firecrawl didn't return enough
  if (urls.length < 10) {
    try {
      providersTried.push('cse');
      const cseRes = await cseSearch({ q, country });
      const cseUrls = cseRes?.items || [];
      urls = [...new Set([...urls, ...cseUrls])]; // Dedupe
      logs.push({ at: 'search', provider: 'cse', count: cseUrls.length, q });
      console.log('[enhanced_orchestrator] CSE added', cseUrls.length, 'more URLs');
    } catch (error) {
      console.warn('[enhanced_orchestrator] CSE failed:', error);
    }
  }

  // Database fallback if still not enough
  if (urls.length < 5) {
    try {
      providersTried.push('database');
      const dbRes = await databaseSearch({ q, country });
      const dbUrls = dbRes?.items || [];
      urls = [...new Set([...urls, ...dbUrls])];
      logs.push({ at: 'search', provider: 'database', count: dbUrls.length, q });
      console.log('[enhanced_orchestrator] Database fallback added', dbUrls.length, 'URLs');
    } catch (error) {
      console.warn('[enhanced_orchestrator] Database fallback failed:', error);
    }
  }

  if (urls.length === 0) {
    console.warn('[enhanced_orchestrator] No URLs found');
    return { events: [], logs, effectiveQ: q, searchRetriedWithBase: false };
  }

  // Step 2: Prioritize URLs with Gemini
  console.log('[enhanced_orchestrator] Step 2: Prioritizing URLs with Gemini');
  const prioritizedUrls = await prioritizeUrls(urls, country, location);
  logs.push({ at: 'prioritization', inputCount: urls.length, outputCount: prioritizedUrls.length, location });

  // Step 3: Extract event details from prioritized URLs
  console.log('[enhanced_orchestrator] Step 3: Extracting event details');
  const events = [];
  
  for (let i = 0; i < Math.min(prioritizedUrls.length, 10); i++) {
    const url = prioritizedUrls[i];
    console.log('[enhanced_orchestrator] Extracting', i + 1, 'of', Math.min(prioritizedUrls.length, 10), ':', url);
    
    const details = await extractEventDetails(url);
    events.push({
      id: `event_${i}`,
      title: details.title,
      source_url: url,
      starts_at: details.starts_at,
      country: details.country,
      venue: details.venue,
      description: details.description,
      speakers: []
    });
  }

  logs.push({ at: 'extraction', inputCount: prioritizedUrls.length, outputCount: events.length });

  console.log('[enhanced_orchestrator] Completed pipeline:', {
    searchUrls: urls.length,
    prioritizedUrls: prioritizedUrls.length,
    extractedEvents: events.length
  });

  return {
    events,
    logs,
    effectiveQ: q,
    searchRetriedWithBase: false,
    providersTried
  };
}
