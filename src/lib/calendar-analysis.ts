/**
 * Calendar-Specific Event Analysis
 * 
 * A lighter, faster analysis pipeline specifically for calendar promotion
 * that won't block or interfere with the main events search pipeline.
 * 
 * This uses separate rate limiting and caching to prevent conflicts.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

// Environment variables
const geminiKey = process.env.GEMINI_API_KEY;
const firecrawlKey = process.env.FIRECRAWL_KEY;

// Separate rate limiting for calendar analysis
const CALENDAR_FIRECRAWL_RATE_LIMIT = {
  maxRequestsPerMinute: 5,  // Much lower for calendar
  maxRequestsPerHour: 50,   // Lower hourly limit
  delayBetweenRequests: 3000 // 3 seconds between requests
};

// Separate cache configuration
const CALENDAR_CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours (shorter than main pipeline)

export interface CalendarEventMetadata {
  title: string;
  description: string;
  date: string;
  location: string;
  organizer: string;
  website: string;
  registrationUrl?: string;
}

export interface CalendarSpeakerData {
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

export interface CalendarAnalysisResponse {
  success: boolean;
  cached: boolean;
  event: CalendarEventMetadata;
  speakers: CalendarSpeakerData[];
  crawl_stats: {
    pages_crawled: number;
    total_content_length: number;
    speakers_found: number;
    crawl_duration_ms: number;
  };
  error?: string;
}

interface CalendarCrawlResult {
  url: string;
  title: string;
  content: string;
  description: string;
  metadata: any;
}

// Separate rate limiting storage for calendar
const calendarRateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkCalendarRateLimit(): boolean {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const key = `calendar_firecrawl_${minute}`;
  
  const current = calendarRateLimitStore.get(key) || { count: 0, resetTime: now + 60000 };
  
  if (current.resetTime < now) {
    calendarRateLimitStore.set(key, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (current.count >= CALENDAR_FIRECRAWL_RATE_LIMIT.maxRequestsPerMinute) {
    return false;
  }
  
  current.count++;
  calendarRateLimitStore.set(key, current);
  return true;
}

async function getCalendarCachedAnalysis(eventUrl: string): Promise<CalendarAnalysisResponse | null> {
  try {
    const supabase = await supabaseServer();
    const urlHash = createHash('sha256').update(eventUrl).digest('hex');
    
    const { data, error } = await supabase
      .from('event_analysis_cache')
      .select('analysis_data, created_at')
      .eq('url_hash', urlHash)
      .gt('created_at', new Date(Date.now() - CALENDAR_CACHE_DURATION).toISOString())
      .maybeSingle();
    
    if (error) {
      console.warn('Failed to check calendar cache:', error.message);
      return null;
    }
    
    if (data?.analysis_data) {
      console.log('Returning cached calendar analysis for:', eventUrl);
      return data.analysis_data;
    }
    
    return null;
  } catch (error) {
    console.warn('Calendar cache check error:', error);
    return null;
  }
}

async function cacheCalendarAnalysis(eventUrl: string, analysis: CalendarAnalysisResponse): Promise<void> {
  try {
    const supabase = await supabaseServer();
    const urlHash = createHash('sha256').update(eventUrl).digest('hex');
    
    await supabase
      .from('event_analysis_cache')
      .upsert({
        url_hash: urlHash,
        analysis_data: analysis,
        created_at: new Date().toISOString()
      });
    
    console.log('Calendar analysis cached for:', eventUrl);
  } catch (error) {
    console.warn('Failed to cache calendar analysis:', error);
  }
}

async function calendarDeepCrawl(eventUrl: string): Promise<CalendarCrawlResult[]> {
  const results: CalendarCrawlResult[] = [];
  
  if (!firecrawlKey) {
    console.warn('Firecrawl key not available for calendar analysis');
    return results;
  }
  
  // Check calendar-specific rate limit
  if (!checkCalendarRateLimit()) {
    console.warn('Calendar Firecrawl rate limit exceeded');
    return results;
  }
  
  try {
    console.log('Starting calendar deep crawl for:', eventUrl);
    
    // Only crawl the main page for calendar analysis (faster)
    let mainPageResponse;
    try {
      mainPageResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: eventUrl,
          formats: ['markdown'],
          onlyMainContent: true, // Only main content for speed
          timeout: 10000 // Shorter timeout
        })
      });
    } catch (fetchError) {
      console.warn('Calendar: Failed to fetch main page:', fetchError);
      return results;
    }
    
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
        console.log('Calendar: Main page crawled, content length:', mainPageData.data.markdown.length);
      }
    } else {
      console.warn('Calendar: Main page crawl failed with status:', mainPageResponse.status);
    }
    
  } catch (error) {
    console.error('Calendar deep crawl error:', error);
  }
  
  return results;
}

async function extractCalendarEventMetadata(crawlResults: CalendarCrawlResult[], eventTitle?: string, eventDate?: string, country?: string): Promise<CalendarEventMetadata> {
  if (!geminiKey || crawlResults.length === 0) {
    console.log('Gemini key not available for calendar metadata extraction, using fallback');
    return {
      title: eventTitle || crawlResults[0]?.title || 'Unknown Event',
      description: crawlResults[0]?.description || '',
      date: eventDate || 'Unknown Date',
      location: country || 'Unknown Location',
      organizer: 'Unknown Organizer',
      website: crawlResults[0]?.url || ''
    };
  }
  
  try {
    console.log('Initializing Gemini for calendar event metadata extraction...');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('Calendar: Gemini model initialized for metadata extraction');
    
    // Use only first 1000 chars for speed
    const combinedContent = crawlResults.map(result => 
      `Page: ${result.title}\nURL: ${result.url}\nContent: ${result.content.substring(0, 1000)}...`
    ).join('\n\n');
    
    const prompt = `Extract basic event metadata from the following content:

${combinedContent}

Return JSON format:
{
  "title": "Event title",
  "description": "Event description",
  "date": "Event date",
  "location": "Event location/city",
  "organizer": "Event organizer name",
  "website": "Event website URL",
  "registrationUrl": "Registration URL if found"
}

Focus on extracting accurate, factual information. If information is not available, use "Unknown" or null.`;

    console.log('Calling Gemini API for calendar event metadata extraction...');
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Calendar Gemini API timeout after 15 seconds')), 15000);
    });
    
    const geminiPromise = model.generateContent(prompt);
    const result = await Promise.race([geminiPromise, timeoutPromise]) as any;
    const response = await result.response;
    console.log('Calendar: Gemini API call completed for metadata, processing response...');
    const text = response.text();
    console.log('Calendar: Gemini metadata response received, length:', text.length);
    
    // Try to parse JSON
    try {
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        console.log('Calendar: Successfully extracted event metadata');
        return {
          title: data.title || eventTitle || 'Unknown Event',
          description: data.description || '',
          date: data.date || eventDate || 'Unknown Date',
          location: data.location || country || 'Unknown Location',
          organizer: data.organizer || 'Unknown Organizer',
          website: data.website || crawlResults[0]?.url || '',
          registrationUrl: data.registrationUrl
        };
      }
    } catch (parseError) {
      console.warn('Failed to parse calendar event metadata JSON:', parseError);
    }
  } catch (error) {
    console.warn('Calendar event metadata extraction error:', error);
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn('Calendar event metadata extraction timed out, using fallback');
    }
  }
  
  // Fallback
  return {
    title: eventTitle || crawlResults[0]?.title || 'Unknown Event',
    description: crawlResults[0]?.description || '',
    date: eventDate || 'Unknown Date',
    location: country || 'Unknown Location',
    organizer: 'Unknown Organizer',
    website: crawlResults[0]?.url || ''
  };
}

async function extractCalendarSpeakers(crawlResults: CalendarCrawlResult[]): Promise<CalendarSpeakerData[]> {
  if (!geminiKey || crawlResults.length === 0) {
    console.log('Gemini key not available for calendar speaker extraction, returning empty array');
    return [];
  }
  
  try {
    console.log('Initializing Gemini for calendar speaker extraction...');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('Calendar: Gemini model initialized successfully');
    
    // Limit content length to prevent timeouts - use first 1500 chars per page
    const combinedContent = crawlResults.map(result => 
      `Page: ${result.title}\nURL: ${result.url}\nContent: ${result.content.substring(0, 1500)}${result.content.length > 1500 ? '...' : ''}`
    ).join('\n\n');
    
    console.log('Calendar: Preparing content for Gemini analysis, total content length:', combinedContent.length);
    
    const prompt = `Analyze the following event content and extract speakers/presenters. This content may be in German or English.

${combinedContent}

For each speaker found, extract and return the following information in JSON format:
{
  "speakers": [
    {
      "name": "Full name (including titles like Dr., Prof., etc.)",
      "title": "Job title/position",
      "company": "Company/organization",
      "bio": "Professional biography or description",
      "expertise_areas": ["area1", "area2"],
      "social_links": {
        "linkedin": "LinkedIn URL if found",
        "twitter": "Twitter URL if found",
        "website": "Personal website if found"
      },
      "speaking_history": ["recent speaking engagements"],
      "education": ["educational background"],
      "achievements": ["notable achievements"],
      "industry_connections": ["industry connections"],
      "recent_news": ["recent news mentions"],
      "contact": "Email or contact info if found"
    }
  ]
}

Important instructions:
- Look for German titles like "Prof. Dr.", "Dr.", "Mag.", "MBA", "LL.M."
- Look for German job titles like "Director", "Manager", "Head of", "Chief", "VP", "Senior"
- Look for German terms like "Referent", "Referentin", "Sprecher", "Sprecherin", "Moderator", "Moderatorin"
- Extract ALL speakers mentioned, even if information is limited
- If a speaker only has a name and title, still include them with available information
- Focus on extracting real, factual information from the content
- If information is not available, use null or empty arrays
- Be thorough in finding all speakers mentioned in the content
- Limit to maximum 10 speakers for calendar analysis

Return valid JSON only, no additional text.`;

    console.log('Calling Gemini API for calendar speaker extraction...');
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Calendar Gemini API timeout after 20 seconds')), 20000);
    });
    
    const geminiPromise = model.generateContent(prompt);
    const result = await Promise.race([geminiPromise, timeoutPromise]) as any;
    const response = await result.response;
    console.log('Calendar: Gemini API call completed, processing response...');
    const text = response.text();
    console.log('Calendar: Gemini response received, length:', text.length);
    
    // Try to parse JSON with better error handling
    try {
      console.log('Calendar: Raw Gemini response for speakers:', text.substring(0, 500) + '...');
      
      // Try to extract JSON more carefully
      let parsedData = null;
      
      // First, try to find the JSON block between ```json and ```
      const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        try {
          parsedData = JSON.parse(jsonBlockMatch[1]);
          console.log('Calendar: Successfully parsed JSON from code block');
        } catch (e) {
          console.warn('Calendar: Failed to parse JSON from code block:', e);
        }
      }
      
      // If that didn't work, try to find the first complete JSON object
      if (!parsedData) {
        const jsonStart = text.indexOf('{');
        if (jsonStart !== -1) {
          let braceCount = 0;
          let jsonEnd = jsonStart;
          
          for (let i = jsonStart; i < text.length; i++) {
            if (text[i] === '{') braceCount++;
            if (text[i] === '}') braceCount--;
            if (braceCount === 0) {
              jsonEnd = i;
              break;
            }
          }
          
          if (braceCount === 0) {
            try {
              const jsonStr = text.substring(jsonStart, jsonEnd + 1);
              parsedData = JSON.parse(jsonStr);
              console.log('Calendar: Successfully parsed JSON by counting braces');
            } catch (e) {
              console.warn('Calendar: Failed to parse JSON by counting braces:', e);
            }
          }
        }
      }
      
      if (parsedData && parsedData.speakers && Array.isArray(parsedData.speakers)) {
        console.log('Calendar: Extracted', parsedData.speakers.length, 'speakers');
        return parsedData.speakers;
      }
      
    } catch (parseError) {
      console.warn('Calendar: Failed to parse speakers JSON:', parseError);
    }
  } catch (error) {
    console.warn('Calendar: Speaker extraction error:', error);
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn('Calendar: Speaker extraction timed out, returning empty array');
    }
  }
  
  return [];
}

export async function analyzeCalendarEvent(eventUrl: string, eventTitle?: string, eventDate?: string, country?: string): Promise<CalendarAnalysisResponse> {
  const startTime = Date.now();
  
  // Set overall timeout for the entire calendar analysis (60 seconds)
  const overallTimeout = new Promise<CalendarAnalysisResponse>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Calendar event analysis timed out after 60 seconds'));
    }, 60000);
  });
  
  const analysisPromise = (async () => {
    try {
      console.log('Starting calendar event analysis for:', eventUrl);
      
      if (!eventUrl) {
        return {
          success: false,
          cached: false,
          event: {} as CalendarEventMetadata,
          speakers: [],
          crawl_stats: {
            pages_crawled: 0,
            total_content_length: 0,
            speakers_found: 0,
            crawl_duration_ms: 0
          },
          error: "Event URL is required"
        };
      }
      
      // Check calendar-specific cache first
      const cachedResult = await getCalendarCachedAnalysis(eventUrl);
      if (cachedResult && !process.env.BYPASS_CACHE && !process.env.NODE_ENV?.includes('development')) {
        console.log('Returning cached calendar result for:', eventUrl);
        return cachedResult;
      } else if (cachedResult) {
        console.log('Calendar cache bypassed for:', eventUrl);
      }
      
      // Deep crawl the event (calendar-specific, lighter)
      let crawlResults = await calendarDeepCrawl(eventUrl);
      
      if (crawlResults.length === 0) {
        return {
          success: false,
          cached: false,
          event: {} as CalendarEventMetadata,
          speakers: [],
          crawl_stats: {
            pages_crawled: 0,
            total_content_length: 0,
            speakers_found: 0,
            crawl_duration_ms: Date.now() - startTime
          },
          error: "Failed to crawl event content"
        };
      }
      
      // Extract event metadata
      console.log('Starting calendar event metadata extraction...');
      const eventMetadata = await extractCalendarEventMetadata(crawlResults, eventTitle, eventDate, country);
      console.log('Calendar: Event metadata extraction completed:', { title: eventMetadata.title, location: eventMetadata.location });
      
      // Extract and enhance speakers
      console.log('Starting calendar speaker extraction and enhancement...');
      const speakers = await extractCalendarSpeakers(crawlResults);
      console.log('Calendar: Speaker extraction completed, found', speakers.length, 'speakers');
      
      const crawlDuration = Date.now() - startTime;
      const totalContentLength = crawlResults.reduce((sum, result) => sum + result.content.length, 0);
      
      const analysisResult: CalendarAnalysisResponse = {
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
      await cacheCalendarAnalysis(eventUrl, analysisResult);
      
      console.log('Calendar: Event analysis completed:', {
        pages_crawled: crawlResults.length,
        speakers_found: speakers.length,
        duration_ms: crawlDuration
      });
      
      return analysisResult;
      
    } catch (error) {
      console.error('Calendar: Event analysis error:', error);
      
      return {
        success: false,
        cached: false,
        event: {} as CalendarEventMetadata,
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
  
  // Race between analysis and timeout
  return Promise.race([analysisPromise, overallTimeout]);
}
