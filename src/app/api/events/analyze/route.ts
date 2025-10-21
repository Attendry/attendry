/**
 * Purpose-Built Event Analysis API
 * 
 * This endpoint analyzes events by:
 * 1. Deep crawling the event domain with Firecrawl
 * 2. Extracting event metadata and speaker information
 * 3. Enhancing speaker data with Gemini AI
 * 4. Caching results to avoid re-analysis
 * 5. Providing Google CSE fallback for failed crawls
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

// Environment variables
const geminiKey = process.env.GEMINI_API_KEY;
const firecrawlKey = process.env.FIRECRAWL_KEY;
const googleKey = process.env.GOOGLE_CSE_KEY;
const googleCx = process.env.GOOGLE_CSE_CX;

// Rate limiting configuration
const FIRECRAWL_RATE_LIMIT = {
  maxRequestsPerMinute: 10,
  maxRequestsPerHour: 100,
  delayBetweenRequests: 6000 // 6 seconds
};

// Cache configuration
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface EventAnalysisRequest {
  eventUrl: string;
  eventTitle?: string;
  eventDate?: string;
  country?: string;
}

interface EventMetadata {
  title: string;
  description: string;
  date: string;
  location: string;
  organizer: string;
  website: string;
  registrationUrl?: string;
}

interface SpeakerData {
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

interface CrawlResult {
  url: string;
  title: string;
  content: string;
  description: string;
  metadata: any;
}

interface EventAnalysisResponse {
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

async function getCachedAnalysis(eventUrl: string): Promise<EventAnalysisResponse | null> {
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

async function cacheAnalysis(eventUrl: string, analysis: EventAnalysisResponse): Promise<void> {
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

async function deepCrawlEvent(eventUrl: string): Promise<CrawlResult[]> {
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
    
    // First, crawl the main page
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
        includeTags: ['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span']
      })
    });
    
    if (mainPageResponse.ok) {
      const mainPageData = await mainPageResponse.json();
      if (mainPageData.data?.content) {
        results.push({
          url: eventUrl,
          title: mainPageData.data.metadata?.title || 'Main Page',
          content: mainPageData.data.content,
          description: mainPageData.data.metadata?.description || '',
          metadata: mainPageData.data.metadata
        });
        console.log('Main page crawled, content length:', mainPageData.data.content.length);
      }
    }
    
    // Extract potential sub-pages from the main page content
    const subPageUrls = extractSubPageUrls(eventUrl, results[0]?.content || '');
    console.log('Found potential sub-pages:', subPageUrls.length);
    
    // Crawl sub-pages (with rate limiting)
    for (const subUrl of subPageUrls.slice(0, 5)) { // Limit to 5 sub-pages
      if (!checkRateLimit()) {
        console.warn('Rate limit reached, stopping sub-page crawling');
        break;
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, FIRECRAWL_RATE_LIMIT.delayBetweenRequests));
      
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
            onlyMainContent: true
          })
        });
        
        if (subPageResponse.ok) {
          const subPageData = await subPageResponse.json();
          if (subPageData.data?.content) {
            results.push({
              url: subUrl,
              title: subPageData.data.metadata?.title || 'Sub Page',
              content: subPageData.data.content,
              description: subPageData.data.metadata?.description || '',
              metadata: subPageData.data.metadata
            });
            console.log('Sub-page crawled:', subUrl, 'content length:', subPageData.data.content.length);
          }
        }
      } catch (subPageError) {
        console.warn('Failed to crawl sub-page:', subUrl, subPageError);
      }
    }
    
  } catch (error) {
    console.error('Deep crawl error:', error);
  }
  
  return results;
}

function extractSubPageUrls(baseUrl: string, content: string): string[] {
  const urls: string[] = [];
  const baseDomain = new URL(baseUrl).origin;
  
  // Look for speaker, agenda, about, team related URLs
  const speakerKeywords = ['speaker', 'agenda', 'about', 'team', 'organizer', 'presenter', 'faculty'];
  
  // Simple regex to find URLs in content
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const matches = content.match(urlRegex) || [];
  
  for (const match of matches) {
    try {
      const url = new URL(match);
      // Only include URLs from the same domain
      if (url.origin === baseDomain) {
        // Check if URL contains speaker-related keywords
        const urlLower = url.pathname.toLowerCase();
        if (speakerKeywords.some(keyword => urlLower.includes(keyword))) {
          urls.push(match);
        }
      }
    } catch (e) {
      // Invalid URL, skip
    }
  }
  
  return [...new Set(urls)]; // Remove duplicates
}

async function fallbackToGoogleCSE(eventTitle: string, eventUrl: string): Promise<CrawlResult[]> {
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
      }
    }
    
    console.log('Google CSE fallback found', results.length, 'results');
  } catch (error) {
    console.warn('Google CSE fallback error:', error);
  }
  
  return results;
}

async function extractEventMetadata(crawlResults: CrawlResult[], eventTitle?: string, eventDate?: string, country?: string): Promise<EventMetadata> {
  if (!geminiKey) {
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
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
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

async function extractAndEnhanceSpeakers(crawlResults: CrawlResult[]): Promise<SpeakerData[]> {
  if (!geminiKey) {
    return [];
  }
  
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const combinedContent = crawlResults.map(result => 
      `Page: ${result.title}\nURL: ${result.url}\nContent: ${result.content}`
    ).join('\n\n');
    
    // Use the new prompt management system
    const { createSpeakerExtractionPrompt } = await import('../../../../lib/prompts/gemini-prompts');
    const { promptExecutor } = await import('../../../../lib/prompts/prompt-executor');
    
    const prompt = createSpeakerExtractionPrompt(combinedContent, 15, 'general');
    
    const result = await promptExecutor.executeSpeakerExtraction(prompt, combinedContent);
    
    if (result.success && result.data?.speakers) {
      return result.data.speakers;
    } else {
      console.warn('Speaker extraction failed:', result.error);
      return [];
    }
  } catch (error) {
    console.warn('Speaker extraction error:', error);
  }
  
  return [];
}

export async function POST(req: NextRequest): Promise<NextResponse<EventAnalysisResponse>> {
  const startTime = Date.now();
  
  try {
    console.log('Event analysis API called');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const requestData: EventAnalysisRequest = await req.json();
    const { eventUrl, eventTitle, eventDate, country } = requestData;
    
    if (!eventUrl) {
      return NextResponse.json({
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
        error: "Event URL is required"
      }, { status: 400 });
    }
    
    console.log('Analyzing event:', eventUrl);
    
    // Check cache first
    const cachedResult = await getCachedAnalysis(eventUrl);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }
    
    // Deep crawl the event
    let crawlResults = await deepCrawlEvent(eventUrl);
    
    // If crawling failed or returned no content, try Google CSE fallback
    if (crawlResults.length === 0 || crawlResults.every(result => result.content.length < 100)) {
      console.log('Crawling failed or returned minimal content, trying Google CSE fallback');
      crawlResults = await fallbackToGoogleCSE(eventTitle || 'Event', eventUrl);
    }
    
    if (crawlResults.length === 0) {
      return NextResponse.json({
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
        error: "Failed to crawl event content"
      }, { status: 500 });
    }
    
    // Extract event metadata
    const eventMetadata = await extractEventMetadata(crawlResults, eventTitle, eventDate, country);
    
    // Extract and enhance speakers
    const speakers = await extractAndEnhanceSpeakers(crawlResults);
    
    const crawlDuration = Date.now() - startTime;
    const totalContentLength = crawlResults.reduce((sum, result) => sum + result.content.length, 0);
    
    const analysisResult: EventAnalysisResponse = {
      success: true,
      cached: false,
      event: eventMetadata,
      speakers: speakers,
      crawl_stats: {
        pages_crawled: crawlResults.length,
        total_content_length: totalContentLength,
        speakers_found: speakers.length,
        crawl_duration_ms: crawlDuration
      }
    };
    
    // Cache the result
    await cacheAnalysis(eventUrl, analysisResult);
    
    console.log('Event analysis completed:', {
      pages_crawled: crawlResults.length,
      speakers_found: speakers.length,
      duration_ms: crawlDuration
    });
    
    return NextResponse.json(analysisResult);
    
  } catch (error) {
    console.error('Event analysis error:', error);
    
    return NextResponse.json({
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
    }, { status: 500 });
  }
}
