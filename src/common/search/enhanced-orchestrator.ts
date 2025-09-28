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

// Industry-agnostic event-focused query builder
function buildEventFocusedQuery(baseQuery: string, userText: string, location: string | null, searchConfig: any): string {
  const countries = processLocation(location);
  
  // Generic event terms (industry-agnostic)
  const eventTerms = ['conference', 'event', 'summit', 'workshop', 'seminar', 'meeting', 'symposium', 'forum', 'exhibition', 'trade show', 'convention', 'congress'];
  const eventQuery = `(${eventTerms.join(' OR ')})`;
  
  if (countries.length === 1) {
    // Single country - add country-specific terms
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
    const locationTerms = terms.slice(0, 5).join(' OR ');
    return `${baseQuery} ${eventQuery} (${locationTerms})`;
  } else {
    // Multiple countries (EU) - add broader European terms
    const euTerms = ['Europe', 'Europa', 'European', 'Europäisch', 'EU'];
    const locationTerms = euTerms.join(' OR ');
    return `${baseQuery} ${eventQuery} (${locationTerms})`;
  }
}

// Industry-agnostic Gemini prioritization
async function prioritizeUrls(urls: string[], searchConfig: any, country: string, location: string | null, timeframe: string | null): Promise<string[]> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[prioritization] No GEMINI_API_KEY, returning all URLs');
      return urls;
    }

    // Build context from search config
    const industry = searchConfig.industry || 'general';
    const baseQuery = searchConfig.baseQuery || '';
    const excludeTerms = searchConfig.excludeTerms || '';
    
    // Process location context
    const countries = processLocation(location);
    const locationContext = countries.length === 1 ? 
      `in ${countries[0]}` : 
      `in European countries (${countries.slice(0, 5).join(', ')}...)`;
    
    // Process timeframe context
    const timeframeContext = timeframe ? 
      `within the ${timeframe.replace('_', ' ')} timeframe` : 
      'within the specified timeframe';
    
    const prompt = `You are an expert in ${industry} events and conferences. 

SEARCH CONTEXT:
- Industry: ${industry}
- Base Query: ${baseQuery}
- Exclude Terms: ${excludeTerms}
- Location: ${locationContext}
- Timeframe: ${timeframeContext}

TASK: From the URLs below, return the top 10 most relevant for ${industry} events that are:
1. Actually taking place ${locationContext} (events mentioning ${locationContext} or taking place there)
2. ${timeframeContext}
3. Match the search context: ${baseQuery}
4. Are real events (conferences, workshops, seminars, exhibitions, trade shows, etc.) - not general websites, documentation, or non-event pages
5. Exclude events that are clearly from other countries unless they're international events relevant to ${locationContext}

IMPORTANT FILTERING RULES:
- STRICTLY prioritize events that are physically located ${locationContext}
- ONLY include international events if they explicitly mention ${locationContext} or are clearly relevant to ${locationContext} professionals
- EXCLUDE events that are clearly from other countries (US, UK, etc.) unless they explicitly mention ${locationContext}
- Focus on actual event pages, not documentation, news, or general information pages
- Look for event-specific indicators: dates, venues, registration, speakers, agenda
- For Germany search: prioritize events in German cities, German venues, or events explicitly mentioning Germany

URLs: ${urls.slice(0, 20).join(', ')}

Return only a JSON array of the most relevant URLs, like: ["url1", "url2", "url3"]`;

    // Try the correct Gemini API endpoint with proper model name
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn('[prioritization] Gemini API failed:', response.status, errorText);
      console.warn('[prioritization] API Key length:', apiKey?.length || 0);
      console.warn('[prioritization] API Key starts with:', apiKey?.substring(0, 10) || 'N/A');
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
    console.warn('[prioritization] Falling back to simple URL prioritization');
    
    // Simple fallback prioritization based on URL patterns
    const prioritized = urls
      .filter(url => {
        const urlLower = url.toLowerCase();
        // Prioritize German domains and event-specific URLs
        return urlLower.includes('.de') || 
               urlLower.includes('germany') || 
               urlLower.includes('deutschland') ||
               urlLower.includes('event') ||
               urlLower.includes('conference') ||
               urlLower.includes('summit');
      })
      .slice(0, 10);
    
    return prioritized.length > 0 ? prioritized : urls.slice(0, 10);
  }
}

// Event extraction using Firecrawl Extract (not Gemini)
async function extractEventDetails(url: string, searchConfig: any): Promise<any> {
  try {
    const apiKey = process.env.FIRECRAWL_KEY || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.warn('[extract] No Firecrawl API key');
      return { title: null, description: null, starts_at: null, country: null, venue: null };
    }

    // Use Promise.race to add timeout to prevent 300-second timeouts
    const extractPromise = fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: [
          {
            type: "json",
            prompt: `Extract event information from this webpage. Return a JSON object with:
{
  "title": "Event title or null if not found",
  "description": "Brief event description or null if not found", 
  "starts_at": "Event date in YYYY-MM-DD format or null if not found",
  "country": "Country code (DE, AT, CH, etc.) or null if not found",
  "city": "City name or null if not found",
  "venue": "Venue name or null if not found"
}

IMPORTANT LOCATION EXTRACTION:
- Look for venue addresses, city names, country mentions
- Check for German cities: Berlin, München, Frankfurt, Hamburg, Köln, Stuttgart, etc.
- Check for German venues, German addresses, German postal codes
- Look for country indicators in URLs (.de, .at, .ch) or content
- For ${searchConfig.industry || 'general'} events, focus on events that are actually taking place in the specified location

Focus on ${searchConfig.industry || 'general'} events. If this is not an event page, return null for most fields.`
          }
        ],
        onlyMainContent: true,
        timeout: 30000
      })
    });

                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Extraction timeout')), 5000) // 5 second timeout
                );

    const response = await Promise.race([extractPromise, timeoutPromise]) as Response;

    if (!response.ok) {
      console.warn('[extract] Firecrawl extract failed for', url, response.status);
      // Fallback to simple scraping
      return await fallbackExtraction(url, apiKey);
    }

    let data;
    try {
      const responseText = await response.text();
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('[extract] Failed to parse Firecrawl extract response for', url, parseError);
      // Fallback to simple scraping
      return await fallbackExtraction(url, apiKey);
    }
    
    const extracted = data.data?.json || {};
    
    // Format location as "City, Country" if both available
    let locationFormatted = null;
    if (extracted.city && extracted.country) {
      locationFormatted = `${extracted.city}, ${extracted.country}`;
    } else if (extracted.country) {
      locationFormatted = extracted.country;
    }

    return {
      title: extracted.title,
      description: extracted.description,
      starts_at: extracted.starts_at,
      country: extracted.country,
      city: extracted.city,
      location: locationFormatted,
      venue: extracted.venue
    };
  } catch (error) {
    console.error('[extract] Error extracting', url, error);
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn('[extract] Extraction timed out for', url);
    }
    return { title: null, description: null, starts_at: null, country: null, venue: null };
  }
}

// Fallback extraction using simple scraping
async function fallbackExtraction(url: string, apiKey: string): Promise<any> {
  try {
    const scrapePromise = fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 30000
      })
    });

                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Scrape timeout')), 4000) // 4 second timeout
                );

    const response = await Promise.race([scrapePromise, timeoutPromise]) as Response;

    if (!response.ok) {
      console.warn('[extract] Fallback scrape failed for', url, response.status);
      return { title: null, description: null, starts_at: null, country: null, venue: null };
    }

    const data = await response.json();
    const content = data.data?.markdown || '';
    
    // Use simple extraction helpers
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
    console.error('[extract] Fallback extraction error:', error);
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn('[extract] Fallback extraction timed out for', url);
    }
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
  // Look for common date patterns with validation
  const datePatterns = [
    // ISO dates (yyyy-mm-dd)
    /(\d{4}-\d{2}-\d{2})/g,
    // German dates (dd.mm.yyyy) - validate day/month ranges
    /(\d{1,2}\.\d{1,2}\.\d{4})/g,
    // US dates (mm/dd/yyyy) - validate month/day ranges
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    // German month names
    /(\d{1,2}\.\s*(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*\d{4})/gi,
    // English month names
    /(\d{1,2}\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{4})/gi,
    // Event-specific patterns: "August 3–6, 2025", "June 10th - June 13th"
    /(august|september|october|november|december|january|february|march|april|may|june|july)\s+\d{1,2}[–-]\d{1,2},?\s+\d{4}/gi,
    /(august|september|october|november|december|january|february|march|april|may|june|july)\s+\d{1,2}(?:st|nd|rd|th)?\s*[–-]\s*(august|september|october|november|december|january|february|march|april|may|june|july)\s+\d{1,2}(?:st|nd|rd|th)?/gi,
    // Relative dates
    /(today|heute|tomorrow|morgen|yesterday|gestern)/gi
  ];
  
  for (const pattern of datePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      for (const dateStr of matches) {
        try {
          let isoDate = null;
          
          // Convert German month names to ISO format
          if (dateStr.includes('januar') || dateStr.includes('january')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(januar|january)\s*(\d{4})/gi, '$3-01-$1');
          } else if (dateStr.includes('februar') || dateStr.includes('february')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(februar|february)\s*(\d{4})/gi, '$3-02-$1');
          } else if (dateStr.includes('märz') || dateStr.includes('march')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(märz|march)\s*(\d{4})/gi, '$3-03-$1');
          } else if (dateStr.includes('april')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*april\s*(\d{4})/gi, '$2-04-$1');
          } else if (dateStr.includes('mai') || dateStr.includes('may')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(mai|may)\s*(\d{4})/gi, '$3-05-$1');
          } else if (dateStr.includes('juni') || dateStr.includes('june')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(juni|june)\s*(\d{4})/gi, '$3-06-$1');
          } else if (dateStr.includes('juli') || dateStr.includes('july')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(juli|july)\s*(\d{4})/gi, '$3-07-$1');
          } else if (dateStr.includes('august')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*august\s*(\d{4})/gi, '$2-08-$1');
          } else if (dateStr.includes('september')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*september\s*(\d{4})/gi, '$2-09-$1');
          } else if (dateStr.includes('oktober') || dateStr.includes('october')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(oktober|october)\s*(\d{4})/gi, '$3-10-$1');
          } else if (dateStr.includes('november')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*november\s*(\d{4})/gi, '$2-11-$1');
          } else if (dateStr.includes('dezember') || dateStr.includes('december')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(dezember|december)\s*(\d{4})/gi, '$3-12-$1');
          }
          
          // Handle relative dates
          else if (dateStr.toLowerCase().includes('today') || dateStr.toLowerCase().includes('heute')) {
            isoDate = new Date().toISOString().split('T')[0];
          } else if (dateStr.toLowerCase().includes('tomorrow') || dateStr.toLowerCase().includes('morgen')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            isoDate = tomorrow.toISOString().split('T')[0];
          }
          
          // Handle numeric dates
          else if (dateStr.includes('-')) {
            // ISO format - validate
            const parts = dateStr.split('-');
            if (parts.length === 3) {
              const year = parseInt(parts[0]);
              const month = parseInt(parts[1]);
              const day = parseInt(parts[2]);
              if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                isoDate = dateStr;
              }
            }
          } else if (dateStr.includes('.')) {
            // German format (dd.mm.yyyy) - validate and convert
            const parts = dateStr.split('.');
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]);
              const year = parseInt(parts[2]);
              if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              }
            }
          } else if (dateStr.includes('/')) {
            // US format (mm/dd/yyyy) - validate and convert
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const month = parseInt(parts[0]);
              const day = parseInt(parts[1]);
              const year = parseInt(parts[2]);
              if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              }
            }
          }
          
          // Validate the final date
          if (isoDate) {
            const testDate = new Date(isoDate);
            if (!isNaN(testDate.getTime()) && testDate.getFullYear() >= 2020 && testDate.getFullYear() <= 2030) {
              return isoDate;
            }
          }
        } catch (error) {
          // Skip invalid dates
          continue;
        }
      }
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
  
  // Extract city from content with more aggressive German detection
  let city = null;
  const cityPatterns = [
    // German cities (prioritize these)
    { pattern: /\b(Berlin|München|Frankfurt|Köln|Hamburg|Stuttgart|Düsseldorf|Leipzig|Hannover|Nürnberg|Bremen|Bonn|Essen|Mannheim|Münster|Dresden|Karlsruhe|Freiburg|Heidelberg|Ulm|Augsburg|Würzburg|Regensburg|Kiel|Lübeck|Rostock|Magdeburg|Potsdam|Cottbus|Chemnitz|Zwickau|Plauen|Gera|Jena|Erfurt|Weimar|Göttingen|Braunschweig|Wolfsburg|Osnabrück|Oldenburg|Wilhelmshaven|Bremerhaven|Kassel|Fulda|Marburg|Gießen|Darmstadt|Wiesbaden|Mainz|Koblenz|Trier|Saarbrücken|Kaiserslautern|Ludwigshafen|Mannheim|Heidelberg|Pforzheim|Reutlingen|Tübingen|Konstanz|Freiburg|Offenburg|Lörrach|Villingen|Schwenningen|Ravensburg|Friedrichshafen|Ulm|Neu-Ulm|Augsburg|Kempten|Memmingen|Lindau|Rosenheim|Traunstein|Berchtesgaden|Garmisch-Partenkirchen|Mittenwald|Oberstdorf|Füssen|Kempten|Memmingen|Lindau|Rosenheim|Traunstein|Berchtesgaden|Garmisch-Partenkirchen|Mittenwald|Oberstdorf|Füssen)\b/i, country: 'DE' },
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
  
  // Additional country indicators in content (industry-agnostic)
  if (!country && content) {
    const countryIndicators = [
      { pattern: /\b(Deutschland|Germany)\b/i, country: 'DE' },
      { pattern: /\b(Österreich|Austria)\b/i, country: 'AT' },
      { pattern: /\b(Schweiz|Switzerland)\b/i, country: 'CH' },
      { pattern: /\b(Frankreich|France)\b/i, country: 'FR' },
      { pattern: /\b(Italien|Italy)\b/i, country: 'IT' },
      { pattern: /\b(Spanien|Spain)\b/i, country: 'ES' },
      { pattern: /\b(Niederlande|Netherlands)\b/i, country: 'NL' },
      { pattern: /\b(Belgien|Belgium)\b/i, country: 'BE' },
      { pattern: /\b(Luxemburg|Luxembourg)\b/i, country: 'LU' },
      { pattern: /\b(Dänemark|Denmark)\b/i, country: 'DK' },
      { pattern: /\b(Schweden|Sweden)\b/i, country: 'SE' },
      { pattern: /\b(Norwegen|Norway)\b/i, country: 'NO' },
      { pattern: /\b(Finnland|Finland)\b/i, country: 'FI' },
      { pattern: /\b(Polen|Poland)\b/i, country: 'PL' },
      { pattern: /\b(Tschechien|Czech Republic)\b/i, country: 'CZ' },
      { pattern: /\b(Ungarn|Hungary)\b/i, country: 'HU' },
      { pattern: /\b(Slowakei|Slovakia)\b/i, country: 'SK' },
      { pattern: /\b(Slowenien|Slovenia)\b/i, country: 'SI' },
      { pattern: /\b(Kroatien|Croatia)\b/i, country: 'HR' },
      { pattern: /\b(Bulgarien|Bulgaria)\b/i, country: 'BG' },
      { pattern: /\b(Rumänien|Romania)\b/i, country: 'RO' },
      { pattern: /\b(Estland|Estonia)\b/i, country: 'EE' },
      { pattern: /\b(Lettland|Latvia)\b/i, country: 'LV' },
      { pattern: /\b(Litauen|Lithuania)\b/i, country: 'LT' },
      { pattern: /\b(Malta)\b/i, country: 'MT' },
      { pattern: /\b(Zypern|Cyprus)\b/i, country: 'CY' },
      { pattern: /\b(Irland|Ireland)\b/i, country: 'IE' },
      { pattern: /\b(Portugal)\b/i, country: 'PT' },
      { pattern: /\b(Griechenland|Greece)\b/i, country: 'GR' }
    ];
    
    for (const { pattern, country: indicatorCountry } of countryIndicators) {
      if (pattern.test(content)) {
        country = indicatorCountry;
        break;
      }
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
  const q = buildEventFocusedQuery(baseQ, userText, location, cfg);

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
    
    // Block social media and non-event platforms
    const blockedDomains = [
      'linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
      'youtube.com', 'tiktok.com', 'reddit.com', 'mumsnet.com',
      'coursehero.com', 'chegg.com', 'studocu.com', 'quizlet.com'
    ];
    
    const isBlocked = blockedDomains.some(domain => urlLower.includes(domain));
    if (isBlocked) {
      console.log('[enhanced_orchestrator] Blocked URL:', url);
      return false;
    }
    
    // Look for event-related URL patterns
    const eventPatterns = [
      '/event', '/events', '/veranstaltung', '/veranstaltungen', '/konferenz', '/kongress',
      '/workshop', '/seminar', '/meeting', '/summit', '/forum', '/symposium', '/tagung',
      '/conference', '/conferences', '/training', '/course', '/kurs', '/fortbildung'
    ];
    
    // Check if URL contains event-related terms
    const hasEventPattern = eventPatterns.some(pattern => urlLower.includes(pattern));
    
    // Block non-event URL patterns
    const nonEventPatterns = [
      '/tutors-problems', '/problems', '/questions', '/answers', '/homework',
      '/study', '/learn', '/course', '/lesson', '/tutorial', '/guide',
      '/blog', '/news', '/article', '/post', '/page', '/about', '/contact'
    ];
    
    const hasNonEventPattern = nonEventPatterns.some(pattern => urlLower.includes(pattern));
    if (hasNonEventPattern) {
      console.log('[enhanced_orchestrator] Blocked non-event URL:', url);
      return false;
    }
    
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

  // Step 3: Deduplicate URLs
  console.log('[enhanced_orchestrator] Step 3: Deduplicating URLs');
  const uniqueUrls = [...new Set(eventUrls)];
  console.log('[enhanced_orchestrator] Deduplicated', eventUrls.length, 'URLs to', uniqueUrls.length, 'unique URLs');
  
  // Step 4: Prioritize URLs with Gemini
  console.log('[enhanced_orchestrator] Step 4: Prioritizing URLs with Gemini');
  const prioritizedUrls = await prioritizeUrls(uniqueUrls, cfg, country, location, timeframe);
  logs.push({ at: 'prioritization', inputCount: uniqueUrls.length, outputCount: prioritizedUrls.length, location });

  // Step 5: Extract event details from prioritized URLs
  console.log('[enhanced_orchestrator] Step 5: Extracting event details');
  const events = [];
  
  for (let i = 0; i < Math.min(prioritizedUrls.length, 5); i++) {
    const url = prioritizedUrls[i];
    console.log('[enhanced_orchestrator] Extracting', i + 1, 'of', Math.min(prioritizedUrls.length, 5), ':', url);
    
    try {
      const details = await extractEventDetails(url, cfg);
      console.log('[enhanced_orchestrator] Extracted details:', {
        url,
        title: details.title,
        country: details.country,
        city: details.city,
        location: details.location,
        venue: details.venue,
        starts_at: details.starts_at
      });
    
    // If extraction completely failed, create a basic event object
    if (!details.title && !details.description && !details.country && !details.city) {
      console.log('[enhanced_orchestrator] Extraction failed, creating basic event object for:', url);
      details.title = `Event from ${new URL(url).hostname}`;
      details.description = `Event found at ${url}`;
      details.country = null;
      details.city = null;
      details.location = null;
      details.venue = null;
      details.starts_at = null;
    }
    
    // Apply country filtering - if searching for specific country, only include events from that country
    if (country && country !== 'EU') {
      const eventCountry = details.country;
      const eventCity = details.city;
      const eventLocation = details.location;
      
      console.log('[enhanced_orchestrator] Checking event location:', {
        url,
        eventCountry,
        eventCity,
        eventLocation,
        targetCountry: country
      });
      
      // Check if event is in the target country
      const isInTargetCountry = eventCountry === country;
      
      // Check if event mentions target country in location
      const mentionsTargetCountry = eventLocation && 
        (eventLocation.toLowerCase().includes(country.toLowerCase()) ||
         eventLocation.toLowerCase().includes('germany') ||
         eventLocation.toLowerCase().includes('deutschland'));
      
      // Check if event is in a German city (for Germany searches)
      const isInGermanCity = country === 'DE' && eventCity && 
        ['berlin', 'münchen', 'frankfurt', 'hamburg', 'köln', 'stuttgart', 'düsseldorf', 'leipzig', 'hannover', 'nürnberg', 'bremen', 'bonn', 'essen', 'mannheim', 'münster'].some(city => 
          eventCity.toLowerCase().includes(city.toLowerCase()));
      
      // Check if URL suggests German location
      const urlSuggestsGerman = url.toLowerCase().includes('.de') || 
        url.toLowerCase().includes('germany') || 
        url.toLowerCase().includes('deutschland');
      
      // Be stricter - filter out if we have evidence it's NOT German
      const isDefinitelyNotGerman = eventCountry && 
        !['DE', 'AT', 'CH'].includes(eventCountry) && 
        !urlSuggestsGerman && 
        !mentionsTargetCountry && 
        !isInGermanCity;
      
      // Additional check for obvious US cities
      const isObviousUSCity = eventCity && 
        ['kansas city', 'nashville', 'houston', 'chicago', 'new york', 'los angeles', 'san francisco', 'boston', 'atlanta', 'miami', 'seattle', 'denver'].includes(eventCity.toLowerCase());
      
      // Also check URL for US city patterns
      const urlContainsUSCity = url.toLowerCase().includes('kansas-city') || 
        url.toLowerCase().includes('nashville') || 
        url.toLowerCase().includes('houston') || 
        url.toLowerCase().includes('chicago') || 
        url.toLowerCase().includes('new-york') || 
        url.toLowerCase().includes('los-angeles') || 
        url.toLowerCase().includes('san-francisco') || 
        url.toLowerCase().includes('boston') || 
        url.toLowerCase().includes('atlanta') || 
        url.toLowerCase().includes('miami') || 
        url.toLowerCase().includes('seattle') || 
        url.toLowerCase().includes('denver');
      
      const shouldFilterOut = isDefinitelyNotGerman || isObviousUSCity || urlContainsUSCity;
      
      if (shouldFilterOut) {
        console.log('[enhanced_orchestrator] Filtering out non-German event:', url, 'Country:', eventCountry, 'City:', eventCity, 'Location:', eventLocation);
        continue; // Skip this event
      } else {
        console.log('[enhanced_orchestrator] Keeping event (German or ambiguous):', url, 'Country:', eventCountry, 'City:', eventCity, 'Location:', eventLocation);
      }
    }
    
    // Apply date filtering if timeframe is specified
    if (effectiveDateFrom || effectiveDateTo) {
      const eventDate = details.starts_at;
      if (eventDate) {
        if (effectiveDateFrom && eventDate < effectiveDateFrom) {
          console.log('[enhanced_orchestrator] Filtering out event before date range:', url, 'Date:', eventDate);
          continue;
        }
        if (effectiveDateTo && eventDate > effectiveDateTo) {
          console.log('[enhanced_orchestrator] Filtering out event after date range:', url, 'Date:', eventDate);
          continue;
        }
      }
    }
    
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
    } catch (error) {
      console.error('[enhanced_orchestrator] Error extracting event from', url, error);
      // Create a basic event object even if extraction fails
      events.push({
        id: `event_${i}`,
        title: `Event from ${new URL(url).hostname}`,
        source_url: url,
        starts_at: null,
        country: null,
        city: null,
        location: null,
        venue: null,
        description: `Event found at ${url}`,
        speakers: []
      });
    }
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
