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

// Helper function to build event-focused query
function buildEventFocusedQuery(baseQuery: string, userText: string, location: string | null): string {
  const countries = processLocation(location);
  
  // Event-specific terms to ensure we find actual events
  const eventTerms = ['conference', 'konferenz', 'event', 'veranstaltung', 'summit', 'kongress', 'workshop', 'seminar', 'meeting', 'tagung', 'symposium', 'forum'];
  const eventQuery = `(${eventTerms.join(' OR ')})`;
  
  if (countries.length === 1) {
    // Single country - add country-specific terms with more cities
    const country = countries[0];
    const countryTerms = {
      'DE': ['Germany', 'Deutschland', 'Berlin', 'München', 'Frankfurt', 'Köln', 'Hamburg', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Hannover', 'Nürnberg', 'Bremen', 'Bonn', 'Essen', 'Mannheim', 'Münster'],
      'AT': ['Austria', 'Österreich', 'Wien', 'Salzburg', 'Graz', 'Innsbruck', 'Linz', 'Klagenfurt', 'Villach'],
      'CH': ['Switzerland', 'Schweiz', 'Zürich', 'Bern', 'Basel', 'Genf', 'Lausanne', 'Luzern', 'St. Gallen'],
      'FR': ['France', 'Frankreich', 'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg'],
      'IT': ['Italy', 'Italien', 'Roma', 'Milano', 'Napoli', 'Torino', 'Firenze', 'Bologna', 'Genova'],
      'ES': ['Spain', 'Spanien', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Zaragoza'],
      'NL': ['Netherlands', 'Niederlande', 'Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen'],
      'BE': ['Belgium', 'Belgien', 'Brussels', 'Brüssel', 'Antwerp', 'Antwerpen', 'Ghent', 'Gent', 'Bruges', 'Brugge'],
      'LU': ['Luxembourg', 'Luxemburg'],
      'DK': ['Denmark', 'Dänemark', 'Copenhagen', 'Kopenhagen', 'Aarhus', 'Odense', 'Aalborg'],
      'SE': ['Sweden', 'Schweden', 'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping', 'Örebro'],
      'NO': ['Norway', 'Norwegen', 'Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Kristiansand'],
      'FI': ['Finland', 'Finnland', 'Helsinki', 'Tampere', 'Turku', 'Oulu', 'Jyväskylä'],
      'PL': ['Poland', 'Polen', 'Warsaw', 'Warschau', 'Krakow', 'Krakau', 'Gdansk', 'Wroclaw', 'Poznan'],
      'CZ': ['Czech Republic', 'Tschechien', 'Prague', 'Prag', 'Brno', 'Ostrava', 'Plzen'],
      'HU': ['Hungary', 'Ungarn', 'Budapest', 'Debrecen', 'Szeged', 'Miskolc', 'Pécs'],
      'SK': ['Slovakia', 'Slowakei', 'Bratislava', 'Košice', 'Prešov', 'Žilina'],
      'SI': ['Slovenia', 'Slowenien', 'Ljubljana', 'Maribor', 'Celje', 'Kranj'],
      'HR': ['Croatia', 'Kroatien', 'Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar'],
      'BG': ['Bulgaria', 'Bulgarien', 'Sofia', 'Plovdiv', 'Varna', 'Burgas', 'Ruse'],
      'RO': ['Romania', 'Rumänien', 'Bucharest', 'Bukarest', 'Cluj-Napoca', 'Timișoara', 'Iași'],
      'EE': ['Estonia', 'Estland', 'Tallinn', 'Tartu', 'Narva', 'Pärnu'],
      'LV': ['Latvia', 'Lettland', 'Riga', 'Daugavpils', 'Liepāja', 'Jelgava'],
      'LT': ['Lithuania', 'Litauen', 'Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai'],
      'MT': ['Malta', 'Valletta', 'Sliema', 'Birkirkara', 'Mosta'],
      'CY': ['Cyprus', 'Zypern', 'Nicosia', 'Limassol', 'Larnaca', 'Paphos'],
      'IE': ['Ireland', 'Irland', 'Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford'],
      'PT': ['Portugal', 'Lissabon', 'Porto', 'Coimbra', 'Braga', 'Aveiro'],
      'GR': ['Greece', 'Griechenland', 'Athens', 'Athen', 'Thessaloniki', 'Patras', 'Heraklion']
    };
    
    const terms = countryTerms[country] || [country];
    const locationTerms = terms.slice(0, 5).join(' OR '); // Use more cities for better coverage
    return `${baseQuery} ${eventQuery} (${locationTerms})`;
  } else {
    // Multiple countries (EU) - add broader European terms
    const euTerms = ['Europe', 'Europa', 'European', 'Europäisch', 'EU'];
    const locationTerms = euTerms.join(' OR ');
    return `${baseQuery} ${eventQuery} (${locationTerms})`;
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
    
    // Enhanced extraction logic
    const title = extractTitle(content, url);
    const description = extractDescription(content);
    const starts_at = extractDate(content);
    const location = extractLocation(content, url);
    const venue = extractVenue(content);

    // Format location as "City, Country" if both available
    let locationFormatted = null;
    if (location.city && location.country) {
      locationFormatted = `${location.city}, ${location.country}`;
    } else if (location.country) {
      locationFormatted = location.country;
    }

    return { title, description, starts_at, country: location.country, city: location.city, location: locationFormatted, venue };
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
  // Look for common date patterns with more comprehensive matching
  const datePatterns = [
    // ISO dates
    /(\d{4}-\d{2}-\d{2})/g,
    // German dates (dd.mm.yyyy)
    /(\d{1,2}\.\d{1,2}\.\d{4})/g,
    // US dates (mm/dd/yyyy)
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    // European dates (dd/mm/yyyy)
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    // German month names
    /(\d{1,2}\.\s*(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*\d{4})/gi,
    // English month names
    /(\d{1,2}\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{4})/gi,
    // Relative dates
    /(today|heute|tomorrow|morgen|yesterday|gestern)/gi
  ];
  
  for (const pattern of datePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      // Return the first valid date found
      const dateStr = matches[0];
      
      // Convert German month names to ISO format
      if (dateStr.includes('januar') || dateStr.includes('january')) {
        return dateStr.replace(/(\d{1,2})\.?\s*(januar|january)\s*(\d{4})/gi, '$3-01-$1');
      }
      if (dateStr.includes('februar') || dateStr.includes('february')) {
        return dateStr.replace(/(\d{1,2})\.?\s*(februar|february)\s*(\d{4})/gi, '$3-02-$1');
      }
      if (dateStr.includes('märz') || dateStr.includes('march')) {
        return dateStr.replace(/(\d{1,2})\.?\s*(märz|march)\s*(\d{4})/gi, '$3-03-$1');
      }
      if (dateStr.includes('april')) {
        return dateStr.replace(/(\d{1,2})\.?\s*april\s*(\d{4})/gi, '$2-04-$1');
      }
      if (dateStr.includes('mai') || dateStr.includes('may')) {
        return dateStr.replace(/(\d{1,2})\.?\s*(mai|may)\s*(\d{4})/gi, '$3-05-$1');
      }
      if (dateStr.includes('juni') || dateStr.includes('june')) {
        return dateStr.replace(/(\d{1,2})\.?\s*(juni|june)\s*(\d{4})/gi, '$3-06-$1');
      }
      if (dateStr.includes('juli') || dateStr.includes('july')) {
        return dateStr.replace(/(\d{1,2})\.?\s*(juli|july)\s*(\d{4})/gi, '$3-07-$1');
      }
      if (dateStr.includes('august')) {
        return dateStr.replace(/(\d{1,2})\.?\s*august\s*(\d{4})/gi, '$2-08-$1');
      }
      if (dateStr.includes('september')) {
        return dateStr.replace(/(\d{1,2})\.?\s*september\s*(\d{4})/gi, '$2-09-$1');
      }
      if (dateStr.includes('oktober') || dateStr.includes('october')) {
        return dateStr.replace(/(\d{1,2})\.?\s*(oktober|october)\s*(\d{4})/gi, '$3-10-$1');
      }
      if (dateStr.includes('november')) {
        return dateStr.replace(/(\d{1,2})\.?\s*november\s*(\d{4})/gi, '$2-11-$1');
      }
      if (dateStr.includes('dezember') || dateStr.includes('december')) {
        return dateStr.replace(/(\d{1,2})\.?\s*(dezember|december)\s*(\d{4})/gi, '$3-12-$1');
      }
      
      // Handle relative dates
      if (dateStr.toLowerCase().includes('today') || dateStr.toLowerCase().includes('heute')) {
        return new Date().toISOString().split('T')[0];
      }
      if (dateStr.toLowerCase().includes('tomorrow') || dateStr.toLowerCase().includes('morgen')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
      }
      
      return dateStr;
    }
  }
  
  return null;
}

function extractLocation(content: string, url: string): { city: string | null; country: string | null } {
  // Check URL for country indicators
  let country = null;
  if (url.includes('.de')) country = 'DE';
  else if (url.includes('.at')) country = 'AT';
  else if (url.includes('.ch')) country = 'CH';
  else if (url.includes('.fr')) country = 'FR';
  else if (url.includes('.it')) country = 'IT';
  else if (url.includes('.es')) country = 'ES';
  else if (url.includes('.nl')) country = 'NL';
  else if (url.includes('.be')) country = 'BE';
  else if (url.includes('.lu')) country = 'LU';
  else if (url.includes('.dk')) country = 'DK';
  else if (url.includes('.se')) country = 'SE';
  else if (url.includes('.no')) country = 'NO';
  else if (url.includes('.fi')) country = 'FI';
  else if (url.includes('.pl')) country = 'PL';
  else if (url.includes('.cz')) country = 'CZ';
  else if (url.includes('.hu')) country = 'HU';
  else if (url.includes('.sk')) country = 'SK';
  else if (url.includes('.si')) country = 'SI';
  else if (url.includes('.hr')) country = 'HR';
  else if (url.includes('.bg')) country = 'BG';
  else if (url.includes('.ro')) country = 'RO';
  else if (url.includes('.ee')) country = 'EE';
  else if (url.includes('.lv')) country = 'LV';
  else if (url.includes('.lt')) country = 'LT';
  else if (url.includes('.mt')) country = 'MT';
  else if (url.includes('.cy')) country = 'CY';
  else if (url.includes('.ie')) country = 'IE';
  else if (url.includes('.pt')) country = 'PT';
  else if (url.includes('.gr')) country = 'GR';
  
  // Check content for country mentions
  const countryPatterns = [
    { pattern: /\b(Germany|Deutschland)\b/i, country: 'DE' },
    { pattern: /\b(Austria|Österreich)\b/i, country: 'AT' },
    { pattern: /\b(Switzerland|Schweiz)\b/i, country: 'CH' },
    { pattern: /\b(France|Frankreich)\b/i, country: 'FR' },
    { pattern: /\b(Italy|Italien)\b/i, country: 'IT' },
    { pattern: /\b(Spain|Spanien)\b/i, country: 'ES' },
    { pattern: /\b(Netherlands|Niederlande)\b/i, country: 'NL' },
    { pattern: /\b(Belgium|Belgien)\b/i, country: 'BE' },
    { pattern: /\b(Luxembourg|Luxemburg)\b/i, country: 'LU' },
    { pattern: /\b(Denmark|Dänemark)\b/i, country: 'DK' },
    { pattern: /\b(Sweden|Schweden)\b/i, country: 'SE' },
    { pattern: /\b(Norway|Norwegen)\b/i, country: 'NO' },
    { pattern: /\b(Finland|Finnland)\b/i, country: 'FI' },
    { pattern: /\b(Poland|Polen)\b/i, country: 'PL' },
    { pattern: /\b(Czech Republic|Tschechien)\b/i, country: 'CZ' },
    { pattern: /\b(Hungary|Ungarn)\b/i, country: 'HU' },
    { pattern: /\b(Slovakia|Slowakei)\b/i, country: 'SK' },
    { pattern: /\b(Slovenia|Slowenien)\b/i, country: 'SI' },
    { pattern: /\b(Croatia|Kroatien)\b/i, country: 'HR' },
    { pattern: /\b(Bulgaria|Bulgarien)\b/i, country: 'BG' },
    { pattern: /\b(Romania|Rumänien)\b/i, country: 'RO' },
    { pattern: /\b(Estonia|Estland)\b/i, country: 'EE' },
    { pattern: /\b(Latvia|Lettland)\b/i, country: 'LV' },
    { pattern: /\b(Lithuania|Litauen)\b/i, country: 'LT' },
    { pattern: /\b(Malta)\b/i, country: 'MT' },
    { pattern: /\b(Cyprus|Zypern)\b/i, country: 'CY' },
    { pattern: /\b(Ireland|Irland)\b/i, country: 'IE' },
    { pattern: /\b(Portugal)\b/i, country: 'PT' },
    { pattern: /\b(Greece|Griechenland)\b/i, country: 'GR' }
  ];
  
  for (const { pattern, country: patternCountry } of countryPatterns) {
    if (pattern.test(content)) {
      country = patternCountry;
      break;
    }
  }
  
  // Extract city from content
  let city = null;
  const cityPatterns = [
    // German cities
    { pattern: /\b(Berlin|München|Frankfurt|Köln|Hamburg|Stuttgart|Düsseldorf|Leipzig|Hannover|Nürnberg|Bremen|Bonn|Essen|Mannheim|Münster)\b/i, country: 'DE' },
    // Austrian cities
    { pattern: /\b(Wien|Salzburg|Graz|Innsbruck|Linz|Klagenfurt|Villach)\b/i, country: 'AT' },
    // Swiss cities
    { pattern: /\b(Zürich|Bern|Basel|Genf|Lausanne|Luzern|St\. Gallen)\b/i, country: 'CH' },
    // French cities
    { pattern: /\b(Paris|Lyon|Marseille|Toulouse|Nice|Nantes|Strasbourg)\b/i, country: 'FR' },
    // Italian cities
    { pattern: /\b(Roma|Milano|Napoli|Torino|Firenze|Bologna|Genova)\b/i, country: 'IT' },
    // Spanish cities
    { pattern: /\b(Madrid|Barcelona|Valencia|Sevilla|Bilbao|Málaga|Zaragoza)\b/i, country: 'ES' },
    // Dutch cities
    { pattern: /\b(Amsterdam|Rotterdam|Den Haag|Utrecht|Eindhoven|Tilburg|Groningen)\b/i, country: 'NL' },
    // Belgian cities
    { pattern: /\b(Brussels|Brüssel|Antwerp|Antwerpen|Ghent|Gent|Bruges|Brugge)\b/i, country: 'BE' },
    // Other major EU cities
    { pattern: /\b(Copenhagen|Kopenhagen|Stockholm|Oslo|Helsinki|Warsaw|Warschau|Prague|Prag|Budapest|Bratislava|Ljubljana|Zagreb|Sofia|Bucharest|Bukarest|Tallinn|Riga|Vilnius|Valletta|Nicosia|Dublin|Lissabon|Athens|Athen)\b/i, country: null }
  ];
  
  for (const { pattern, country: cityCountry } of cityPatterns) {
    const match = content.match(pattern);
    if (match) {
      city = match[0];
      if (cityCountry && !country) {
        country = cityCountry;
      }
      break;
    }
  }
  
  return { city, country };
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

  // Build event-focused query
  const baseQ = buildSearchQuery({ baseQuery, userText, excludeTerms });
  const q = buildEventFocusedQuery(baseQ, userText, location);

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

  // Step 2: Filter URLs to focus on actual events
  console.log('[enhanced_orchestrator] Step 2: Filtering for event URLs');
  const eventUrls = urls.filter(url => {
    const urlLower = url.toLowerCase();
    // Look for event-related URL patterns
    const eventPatterns = [
      '/event', '/events', '/veranstaltung', '/veranstaltungen', '/konferenz', '/kongress',
      '/workshop', '/seminar', '/meeting', '/summit', '/forum', '/symposium', '/tagung',
      '/conference', '/conferences', '/training', '/course', '/kurs', '/fortbildung'
    ];
    
    // Check if URL contains event-related terms
    const hasEventPattern = eventPatterns.some(pattern => urlLower.includes(pattern));
    
    // Check if URL is from known event platforms
    const eventDomains = [
      'eventbrite', 'meetup', 'conference', 'kongress', 'veranstaltung', 'workshop',
      'seminar', 'training', 'course', 'event', 'summit', 'forum', 'symposium'
    ];
    
    const hasEventDomain = eventDomains.some(domain => urlLower.includes(domain));
    
    // Exclude obvious non-event URLs
    const excludePatterns = [
      '/blog', '/news', '/article', '/press', '/about', '/contact', '/imprint',
      '/privacy', '/terms', '/faq', '/help', '/support', '/login', '/register',
      '/shop', '/store', '/product', '/service', '/company', '/team', '/career'
    ];
    
    const hasExcludePattern = excludePatterns.some(pattern => urlLower.includes(pattern));
    
    return (hasEventPattern || hasEventDomain) && !hasExcludePattern;
  });
  
  console.log('[enhanced_orchestrator] Filtered', urls.length, 'URLs to', eventUrls.length, 'event URLs');
  logs.push({ at: 'event_filtering', inputCount: urls.length, outputCount: eventUrls.length });

  // Step 3: Prioritize URLs with Gemini
  console.log('[enhanced_orchestrator] Step 3: Prioritizing URLs with Gemini');
  const prioritizedUrls = await prioritizeUrls(eventUrls, country, location);
  logs.push({ at: 'prioritization', inputCount: eventUrls.length, outputCount: prioritizedUrls.length, location });

  // Step 4: Extract event details from prioritized URLs
  console.log('[enhanced_orchestrator] Step 4: Extracting event details');
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
      city: details.city,
      location: details.location,
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
