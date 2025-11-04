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
  expertise_areas: string[];
  social_links: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  speaking_history: string[];
  education: string[];
  achievements: string[];
  industry_connections: string[];
  recent_news: string[];
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
    
    // First, crawl the main page with Firecrawl v2 API
    const mainPageResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: eventUrl,
        formats: ['markdown'],
        onlyMainContent: false, // Get more content, not just main content
        timeout: 25000 // Increased to 25s for stability
      })
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
    
    // Extract potential sub-pages from the main page content
    const subPageUrls = extractSubPageUrls(eventUrl, results[0]?.content || '');
    console.log('Found potential sub-pages:', subPageUrls.length);
    
    // Crawl sub-pages in parallel (OPTIMIZED FOR SPEED)
    const subPagePromises = subPageUrls.slice(0, 3).map(async (subUrl, index) => { // Reduced to 3 sub-pages, parallel processing
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
            onlyMainContent: false,
            timeout: 10000 // Further reduced to 10s for sub-pages
          })
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
  if (!geminiKey) {
    console.log('Gemini key not available for metadata extraction, using fallback');
    // Fallback to basic extraction
    return {
      title: eventTitle || crawlResults[0]?.title || 'Unknown Event',
      description: crawlResults[0]?.description || '',
      date: eventDate || 'Unknown Date',
      location: country || 'Unknown Location',
      organizer: 'Unknown Organizer',
      website: crawlResults[0]?.url || '',
      registrationUrl: undefined
    };
  }
  
  try {
    console.log('Initializing Gemini for event metadata extraction...');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('Gemini model initialized for metadata extraction');
    
    const combinedContent = crawlResults.map(result => 
      `Page: ${result.title}\nURL: ${result.url}\nContent: ${result.content.substring(0, 1000)}...`
    ).join('\n\n');
    
    const prompt = `Extract event metadata from the following crawled content:

${combinedContent}

Please extract and return the following information in JSON format:
{
  "title": "Event title",
  "description": "Event description",
  "date": "Event date (YYYY-MM-DD format if possible)",
  "location": "Event location/city",
  "organizer": "Event organizer name",
  "website": "Event website URL",
  "registrationUrl": "Registration URL if found"
}

Focus on extracting accurate, factual information. If information is not available, use "Unknown" or null.`;

    console.log('Calling Gemini API for event metadata extraction...');
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API timeout after 20 seconds')), 20000);
    });
    
    const geminiPromise = model.generateContent(prompt);
    const result = await Promise.race([geminiPromise, timeoutPromise]) as any;
    const response = await result.response;
    console.log('Gemini API call completed for metadata, processing response...');
    const text = response.text();
    console.log('Gemini metadata response received, length:', text.length);
    
    // Try to parse JSON
    try {
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const metadata = JSON.parse(jsonMatch[0]);
        return {
          title: metadata.title || eventTitle || 'Unknown Event',
          description: metadata.description || '',
          date: metadata.date || eventDate || 'Unknown Date',
          location: metadata.location || country || 'Unknown Location',
          organizer: metadata.organizer || 'Unknown Organizer',
          website: metadata.website || crawlResults[0]?.url || '',
          registrationUrl: metadata.registrationUrl
        };
      }
    } catch (parseError) {
      console.warn('Failed to parse event metadata JSON:', parseError);
    }
  } catch (error) {
    console.warn('Event metadata extraction error:', error);
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn('Event metadata extraction timed out, using fallback');
    }
  }
  
  // Fallback
  return {
    title: eventTitle || crawlResults[0]?.title || 'Unknown Event',
    description: crawlResults[0]?.description || '',
    date: eventDate || 'Unknown Date',
    location: country || 'Unknown Location',
    organizer: 'Unknown Organizer',
    website: crawlResults[0]?.url || '',
    registrationUrl: undefined
  };
}

export async function extractAndEnhanceSpeakers(crawlResults: CrawlResult[]): Promise<SpeakerData[]> {
  if (!geminiKey) {
    console.log('Gemini key not available, returning empty speakers array');
    return [];
  }

  try {
    console.log('Initializing Gemini for speaker extraction...');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('Gemini model initialized successfully');

    const combinedContent = crawlResults.map(result =>
      `Page: ${result.title}\nURL: ${result.url}\nContent: ${result.content.substring(0, 2000)}${result.content.length > 2000 ? '...' : ''}`
    ).join('\n\n');

    console.log('Preparing content for Gemini analysis, total content length:', combinedContent.length);

    const { createSpeakerExtractionPrompt } = await import('./prompts/gemini-prompts');
    const { promptExecutor } = await import('./prompts/prompt-executor');

    const prompt = createSpeakerExtractionPrompt(combinedContent, 15, 'general');
    const result = await promptExecutor.executeSpeakerExtraction(prompt, combinedContent);

    if (result.success && result.data?.speakers) {
      return result.data.speakers;
    }

    console.warn('Speaker extraction failed:', result.error);
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
