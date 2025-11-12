/**
 * Event Analysis Library - PERFORMANCE OPTIMIZED
 * 
 * This library contains the core event analysis logic that can be used
 * both by API routes and other parts of the application.
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Reduced Firecrawl delays from 6s to 1s between requests
 * - Parallel sub-page crawling instead of sequential
 * - Reduced timeouts from 30s to 15s (main) and 10s (sub-pages)
 * - Limited to 3 sub-pages instead of 5
 * - Reduced speaker extraction limit from 20 to 10
 * - Increased rate limits for faster processing
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { supabaseServer } from "@/lib/supabase-server";
import { filterSpeakers, type RawSpeaker } from "./extract/speakers";

// Environment variables
const geminiKey = process.env.GEMINI_API_KEY;
const firecrawlKey = process.env.FIRECRAWL_KEY;
const googleKey = process.env.GOOGLE_CSE_KEY;
const googleCx = process.env.GOOGLE_CSE_CX;

// Rate limiting configuration - CONSERVATIVE FOR STABILITY
const FIRECRAWL_RATE_LIMIT = {
  maxRequestsPerMinute: 10, // Conservative for stability
  maxRequestsPerHour: 100,  // Conservative for stability
  delayBetweenRequests: 3000 // 3 second delay for stability
};

// Cache configuration
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const DIRECTORY_DOMAINS = new Set([
  'conferencealerts.co.in',
  'internationalconferencealerts.com',
  'cvent.com',
  'everlaw.com',
  'vendelux.com',
  'conference-service.com',
  'conference2go.com',          // Generic aggregator
  'eventora.com',
  'eventsworld.com'
]);

const AGGREGATOR_DOMAINS = new Set([
  '10times.com',
  'allconferencealert.com',
  'conferenceineurope.net',
  'conferenceineurope.org',
  'eventbrite.com',
  'eventbrite.de',
  'eventbrite.co.uk',
  'freeconferencealerts.com',
  'globalriskcommunity.com',
  'globalli.io',
  'linkedin.com',
  'researchbunny.com'
]);

const DIRECTORY_PATH_SEGMENTS = [
  '/blog/',
  '/insights',
  '/professional-development',
  '/press',
  '/news',
  '/events/b/',
  '/b/',
  '/resources/'
];

const EVENT_MONTH_KEYWORDS = [
  'january','february','march','april','may','june','july','august','september','october','november','december',
  'januar','februar','märz','april','mai','juni','juli','august','september','oktober','november','dezember'
];

const EVENT_LOCATION_KEYWORDS = [
  'berlin','münchen','munich','frankfurt','hamburg','stuttgart','düsseldorf','köln','cologne','germany','deutschland'
];

const EVENT_CALL_TO_ACTION_KEYWORDS = [
  'register','anmeldung','anmelden','sign up','jetzt registrieren','jetzt anmelden','tickets','ticket'
];

function normalizeHostname(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/^www\./, '').toLowerCase();
}

const LOCATION_MAP: Record<string, string> = {
  berlin: 'Berlin, Germany',
  münchen: 'Munich, Germany',
  munich: 'Munich, Germany',
  frankfurt: 'Frankfurt, Germany',
  hamburg: 'Hamburg, Germany',
  stuttgart: 'Stuttgart, Germany',
  düsseldorf: 'Düsseldorf, Germany',
  duesseldorf: 'Düsseldorf, Germany',
  köln: 'Cologne, Germany',
  koeln: 'Cologne, Germany',
  cologne: 'Cologne, Germany',
  germany: 'Germany',
  deutschland: 'Germany'
};

export interface EventAnalysisRequest {
  eventUrl: string;
  eventTitle?: string;
  eventDate?: string;
  country?: string;
}

export interface EventMetadata {
  title: string;
  description: string;
  date: string;
  location: string;
  organizer: string;
  website: string;
  registrationUrl?: string;
}

export interface SpeakerData {
  name: string;
  title: string;
  company: string;
  bio: string;
  expertise_areas?: string[];
  social_links?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  speaking_history?: string[];
  education?: string[];
  achievements?: string[];
  industry_connections?: string[];
  recent_news?: string[];
  contact?: string;
}

export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  description: string;
  metadata: any;
}

export interface EventAnalysisResponse {
  success: boolean;
  cached: boolean;
  event: EventMetadata;
  speakers: SpeakerData[];
  crawl_stats: {
    pages_crawled: number;
    total_content_length: number;
    speakers_found: number;
    crawl_duration_ms: number;
  };
  error?: string;
}

function chunkText(text: string, chunkSize = 1800, overlap = 200): string[] {
  const sanitized = (text || '').replace(/\s+\n/g, '\n').trim();
  if (!sanitized) return [];
  if (sanitized.length <= chunkSize) return [sanitized];

  const chunks: string[] = [];
  let start = 0;
  while (start < sanitized.length) {
    const end = Math.min(sanitized.length, start + chunkSize);
    const chunk = sanitized.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    if (end === sanitized.length) break;
    start = Math.max(0, end - overlap);
    if (start === 0 && end === sanitized.length) break;
  }
  return chunks;
}

function isMeaningfulValue(value: unknown): value is string {
  if (!value && value !== 0) return false;
  const str = String(value).trim();
  if (!str) return false;
  const normalized = str.toLowerCase();
  const placeholders = ['unknown', 'tbd', 'n/a', 'null', 'none'];
  return !placeholders.includes(normalized);
}

function selectBetterValue(existing: string, candidate?: string | null): string {
  const current = existing?.trim() ?? '';
  const next = candidate?.trim() ?? '';
  if (!next) return current;
  if (!current) return next;
  return next.length > current.length ? next : current;
}

function extractDateFromContent(content: string): string | undefined {
  if (!content) return undefined;
  const patterns = [
    /(\d{1,2}\s?[–-]\s?\d{1,2}\s(?:January|February|March|April|May|June|July|August|September|October|November|December|Januar|Februar|März|Mai|Juni|Juli|Oktober|Dezember)\s20\d{2})/i,
    /((?:January|February|March|April|May|June|July|August|September|October|November|December|Januar|Februar|März|Mai|Juni|Juli|Oktober|Dezember)\s\d{1,2},?\s20\d{2})/i,
    /(\d{1,2}\.\d{1,2}\.20\d{2})/,
    /(20\d{2})/
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

function extractRegistrationUrl(content: string): string | undefined {
  const match = content.match(/https?:\/\/[^\s"'<>]+?(?:register|anmeldung|tickets)[^\s"'<>]*/i);
  return match ? match[0] : undefined;
}

function extractOrganizer(content: string): string | undefined {
  const organizerPatterns = [
    /(?:Organizer|Organiser|Hosted by|Veranstalter|Presented by)[:\-]\s*(.+)/i,
    /Contact\s*[:\-]\s*(.+)/i
  ];
  for (const pattern of organizerPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].split(/\n|\r/)[0].trim();
    }
  }
  return undefined;
}

function extractDescriptionSnippet(crawlResults: CrawlResult[]): string {
  const primary = crawlResults[0];
  if (!primary) return '';
  if (isMeaningfulValue(primary.description)) {
    return primary.description.trim();
  }
  const snippet = primary.content?.slice(0, 400)?.replace(/\s+/g, ' ').trim();
  return snippet || '';
}

function normalizeLocation(raw: string): string {
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (LOCATION_MAP[lower]) {
    return LOCATION_MAP[lower];
  }
  return raw.trim();
}

function applyMetadataHeuristics(
  metadata: {
    title: string;
    description: string;
    date: string;
    location: string;
    organizer: string;
    website: string;
    registrationUrl?: string;
  },
  combinedContent: string,
  crawlResults: CrawlResult[],
  eventTitle?: string,
  eventDate?: string,
  country?: string
): EventMetadata {
  const fallbackTitle = eventTitle || crawlResults[0]?.title || 'Unknown Event';
  const fallbackDescription = selectBetterValue(metadata.description, extractDescriptionSnippet(crawlResults));
  const fallbackDate = eventDate || extractDateFromContent(combinedContent) || 'Unknown Date';
  const detectedLocationMatch = combinedContent.match(/\b(Berlin|München|Munich|Frankfurt|Hamburg|Stuttgart|Düsseldorf|Duesseldorf|Köln|Koeln|Cologne|Germany|Deutschland)\b/i);
  const detectedLocation = normalizeLocation(metadata.location || (detectedLocationMatch ? detectedLocationMatch[0] : ''));
  const fallbackLocation = normalizeLocation(country || detectedLocation || '');
  const organizer = selectBetterValue(metadata.organizer, extractOrganizer(combinedContent)) || 'Unknown Organizer';
  const website = metadata.website?.trim() || crawlResults[0]?.url || '';
  const registrationUrl = metadata.registrationUrl?.trim() || extractRegistrationUrl(combinedContent);

  return {
    title: isMeaningfulValue(metadata.title) ? metadata.title : fallbackTitle,
    description: isMeaningfulValue(metadata.description) ? metadata.description : (fallbackDescription || 'Description forthcoming.'),
    date: isMeaningfulValue(metadata.date) ? metadata.date : fallbackDate,
    location: isMeaningfulValue(detectedLocation) ? detectedLocation : (isMeaningfulValue(fallbackLocation) ? fallbackLocation : 'Unknown Location'),
    organizer: organizer || 'Unknown Organizer',
    website: website || crawlResults[0]?.url || '',
    registrationUrl: registrationUrl
  };
}

// Rate limiting storage (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(): boolean {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const key = `firecrawl_${minute}`;
  
  const current = rateLimitStore.get(key) || { count: 0, resetTime: now + 60000 };
  
  if (current.resetTime < now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (current.count >= FIRECRAWL_RATE_LIMIT.maxRequestsPerMinute) {
    return false;
  }
  
  current.count++;
  rateLimitStore.set(key, current);
  return true;
}

export async function getCachedAnalysis(eventUrl: string): Promise<EventAnalysisResponse | null> {
  try {
    const supabase = await supabaseServer();
    const urlHash = createHash('sha256').update(eventUrl).digest('hex');
    
    const { data, error } = await supabase
      .from('event_analysis_cache')
      .select('analysis_data, created_at')
      .eq('url_hash', urlHash)
      .gt('created_at', new Date(Date.now() - CACHE_DURATION).toISOString())
      .maybeSingle();
    
    if (error) {
      console.warn('Failed to check cache:', error.message);
      return null;
    }
    
    if (data?.analysis_data) {
      console.log('Returning cached analysis for:', eventUrl);
      return { ...data.analysis_data, cached: true };
    }
    
    return null;
  } catch (error) {
    console.warn('Cache check error:', error);
    return null;
  }
}

export async function cacheAnalysis(eventUrl: string, analysis: EventAnalysisResponse): Promise<void> {
  try {
    const supabase = await supabaseServer();
    const urlHash = createHash('sha256').update(eventUrl).digest('hex');
    
    await supabase
      .from('event_analysis_cache')
      .upsert({
        url_hash: urlHash,
        event_url: eventUrl,
        analysis_data: analysis,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'url_hash'
      });
    
    console.log('Cached analysis for:', eventUrl);
  } catch (error) {
    console.warn('Failed to cache analysis:', error);
  }
}

export async function deepCrawlEvent(eventUrl: string): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  
  if (!firecrawlKey) {
    console.warn('Firecrawl key not available');
    return results;
  }
  
  // Check rate limit
  if (!checkRateLimit()) {
    console.warn('Firecrawl rate limit exceeded');
    return results;
  }
  
  try {
    console.log('Starting deep crawl for:', eventUrl);
    
    // First, crawl the main page with Firecrawl v2 API (reduced timeout)
    const mainPageResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: eventUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 15000  // Increased to 15000 (15 seconds) for slow sites like haystackid.com
      }),
      signal: AbortSignal.timeout(18000)  // Add abort signal for safety (18s)
    });
    
    if (mainPageResponse.ok) {
      const mainPageData = await mainPageResponse.json();
      if (mainPageData.data?.markdown) {
        results.push({
          url: eventUrl,
          title: mainPageData.data.metadata?.title || 'Main Page',
          content: mainPageData.data.markdown,
          description: mainPageData.data.metadata?.description || '',
          metadata: mainPageData.data.metadata
        });
        console.log('Main page crawled, content length:', mainPageData.data.markdown.length);
      }
    } else {
      // Log error without consuming response body to avoid stream issues
      console.warn('Main page crawl failed with status:', mainPageResponse.status);
    }
    
    // Extract and prioritize sub-pages from the main page content
    const allSubPageUrls = extractSubPageUrls(eventUrl, results[0]?.content || '');
    const prioritizedSubPageUrls = prioritizeSubPagesForSpeakers(allSubPageUrls);
    console.log('Found potential sub-pages:', allSubPageUrls.length, '| Prioritized:', prioritizedSubPageUrls.slice(0, 2).map(u => u.split('/').pop()));
    
    // Crawl sub-pages in parallel (OPTIMIZED FOR SPEED) - Take top 2 prioritized pages
    const subPagePromises = prioritizedSubPageUrls.slice(0, 2).map(async (subUrl, index) => {
      // Stagger requests slightly to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, index * 200)); // 200ms stagger
      
      try {
        const subPageResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: subUrl,
            formats: ['markdown'],
            onlyMainContent: true,
            timeout: 12000  // Increased to 12000 (12 seconds) to reduce 408 errors
          }),
          signal: AbortSignal.timeout(15000)  // Add abort signal for safety (15s)
        });
        
        if (subPageResponse.ok) {
          const subPageData = await subPageResponse.json();
          if (subPageData.data?.markdown) {
            console.log('Sub-page crawled:', subUrl, 'content length:', subPageData.data.markdown.length);
            return {
              url: subUrl,
              title: subPageData.data.metadata?.title || 'Sub Page',
              content: subPageData.data.markdown,
              description: subPageData.data.metadata?.description || '',
              metadata: subPageData.data.metadata
            };
          }
        } else {
          // Log error without consuming response body to avoid stream issues
          console.warn('Sub-page crawl failed for', subUrl, 'with status:', subPageResponse.status);
        }
      } catch (subPageError) {
        console.warn('Failed to crawl sub-page:', subUrl, subPageError);
      }
      return null;
    });
    
    // Wait for all sub-page crawls to complete
    const subPageResults = await Promise.all(subPagePromises);
    results.push(...subPageResults.filter(result => result !== null));

    const combinedContent = results.map(result => result.content).join('\n\n');
    if (isLikelyDirectoryListing(eventUrl, combinedContent)) {
      return [];
    }
    
  } catch (error) {
    console.error('Deep crawl error:', error);
  }
  
  return results;
}

function extractSubPageUrls(baseUrl: string, content: string): string[] {
  const urls: string[] = [];
  const baseDomain = new URL(baseUrl).origin;
  
  // Look for speaker, agenda, about, team related URLs (including German terms)
  const speakerKeywords = [
    'speaker', 'agenda', 'about', 'team', 'organizer', 'presenter', 'faculty',
    'referenten', 'programm', 'teilnehmer', 'sprecher', 'moderatoren'
  ];
  
  // Enhanced regex to find URLs in content (including relative URLs)
  const urlPatterns = [
    /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,  // Absolute URLs
    /href=["']([^"']+)["']/g,            // href attributes
    /src=["']([^"']+)["']/g              // src attributes
  ];
  
  for (const pattern of urlPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let urlString = match[1] || match[0];
      
      // Handle relative URLs
      if (urlString.startsWith('/')) {
        urlString = baseDomain + urlString;
      } else if (!urlString.startsWith('http')) {
        continue; // Skip non-URL matches
      }
      
      try {
        const url = new URL(urlString);
        // Only include URLs from the same domain
        if (url.origin === baseDomain) {
          // Check if URL contains speaker-related keywords
          const urlLower = url.pathname.toLowerCase();
          if (speakerKeywords.some(keyword => urlLower.includes(keyword))) {
            urls.push(urlString);
          }
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
  }
  
  // Also add common speaker page patterns if not found
  const commonSpeakerPaths = [
    '/referenten/',
    '/speakers/',
    '/agenda/',
    '/programm/',
    '/presenters/',
    '/faculty/'
  ];
  
  for (const path of commonSpeakerPaths) {
    const fullUrl = baseDomain + path;
    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
  }
  
  return [...new Set(urls)]; // Remove duplicates
}

/**
 * Prioritize sub-pages that are most likely to contain speaker information
 */
function prioritizeSubPagesForSpeakers(urls: string[]): string[] {
  const scored = urls.map(url => {
    const urlLower = url.toLowerCase();
    const pathAndQuery = urlLower.split('//')[1] || urlLower; // Get path after domain
    let score = 0;
    
    // High priority: speaker/presenter pages
    if (pathAndQuery.includes('speaker')) score += 100;
    if (pathAndQuery.includes('referent')) score += 100; // German
    if (pathAndQuery.includes('presenters')) score += 95;
    if (pathAndQuery.includes('faculty')) score += 90;
    
    // Medium-high priority: agenda/program pages (often include speakers)
    if (pathAndQuery.includes('agenda')) score += 80;
    if (pathAndQuery.includes('programm')) score += 80; // German
    if (pathAndQuery.includes('program')) score += 75;
    if (pathAndQuery.includes('schedule')) score += 70;
    
    // Medium priority: session/keynote pages
    if (pathAndQuery.includes('session')) score += 60;
    if (pathAndQuery.includes('keynote')) score += 65;
    if (pathAndQuery.includes('workshop')) score += 55;
    
    // Low priority: general info
    if (pathAndQuery.includes('about')) score += 30;
    if (pathAndQuery.includes('info')) score += 25;
    
    // Negative priority: non-speaker pages
    if (pathAndQuery.includes('register') || pathAndQuery.includes('registration')) score -= 50;
    if (pathAndQuery.includes('ticket') || pathAndQuery.includes('tickets')) score -= 50;
    if (pathAndQuery.includes('sponsor') || pathAndQuery.includes('sponsors')) score -= 40;
    if (pathAndQuery.includes('partner') || pathAndQuery.includes('partners')) score -= 40;
    if (pathAndQuery.includes('venue') || pathAndQuery.includes('location')) score -= 30;
    if (pathAndQuery.includes('hotel') || pathAndQuery.includes('travel')) score -= 35;
    if (pathAndQuery.includes('privacy') || pathAndQuery.includes('terms')) score -= 100;
    if (pathAndQuery.includes('cookie') || pathAndQuery.includes('legal')) score -= 100;
    if (pathAndQuery.includes('contact') || pathAndQuery.includes('impressum')) score -= 60;
    
    return { url, score };
  });
  
  // Sort by score descending and return URLs
  const prioritized = scored
    .sort((a, b) => b.score - a.score)
    .map(s => s.url);
  
  console.log('[event-analysis] Sub-page prioritization:', 
    scored.slice(0, 5).map(s => ({ 
      url: s.url.split('/').slice(-2).join('/'),
      score: s.score 
    }))
  );
  
  return prioritized;
}

function isLikelyDirectoryListing(eventUrl: string, combinedContent: string): boolean {
  if (!combinedContent || combinedContent.length < 400) {
    return true;
  }

  const urlObj = new URL(eventUrl);
  const normalized = combinedContent.toLowerCase();

  const hasYear = /\b20[2-9][0-9]\b/.test(normalized);
  const hasMonth = EVENT_MONTH_KEYWORDS.some(keyword => normalized.includes(keyword));
  const hasSchedule = /(agenda|programm|schedule|timetable|ablauf)/i.test(normalized);
  const hasSpeakerSection = /(speaker|speakers|referent|referenten|keynote|moderator)/i.test(normalized);
  const hasCallToAction = EVENT_CALL_TO_ACTION_KEYWORDS.some(keyword => normalized.includes(keyword));
  const hasLocation = EVENT_LOCATION_KEYWORDS.some(keyword => normalized.includes(keyword));

  const signalScore = [
    hasYear || hasMonth,
    hasSchedule,
    hasSpeakerSection,
    hasCallToAction,
    hasLocation
  ].filter(Boolean).length;

  const isAggregatorDomain = DIRECTORY_DOMAINS.has(urlObj.hostname);
  const isAggregatorPath = DIRECTORY_PATH_SEGMENTS.some(segment => urlObj.pathname.includes(segment));

  const requiredScore = (isAggregatorDomain || isAggregatorPath) ? 2 : 1;

  if (signalScore < requiredScore) {
    console.warn('Filtered directory-style listing due to low event signal score', {
      eventUrl,
      signalScore,
      requiredScore,
      isAggregatorDomain,
      isAggregatorPath
    });
    return true;
  }

  return false;
}

function extractSpeakerNamesManually(text: string): string[] {
  const speakerNames: string[] = [];
  
  // Enhanced patterns for speaker names (including German titles and names)
  const patterns = [
    // German titles and names - more comprehensive
    /(?:Prof\.|Dr\.|Mag\.|MBA|LL\.M\.)\s*([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)/g,
    /([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)(?:\s*,\s*(?:Dr\.|Prof\.|Mag\.|MBA|LL\.M\.|CEO|CTO|Director|Manager|Head|VP|Senior|Chief))/g,
    // Standard patterns
    /(?:Speaker|Presenter|Keynote|Panelist|Moderator|Moderatorin):\s*([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)/g,
    /([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)(?:\s*-\s*[A-ZÄÖÜ][a-zäöüß\s&]+)/g,
    // German specific patterns
    /(?:Referent|Referentin|Sprecher|Sprecherin|Moderator|Moderatorin):\s*([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)/g,
    // Names with titles in parentheses or after
    /([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)(?:\s*\([^)]+\)|\s*\|[^|]+)/g,
    // Simple name patterns for German names
    /(?:###\s*)([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)/g,
    /(?:####\s*)([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)/g,
    // Names followed by job titles
    /([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)(?:\s*\n\s*[A-ZÄÖÜ][a-zäöüß\s&|]+)/g
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1] || match[0];
      if (name && name.length > 3 && name.length < 50) {
        // Clean up the name
        const cleanName = name.trim()
          .replace(/^[^A-ZÄÖÜ]*/, '') // Remove leading non-capital letters
          .replace(/[^A-ZÄÖÜa-zäöüß\s].*$/, '') // Remove everything after first non-letter
          .trim();
        
        if (cleanName && cleanName.split(' ').length >= 2) {
          speakerNames.push(cleanName);
        }
      }
    }
  }
  
  // Remove duplicates and filter out common false positives
  const filteredNames = [...new Set(speakerNames)].filter(name => 
    !name.toLowerCase().includes('event') &&
    !name.toLowerCase().includes('conference') &&
    !name.toLowerCase().includes('compliance') &&
    !name.toLowerCase().includes('berlin') &&
    !name.toLowerCase().includes('bundeskongress') &&
    !name.toLowerCase().includes('tickets') &&
    !name.toLowerCase().includes('programm') &&
    name.split(' ').length >= 2 &&
    name.length > 5
  );
  
  return filteredNames.slice(0, 10); // Reduced to 10 speakers for faster processing
}

export async function fallbackToGoogleCSE(eventTitle: string, eventUrl: string): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  
  if (!googleKey || !googleCx) {
    console.warn('Google CSE keys not available for fallback');
    return results;
  }
  
  try {
    console.log('Using Google CSE fallback for:', eventTitle);
    
    const searchQueries = [
      `${eventTitle} speakers`,
      `${eventTitle} agenda`,
      `${eventTitle} presenters`,
      `site:${new URL(eventUrl).hostname} speakers`
    ];
    
    for (const query of searchQueries) {
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(query)}&num=3`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.items) {
          for (const item of data.items) {
            results.push({
              url: item.link,
              title: item.title,
              content: item.snippet,
              description: item.snippet,
              metadata: { source: 'google_cse' }
            });
          }
        }
      } else {
        // Log error without consuming response body to avoid stream issues
        console.warn('Google CSE search failed with status:', response.status);
      }
    }
    
    console.log('Google CSE fallback found', results.length, 'results');
  } catch (error) {
    console.warn('Google CSE fallback error:', error);
  }
  
  return results;
}

export async function extractEventMetadata(crawlResults: CrawlResult[], eventTitle?: string, eventDate?: string, country?: string): Promise<EventMetadata> {
  const fallbackMetadata: EventMetadata = {
    title: eventTitle || crawlResults[0]?.title || 'Unknown Event',
    description: crawlResults[0]?.description || '',
    date: eventDate || 'Unknown Date',
    location: country || 'Unknown Location',
    organizer: 'Unknown Organizer',
    website: crawlResults[0]?.url || '',
    registrationUrl: undefined
  };

  if (!geminiKey) {
    console.log('Gemini key not available for metadata extraction, using fallback');
    return fallbackMetadata;
  }

  if (!crawlResults || crawlResults.length === 0) {
    return fallbackMetadata;
  }

  const primaryUrl = crawlResults[0]?.url || '';
  const serializedSections = crawlResults.map(result =>
    `Page: ${result.title || 'Unknown'}\nURL: ${result.url}\nContent:\n${result.content || ''}`
  ).join('\n\n---\n\n');

  let normalizedHost = '';
  try {
    normalizedHost = normalizeHostname(new URL(primaryUrl).hostname);
  } catch {
    normalizedHost = '';
  }

  if (normalizedHost && (DIRECTORY_DOMAINS.has(normalizedHost) || AGGREGATOR_DOMAINS.has(normalizedHost))) {
    console.warn('Skipping Gemini metadata extraction for aggregator/directory domain', { primaryUrl, normalizedHost });
    return fallbackMetadata;
  }

  if (primaryUrl && isLikelyDirectoryListing(primaryUrl, serializedSections)) {
    console.warn('Detected directory-style listing during metadata extraction, using fallback', { primaryUrl });
    return fallbackMetadata;
  }

  try {
    console.log('Initializing Gemini for event metadata extraction...');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const metadataSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        date: { type: 'string', nullable: true },
        location: { type: 'string', nullable: true },
        organizer: { type: 'string', nullable: true },
        website: { type: 'string', nullable: true },
        registrationUrl: { type: 'string', nullable: true }
      }
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        topK: 12,
        maxOutputTokens: 2048, // Increased to handle JSON responses properly
        responseMimeType: 'application/json',
        responseSchema: metadataSchema
      }
    });
    console.log('Gemini model initialized for metadata extraction');
    
    const sectionChunks = crawlResults.flatMap(result => {
      const sectionText = `Page: ${result.title || 'Unknown'}\nURL: ${result.url}\nContent:\n${result.content || ''}`;
      return chunkText(sectionText, 1200, 150).slice(0, 2);
    });

    const chunks = sectionChunks.slice(0, 6);
    const aggregatedMetadata = {
      title: '',
      description: '',
      date: '',
      location: '',
      organizer: '',
      website: '',
      registrationUrl: ''
    };

    const desiredFields: Array<keyof typeof aggregatedMetadata> = ['title', 'description', 'date', 'location', 'organizer', 'website'];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prompt = `Extract factual event metadata as JSON using the provided schema. Only return fields you can confirm from this content chunk. Use null when unsure.

**Date Extraction Guidelines:**
- Look for dates in formats like: "November 10-17, 2025", "10-17 Nov 2025", "2025-11-10 to 2025-11-17"
- Return dates in ISO format: "2025-11-10" or as a range: "2025-11-10 to 2025-11-17"
- Check event headers, registration sections, and "when" or "date" sections
- If you find a date range, return it as "YYYY-MM-DD to YYYY-MM-DD"

**Location Extraction Guidelines:**
- Look for city names (Berlin, München, Frankfurt, etc.)
- Look for venue names and addresses
- Return format: "City, Country" (e.g., "Berlin, Germany")

Chunk ${i + 1}/${chunks.length}:
${chunk}`;

      console.log(`[event-analysis] Calling Gemini for metadata chunk ${i + 1}/${chunks.length}`);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gemini metadata chunk timeout after 15 seconds')), 15000);
      });

      try {
        if (chunk.trim().length < 200) {
          console.warn(`[event-analysis] Skipping metadata chunk ${i + 1} due to insufficient content`);
          continue;
        }

        const geminiPromise = model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        const result = await Promise.race([geminiPromise, timeoutPromise]) as any;
        const response = await result.response;
        const text = typeof response.text === 'function' ? await response.text() : response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!text || !text.trim()) {
          console.warn(`[event-analysis] Empty metadata response for chunk ${i + 1}`);
          continue;
        }

        // PHASE 1: Safe JSON parsing with auto-repair
        let metadata: any = null;
        try {
          metadata = JSON.parse(text);
        } catch (jsonError) {
          // Try to extract JSON from response if it's wrapped
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              metadata = JSON.parse(jsonMatch[0]);
              console.log(`[event-analysis] Recovered JSON from chunk ${i + 1} using regex extraction`);
            } catch (retryError) {
              console.warn(`[event-analysis] Metadata chunk ${i + 1} JSON parsing failed completely:`, jsonError);
              continue;
            }
          } else {
            console.warn(`[event-analysis] Metadata chunk ${i + 1} JSON parsing failed:`, jsonError);
            continue;
          }
        }
        
        if (metadata) {
          aggregatedMetadata.title = selectBetterValue(aggregatedMetadata.title, metadata.title);
          aggregatedMetadata.description = selectBetterValue(aggregatedMetadata.description, metadata.description);
          aggregatedMetadata.date = selectBetterValue(aggregatedMetadata.date, metadata.date);
          aggregatedMetadata.location = selectBetterValue(aggregatedMetadata.location, metadata.location);
          aggregatedMetadata.organizer = selectBetterValue(aggregatedMetadata.organizer, metadata.organizer);
          aggregatedMetadata.website = selectBetterValue(aggregatedMetadata.website, metadata.website);
          const registrationCandidate = metadata.registrationUrl ?? metadata.registration_url ?? metadata.registrationurl;
          aggregatedMetadata.registrationUrl = selectBetterValue(aggregatedMetadata.registrationUrl, registrationCandidate);
        }

        const allSatisfied = desiredFields.every(field => isMeaningfulValue(aggregatedMetadata[field]));
        if (allSatisfied) {
          break;
        }
      } catch (chunkError) {
        console.warn(`[event-analysis] Metadata chunk ${i + 1} failed`, chunkError);
        // Check if it's a MAX_TOKENS error
        if (chunkError instanceof Error && chunkError.message.includes('MAX_TOKENS')) {
          console.warn(`[event-analysis] Chunk ${i + 1} hit MAX_TOKENS limit, may need to reduce chunk size`);
        }
      }
    }

    // Return aggregated metadata
    return {
      title: aggregatedMetadata.title || eventTitle || 'Unknown Event',
      description: aggregatedMetadata.description || '',
      date: aggregatedMetadata.date || eventDate || 'Unknown Date',
      location: aggregatedMetadata.location || country || 'Unknown Location',
      organizer: aggregatedMetadata.organizer || 'Unknown Organizer',
      website: aggregatedMetadata.website || crawlResults[0]?.url || '',
      registrationUrl: aggregatedMetadata.registrationUrl
    };
  } catch (error) {
    console.warn('Event metadata extraction error:', error);
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn('Event metadata extraction timed out, using fallback');
    } else if (error instanceof Error && error.message.includes('MAX_TOKENS')) {
      console.warn('Event metadata extraction hit MAX_TOKENS, using fallback');
    } else if (error instanceof Error && error.message.includes('Empty')) {
      console.warn('Event metadata extraction returned empty response, using fallback');
    }
  }
  
  // Fallback
  return fallbackMetadata;
}

/**
 * Detect speaker section content patterns for quality scoring
 */
function detectSpeakerContentPatterns(text: string): {
  speakerNameCount: number;
  titleCount: number;
  organizationCount: number;
  bioIndicators: number;
  density: number;
} {
  const personNamePattern = /\b[A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+\b/g;
  const jobTitlePattern = /\b(CEO|CTO|CFO|Director|Manager|Head of|VP|President|Partner|Founder|Chief|Senior|Lead)\b/gi;
  const organizationPattern = /\bat [A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*/g;
  const bioPattern = /\b(experience|expert|specializes?|specialized|background|works at|responsible for|leads?|manages?)\b/gi;
  
  const speakerNameCount = (text.match(personNamePattern) || []).length;
  const titleCount = (text.match(jobTitlePattern) || []).length;
  const organizationCount = (text.match(organizationPattern) || []).length;
  const bioIndicators = (text.match(bioPattern) || []).length;
  const density = (speakerNameCount / Math.max(text.length, 1)) * 1000; // speakers per 1000 chars
  
  return { speakerNameCount, titleCount, organizationCount, bioIndicators, density };
}

/**
 * Extract and score speaker sections from content
 */
function extractSpeakerSections(content: string): Array<{
  heading: string;
  content: string;
  score: number;
  startIndex: number;
}> {
  const sections: Array<{
    heading: string;
    lines: string[];
    startIndex: number;
  }> = [];
  
  const lines = content.split('\n');
  let currentSection: { heading: string; lines: string[]; startIndex: number } | null = null;
  
  // Speaker heading patterns - ULTRA FLEXIBLE to catch all real-world variations
  // Matches: "Speakers", "## Referenten", "Ihre Speaker/-innen", "Tagungsleitung", etc.
  const speakerHeaderPattern = /^\s*(?:#{1,3}\s*)?(?:Ihre\s+)?(?:SPEAKERS?|PRESENTERS?|FACULTY|KEYNOTE|PANELISTS?|REFERENTEN?|SPRECHER|MODERATOREN?|FEATURED|GUEST|TAGUNGSLEITUNG|Speaker[\/-]?innen?)(?:\s*[:)])?/i;
  const nonSpeakerHeaderPattern = /^\s*(?:#{1,3}\s*)?(VENUE|LOCATION|HOTEL|TRAVEL|REGISTER|TICKET|SPONSOR|PARTNER|PRIVACY|TERMS|COOKIE|CONTACT|ABOUT|HOME|FAQ|PRICING|IMPRESSUM|AGB)(?:\s*[:)])?/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a speaker section header
    if (speakerHeaderPattern.test(line)) {
      // Save previous section if exists
      if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      
      // Start new section
      currentSection = {
        heading: line,
        lines: [],
        startIndex: i
      };
    } 
    // Check if we hit a non-speaker section
    else if (nonSpeakerHeaderPattern.test(line) && currentSection) {
      sections.push(currentSection);
      currentSection = null;
    }
    // Add line to current section
    else if (currentSection) {
      currentSection.lines.push(line);
    }
  }
  
  // Add final section
  if (currentSection && currentSection.lines.length > 0) {
    sections.push(currentSection);
  }
  
  // Score and filter sections
  return sections
    .map(section => {
      const sectionContent = section.lines.join('\n');
      const patterns = detectSpeakerContentPatterns(sectionContent);
      
      let score = 0;
      
      // Strong signals
      if (patterns.speakerNameCount >= 2) score += 0.4;
      if (patterns.titleCount >= 2) score += 0.3;
      if (patterns.organizationCount >= 1) score += 0.2;
      if (patterns.bioIndicators >= 2) score += 0.1;
      
      // Density bonus
      if (patterns.density > 5) score += 0.2;
      
      // Noise penalties
      if (sectionContent.toLowerCase().includes('register now')) score -= 0.2;
      if (sectionContent.toLowerCase().includes('cookie')) score -= 0.1;
      if (sectionContent.length < 200) score -= 0.3;
      
      return {
        heading: section.heading,
        content: sectionContent,
        score: Math.max(0, Math.min(1, score)),
        startIndex: section.startIndex
      };
    })
    .filter(section => section.score > 0.3) // Quality threshold
    .sort((a, b) => b.score - a.score);
}

/**
 * Create smart chunks focused on speaker-dense sections
 */
function createSmartChunks(
  crawlResults: CrawlResult[],
  maxChunks: number = 6
): string[] {
  const allSections: Array<{
    heading: string;
    content: string;
    score: number;
    sourceUrl: string;
    sourceTitle: string;
  }> = [];
  
  // Extract speaker sections from all crawl results
  for (const result of crawlResults) {
    const sections = extractSpeakerSections(result.content || '');
    allSections.push(...sections.map(s => ({
      ...s,
      sourceUrl: result.url,
      sourceTitle: result.title || 'Unknown'
    })));
  }
  
  // Sort by quality score
  const sortedSections = allSections.sort((a, b) => b.score - a.score);
  
  if (sortedSections.length > 0) {
    console.log(`[smart-chunking] Found ${sortedSections.length} speaker sections, using focused chunking`);
    
    const chunks: string[] = [];
    
    for (const section of sortedSections) {
      // For speaker sections, use smaller chunks to avoid splitting bios
      const sectionChunks = chunkText(section.content, 800, 100);
      
      // Add context to each chunk
      const contextualChunks = sectionChunks.map(chunk => 
        `Section: ${section.heading}\nURL: ${section.sourceUrl}\n\n${chunk}`
      );
      
      chunks.push(...contextualChunks);
      
      if (chunks.length >= maxChunks) {
        break;
      }
    }
    
    const result = chunks.slice(0, maxChunks);
    console.log(`[smart-chunking] Created ${result.length} speaker-focused chunks (avg ${Math.round(result.reduce((sum, c) => sum + c.length, 0) / result.length)} chars)`);
    return result;
  }
  
  // Fallback to generic chunking
  console.log('[smart-chunking] No speaker sections found, using generic chunking');
  const sectionChunks = crawlResults.flatMap(result => {
    const sectionText = `Page: ${result.title || 'Unknown'}\nURL: ${result.url}\nContent:\n${result.content || ''}`;
    return chunkText(sectionText, 1200, 150).slice(0, 2);
  });
  
  return sectionChunks.slice(0, maxChunks);
}

/**
 * Validation: Filter out non-person names from speaker extraction
 * Used by both Gemini extraction and manual fallback
 */
function isLikelyPersonName(name: string): boolean {
  const nameLower = name.toLowerCase();
  
  // Filter out call-to-action phrases and UI elements
  const ctaKeywords = [
    'reserve', 'register', 'book', 'buy', 'purchase', 'sign up', 'login',
    'learn more', 'read more', 'view more', 'see more', 'click here',
    'download', 'subscribe', 'join', 'enroll', 'attend', 'save', 'share',
    'contact', 'submit', 'apply', 'ticket', 'seat', 'now', 'today'
  ];
  
  if (ctaKeywords.some(keyword => nameLower.includes(keyword))) {
    console.log(`[speaker-validation] Filtered out CTA/UI element: "${name}"`);
    return false;
  }
  
  // Filter out event/session titles
  const eventKeywords = [
    'summit', 'forum', 'conference', 'act', 'practice', 'risk', 'privacy',
    'lawyers', 'compliance', 'webinar', 'session', 'panel', 'workshop',
    'event', 'meeting', 'seminar', 'symposium', 'congress', 'convention',
    'day', 'week', 'month', 'year', 'edition', 'annual', 'international',
    'program', 'agenda', 'schedule', 'keynote', 'presentation', 'track',
    'instructor', 'trainer', 'teacher', 'tutor', 'facilitator', 'educator'  // Filter out teaching roles
  ];
  
  if (eventKeywords.some(keyword => nameLower.includes(keyword))) {
    console.log(`[speaker-validation] Filtered out event name: "${name}"`);
    return false;
  }
  
  // Filter out generic organizational terms
  const orgKeywords = [
    'committee', 'board', 'team', 'group', 'department', 'organization',
    'association', 'institute', 'foundation', 'council', 'society', 'partner',
    'center', 'centre', 'resource', 'library', 'portal', 'hub', 'network'
  ];
  
  if (orgKeywords.some(keyword => nameLower.includes(keyword))) {
    console.log(`[speaker-validation] Filtered out organization term: "${name}"`);
    return false;
  }
  
  // Must have at least first and last name
  const parts = name.split(/\s+/);
  if (parts.length < 2) {
    console.log(`[speaker-validation] Filtered out single-word name: "${name}"`);
    return false;
  }
  
  // Filter out if name is too long (likely a sentence or title)
  if (parts.length > 4 || name.length > 50) {
    console.log(`[speaker-validation] Filtered out overly long name: "${name}"`);
    return false;
  }
  
  // Check if name contains only proper capitalization (Person Names are Title Case)
  const hasProperCapitalization = parts.every(part => 
    part.length > 0 && /^[A-ZÄÖÜ]/.test(part)
  );
  
  if (!hasProperCapitalization) {
    console.log(`[speaker-validation] Filtered out improper capitalization: "${name}"`);
    return false;
  }
  
  // Check that each word looks like a name part (letters only, possibly with hyphens/apostrophes)
  const hasValidCharacters = parts.every(part => 
    /^[A-ZÄÖÜa-zäöüß\-']+$/.test(part)
  );
  
  if (!hasValidCharacters) {
    console.log(`[speaker-validation] Filtered out invalid characters: "${name}"`);
    return false;
  }
  
  return true;
}

export async function extractAndEnhanceSpeakers(crawlResults: CrawlResult[]): Promise<SpeakerData[]> {
  if (!geminiKey) {
    console.log('Gemini key not available, returning empty speakers array');
    return [];
  }

  if (!crawlResults || crawlResults.length === 0) {
    return [];
  }

  try {
    console.log('Initializing Gemini for speaker extraction...');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const speakerSchema = {
      type: 'object',
      properties: {
        speakers: {
          type: 'array',
          maxItems: 15,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              title: { type: 'string', nullable: true },
              company: { type: 'string', nullable: true },
              bio: { type: 'string', nullable: true }
            },
            required: ['name']
          }
        }
      },
      required: ['speakers']
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 12,
        maxOutputTokens: 2048,  // Increased to 2048 to handle thinking tokens (up to 1023 observed) + response
        responseMimeType: 'application/json',
        responseSchema: speakerSchema
      }
    });
    console.log('Gemini model initialized successfully');

    const serializedSections = crawlResults.map(result =>
      `Page: ${result.title || 'Unknown'}\nURL: ${result.url}\nContent:\n${result.content || ''}`
    ).join('\n\n---\n\n');

    const primaryUrl = crawlResults[0]?.url || '';
    let normalizedHost = '';
    try {
      normalizedHost = normalizeHostname(new URL(primaryUrl).hostname);
    } catch {
      normalizedHost = '';
    }

    if (normalizedHost && (DIRECTORY_DOMAINS.has(normalizedHost) || AGGREGATOR_DOMAINS.has(normalizedHost))) {
      console.warn('Skipping Gemini speaker extraction for aggregator/directory domain', { primaryUrl, normalizedHost });
      return [];
    }

    if (primaryUrl && isLikelyDirectoryListing(primaryUrl, serializedSections)) {
      console.warn('Detected directory-style listing during speaker extraction, skipping Gemini call', { primaryUrl });
      return [];
    }

    // Use smart chunking to focus on speaker sections
    const chunks = createSmartChunks(crawlResults, 6);
    console.log('Preparing content for Gemini analysis, total chunk count:', chunks.length);

    const speakerMap = new Map<string, SpeakerData>();

    // Upsert speaker with validation
    const upsertSpeaker = (speaker: any) => {
      if (!speaker) return;
      const rawName = speaker.name ?? speaker.fullName ?? speaker.full_name;
      if (!isMeaningfulValue(rawName)) return;
      const name = rawName.trim();
      
      // Validate that this is likely a person name
      if (!isLikelyPersonName(name)) {
        return;
      }
      
      const key = name.toLowerCase();
      const existing = speakerMap.get(key);
      const normalizedSpeaker: SpeakerData = {
        name,
        title: speaker.title?.trim?.() ?? '',
        company: speaker.company?.trim?.() ?? '',
        bio: speaker.bio?.trim?.() ?? ''
      };

      if (!existing) {
        speakerMap.set(key, normalizedSpeaker);
        return;
      }

      existing.title = selectBetterValue(existing.title, normalizedSpeaker.title);
      existing.company = selectBetterValue(existing.company, normalizedSpeaker.company);
      existing.bio = selectBetterValue(existing.bio, normalizedSpeaker.bio);
      speakerMap.set(key, existing);
    };

    // Process chunks in parallel for speed
    const processChunk = async (chunk: string, index: number) => {
      const prompt = `Extract ONLY PEOPLE (actual speakers/presenters) from this event content.

REQUIRED: Each entry must be a REAL PERSON with a full name.

DO NOT EXTRACT:
✗ Event names: "Privacy Summit", "Risk Forum", "Compliance Day"
✗ Session titles: "Practices Act", "Keynote Address", "Panel Discussion"  
✗ Organization names: "ABC Corporation", "Legal Institute"
✗ UI/CTA elements: "Reserve Seat", "Register Now", "Book Ticket", "Learn More"
✗ Buttons/Links: "Sign Up", "Download", "Contact", "View More", "Save Date"
✗ Generic roles: "Moderator", "Organizer", "Committee" (without names)
✗ Organizational terms: "Organizing Committee", "Advisory Board", "Program Team"
✗ Navigation/Menu items: "Home", "About", "Contact", "Privacy Policy"

ONLY EXTRACT:
✓ Full person names: "Dr. Sarah Johnson", "Michael Schmidt", "María García"
✓ With context: job title, company, bio if available
✓ Real individuals with first AND last names

Return JSON with "speakers" array. If NO PEOPLE found, return {"speakers": []}.

Content chunk ${index + 1}/${chunks.length}:
${chunk}`;

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gemini speaker chunk timeout after 15 seconds')), 15000);
      });

      if (chunk.trim().length < 250) {
        console.warn(`[event-analysis] Skipping speaker chunk ${index + 1} due to insufficient content`);
        return [];
      }

      try {
        const geminiPromise = model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const result = await Promise.race([geminiPromise, timeoutPromise]) as any;
        const response = await result.response;
        const text = typeof response.text === 'function' ? await response.text() : response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!text || !text.trim()) {
          console.warn(`[event-analysis] Empty speaker response for chunk ${index + 1}`);
          return [];
        }

        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (jsonError) {
          // Try to extract JSON from response if it's wrapped in markdown or other text
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
              console.log(`[event-analysis] Recovered JSON from chunk ${index + 1} using regex extraction`);
            } catch (retryError) {
              throw new Error(`JSON parsing failed: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
            }
          } else {
            throw jsonError;
          }
        }
        
        if (Array.isArray(parsed?.speakers)) {
          console.log(`[event-analysis] Processing ${parsed.speakers.length} speakers from chunk ${index + 1}`);
          return parsed.speakers;
        } else {
          console.warn(`[event-analysis] Chunk ${index + 1} response has no speakers array`, parsed);
          return [];
        }
      } catch (chunkError) {
        console.warn(`[event-analysis] Speaker chunk ${index + 1} failed`, chunkError);
        return [];
      }
    };

    // Process all chunks in parallel
    console.log('[event-analysis] Processing chunks in parallel for speed...');
    const chunkPromises = chunks.map((chunk, i) => processChunk(chunk, i));
    const chunkResults = await Promise.allSettled(chunkPromises);

    // Process results
    chunkResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        result.value.forEach(upsertSpeaker);
      } else if (result.status === 'rejected') {
        console.warn(`[event-analysis] Chunk ${i + 1} rejected:`, result.reason);
      }
    });

    if (speakerMap.size > 0) {
      const rawSpeakers = Array.from(speakerMap.values()).slice(0, 20);
      
      // PHASE 2: Filter speakers to only include persons
      const validSpeakers = filterSpeakers(rawSpeakers as RawSpeaker[]);
      
      console.log(`[event-analysis] ✓ Speaker extraction: ${rawSpeakers.length} raw → ${validSpeakers.length} validated (filtered ${rawSpeakers.length - validSpeakers.length} non-persons)`);
      return validSpeakers as SpeakerData[];
    }

    console.log('[event-analysis] No speakers found via Gemini, trying manual extraction fallback...');
    const fallbackNames = extractSpeakerNamesManually(serializedSections);
    if (fallbackNames.length > 0) {
      console.log(`[event-analysis] Manual extraction found ${fallbackNames.length} potential names`);
      
      // PHASE 2: Use same comprehensive filtering as Gemini results
      const rawFallbackSpeakers = fallbackNames.map(name => ({
        name,
        title: '',
        company: '',
        bio: ''
      }));
      
      const validatedSpeakers = filterSpeakers(rawFallbackSpeakers as RawSpeaker[]);
      
      console.log(`[event-analysis] ✓ Manual extraction: ${fallbackNames.length} raw → ${validatedSpeakers.length} validated (filtered ${fallbackNames.length - validatedSpeakers.length} non-persons)`);
      
      if (validatedSpeakers.length > 0) {
        return validatedSpeakers as SpeakerData[];
      }
    }

    console.warn('[event-analysis] ⚠ Speaker extraction failed completely, returning empty array');
    return [];
  } catch (error) {
    console.warn('Speaker extraction error:', error);
    return [];
  }
}

export async function analyzeEventRequest(request: EventAnalysisRequest): Promise<EventAnalysisResponse> {
  const startTime = Date.now();

  let timeoutId: NodeJS.Timeout | undefined;
  const overallTimeout = new Promise<EventAnalysisResponse>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Event analysis timed out after 2 minutes'));
    }, 120000);
  });

  const analysisPromise = (async (): Promise<EventAnalysisResponse> => {
    try {
      const { eventUrl, eventTitle, eventDate, country } = request;

      if (!eventUrl) {
        return {
          success: false,
          cached: false,
          event: {} as EventMetadata,
          speakers: [],
          crawl_stats: {
            pages_crawled: 0,
            total_content_length: 0,
            speakers_found: 0,
            crawl_duration_ms: 0
          },
          error: 'Event URL is required'
        };
      }

      const cachedResult = await getCachedAnalysis(eventUrl);
      const shouldUseCache = !process.env.BYPASS_CACHE && !process.env.NODE_ENV?.includes('development');
      if (cachedResult && shouldUseCache) {
        console.log('Returning cached result for:', eventUrl);
        return cachedResult;
      }

      if (cachedResult && !shouldUseCache) {
        console.log('Cache bypassed for:', eventUrl);
      }

      let crawlResults = await deepCrawlEvent(eventUrl);

      if (crawlResults.length === 0 || crawlResults.every(result => (result.content?.length ?? 0) < 100)) {
        console.log('Crawling failed or returned minimal content, trying Google CSE fallback');
        crawlResults = await fallbackToGoogleCSE(eventTitle || 'Event', eventUrl);
      }

      if (crawlResults.length === 0) {
        return {
          success: false,
          cached: false,
          event: {} as EventMetadata,
          speakers: [],
          crawl_stats: {
            pages_crawled: 0,
            total_content_length: 0,
            speakers_found: 0,
            crawl_duration_ms: Date.now() - startTime
          },
          error: 'Failed to crawl event content'
        };
      }

      console.log('Starting event metadata extraction...');
      const eventMetadata = await extractEventMetadata(crawlResults, eventTitle, eventDate, country);
      console.log('Event metadata extraction completed:', { title: eventMetadata.title, location: eventMetadata.location });

      console.log('Starting speaker extraction and enhancement...');
      const speakers = await extractAndEnhanceSpeakers(crawlResults);
      console.log('Speaker extraction completed, found', speakers.length, 'speakers');

      const crawlDuration = Date.now() - startTime;
      const totalContentLength = crawlResults.reduce((sum, result) => sum + (result.content?.length ?? 0), 0);

      const analysisResult: EventAnalysisResponse = {
        success: true,
        cached: false,
        event: eventMetadata,
        speakers,
        crawl_stats: {
          pages_crawled: crawlResults.length,
          total_content_length: totalContentLength,
          speakers_found: speakers.length,
          crawl_duration_ms: crawlDuration
        }
      };

      await cacheAnalysis(eventUrl, analysisResult);

      console.log('Event analysis completed:', {
        pages_crawled: crawlResults.length,
        speakers_found: speakers.length,
        duration_ms: crawlDuration
      });

      return analysisResult;
    } catch (error) {
      console.error('Event analysis error:', error);

      return {
        success: false,
        cached: false,
        event: {} as EventMetadata,
        speakers: [],
        crawl_stats: {
          pages_crawled: 0,
          total_content_length: 0,
          speakers_found: 0,
          crawl_duration_ms: Date.now() - startTime
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })();

  try {
    const result = await Promise.race([analysisPromise, overallTimeout]);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    return result;
  } catch (error) {
    console.error('Event analysis overall failure:', error);
    return {
      success: false,
      cached: false,
      event: {} as EventMetadata,
      speakers: [],
      crawl_stats: {
        pages_crawled: 0,
        total_content_length: 0,
        speakers_found: 0,
        crawl_duration_ms: Date.now() - startTime
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
