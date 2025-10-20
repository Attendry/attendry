/**
 * Hybrid Speaker Extractor
 * 
 * Combines the multi-source event discovery from /api/events/run
 * with the superior deep crawling and speaker extraction from calendar promotion.
 * 
 * This allows Events search to maintain its broad discovery capabilities
 * while providing the same high-quality speaker data as calendar promotion.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

// Environment variables
const geminiKey = process.env.GEMINI_API_KEY;
const firecrawlKey = process.env.FIRECRAWL_KEY;

// Rate limiting configuration - optimized for batch processing
const FIRECRAWL_RATE_LIMIT = {
  maxRequestsPerMinute: 15, // Slightly lower for batch processing
  maxRequestsPerHour: 150,  // Adjusted for multiple events
  delayBetweenRequests: 2000 // 2 seconds between requests
};

// Cache configuration
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export interface EventCandidate {
  id: string;
  title: string;
  source_url: string;
  description?: string;
  starts_at?: string;
  ends_at?: string;
  city?: string;
  country?: string;
  venue?: string;
  organizer?: string;
  confidence?: number;
  // Existing basic speaker data
  speakers?: Array<{
    name: string;
    title?: string;
    org?: string;
    bio?: string;
    confidence?: number;
  }>;
}

export interface EnhancedSpeakerData {
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

export interface EnhancedEventCandidate extends EventCandidate {
  // Enhanced speaker data
  enhanced_speakers?: EnhancedSpeakerData[];
  // Analysis metadata
  analysis_completed?: boolean;
  speakers_found?: number;
  crawl_stats?: {
    pages_crawled: number;
    total_content_length: number;
    speakers_found: number;
    crawl_duration_ms: number;
  };
  // Enhanced confidence based on analysis
  enhanced_confidence?: number;
}

// Rate limiting storage
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(): boolean {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const key = `hybrid_firecrawl_${minute}`;
  
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

async function getCachedAnalysis(eventUrl: string): Promise<EnhancedSpeakerData[] | null> {
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
      console.warn('Failed to check cache for hybrid extractor:', error.message);
      return null;
    }
    
    if (data?.analysis_data?.speakers) {
      console.log('Returning cached speakers for hybrid extractor:', eventUrl);
      return data.analysis_data.speakers;
    }
    
    return null;
  } catch (error) {
    console.warn('Cache check error for hybrid extractor:', error);
    return null;
  }
}

async function deepCrawlEventForSpeakers(eventUrl: string): Promise<{
  speakers: EnhancedSpeakerData[];
  crawl_stats: {
    pages_crawled: number;
    total_content_length: number;
    speakers_found: number;
    crawl_duration_ms: number;
  };
}> {
  const startTime = Date.now();
  const results: Array<{ url: string; title: string; content: string; description: string; metadata: any }> = [];
  
  if (!firecrawlKey) {
    console.warn('Firecrawl key not available for hybrid extractor');
    return { speakers: [], crawl_stats: { pages_crawled: 0, total_content_length: 0, speakers_found: 0, crawl_duration_ms: 0 } };
  }
  
  // Check rate limit
  if (!checkRateLimit()) {
    console.warn('Firecrawl rate limit exceeded for hybrid extractor');
    return { speakers: [], crawl_stats: { pages_crawled: 0, total_content_length: 0, speakers_found: 0, crawl_duration_ms: 0 } };
  }
  
  try {
    console.log('Starting hybrid deep crawl for:', eventUrl);
    
    // First, crawl the main page
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
          onlyMainContent: false,
          timeout: 15000
        })
      });
    } catch (fetchError) {
      console.warn('Hybrid: Failed to fetch main page:', fetchError);
      return { speakers: [], crawl_stats: { pages_crawled: 0, total_content_length: 0, speakers_found: 0, crawl_duration_ms: Date.now() - startTime } };
    }
    
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
        console.log('Hybrid: Main page crawled, content length:', mainPageData.data.content.length);
      }
    } else {
      // Log error without consuming response body to avoid stream issues
      console.warn('Hybrid: Main page crawl failed with status:', mainPageResponse.status);
    }
    
    // Extract potential sub-pages from the main page content
    const subPageUrls = extractSubPageUrls(eventUrl, results[0]?.content || '');
    console.log('Hybrid: Found potential sub-pages:', subPageUrls.length);
    
    // Crawl sub-pages (with rate limiting) - limit to 2 for batch processing
    for (const subUrl of subPageUrls.slice(0, 2)) {
      if (!checkRateLimit()) {
        console.warn('Rate limit reached, stopping sub-page crawling for hybrid extractor');
        break;
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, FIRECRAWL_RATE_LIMIT.delayBetweenRequests));
      
      try {
        let subPageResponse;
        try {
          subPageResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: subUrl,
              formats: ['markdown'],
              onlyMainContent: false,
              timeout: 10000
            })
          });
        } catch (subFetchError) {
          console.warn('Hybrid: Failed to fetch sub-page:', subUrl, subFetchError);
          continue; // Skip this sub-page and continue with the next one
        }
        
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
            console.log('Hybrid: Sub-page crawled:', subUrl, 'content length:', subPageData.data.content.length);
          }
        } else {
          // Log error without consuming response body to avoid stream issues
          console.warn('Hybrid: Sub-page crawl failed for', subUrl, 'with status:', subPageResponse.status);
        }
      } catch (subPageError) {
        console.warn('Failed to crawl sub-page for hybrid extractor:', subUrl, subPageError);
      }
    }
    
  } catch (error) {
    console.error('Hybrid deep crawl error:', error);
  }
  
  // Extract speakers using Gemini
  const speakers = await extractSpeakersWithGemini(results);
  
  const crawlDuration = Date.now() - startTime;
  const totalContentLength = results.reduce((sum, result) => sum + result.content.length, 0);
  
  return {
    speakers,
    crawl_stats: {
      pages_crawled: results.length,
      total_content_length: totalContentLength,
      speakers_found: speakers.length,
      crawl_duration_ms: crawlDuration
    }
  };
}

function extractSubPageUrls(baseUrl: string, content: string): string[] {
  const urls: string[] = [];
  const baseDomain = new URL(baseUrl).origin;
  
  // Look for speaker, agenda, about, team related URLs
  const speakerKeywords = ['speaker', 'agenda', 'about', 'team', 'organizer', 'presenter', 'faculty', 'referenten', 'programm'];
  
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

async function extractSpeakersWithGemini(crawlResults: Array<{ url: string; title: string; content: string; description: string; metadata: any }>): Promise<EnhancedSpeakerData[]> {
  if (!geminiKey || crawlResults.length === 0) {
    return [];
  }
  
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const combinedContent = crawlResults.map(result => 
      `Page: ${result.title}\nURL: ${result.url}\nContent: ${result.content}`
    ).join('\n\n');
    
    const prompt = `Analyze the following event content and extract all speakers/presenters with their detailed information:

${combinedContent}

For each speaker found, extract and return the following information in JSON format:
{
  "speakers": [
    {
      "name": "Full name",
      "title": "Job title/position",
      "company": "Company/organization",
      "bio": "Professional biography",
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

Focus on extracting real, factual information from the content. If information is not available, use null or empty arrays. Be thorough in finding all speakers mentioned in the content. Limit to maximum 15 speakers to avoid overwhelming the system.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Try to parse JSON
    try {
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.speakers && Array.isArray(data.speakers)) {
          console.log('Hybrid: Extracted', data.speakers.length, 'speakers');
          return data.speakers;
        }
      }
    } catch (parseError) {
      console.warn('Failed to parse speakers JSON for hybrid extractor:', parseError);
    }
  } catch (error) {
    console.warn('Speaker extraction error for hybrid extractor:', error);
  }
  
  return [];
}

/**
 * Enhance a batch of event candidates with superior speaker extraction
 * 
 * @param candidates - Array of event candidates from the search pipeline
 * @param maxConcurrent - Maximum number of concurrent deep crawls (default: 3)
 * @returns Enhanced event candidates with rich speaker data
 */
export async function enhanceEventsWithSuperiorSpeakers(
  candidates: EventCandidate[],
  maxConcurrent: number = 3
): Promise<EnhancedEventCandidate[]> {
  console.log(`Hybrid: Starting enhancement of ${candidates.length} events with max ${maxConcurrent} concurrent crawls`);
  
  const enhancedCandidates: EnhancedEventCandidate[] = [];
  
  // Process events in batches to respect rate limits
  for (let i = 0; i < candidates.length; i += maxConcurrent) {
    const batch = candidates.slice(i, i + maxConcurrent);
    
    const batchPromises = batch.map(async (candidate) => {
      try {
        // Check cache first
        const cachedSpeakers = await getCachedAnalysis(candidate.source_url);
        if (cachedSpeakers) {
          console.log(`Hybrid: Using cached speakers for ${candidate.title}`);
          return {
            ...candidate,
            enhanced_speakers: cachedSpeakers,
            analysis_completed: true,
            speakers_found: cachedSpeakers.length,
            enhanced_confidence: Math.min(0.9, (candidate.confidence || 0.5) + 0.3)
          };
        }
        
        // Perform deep crawl for speakers
        const { speakers, crawl_stats } = await deepCrawlEventForSpeakers(candidate.source_url);
        
        const enhancedCandidate: EnhancedEventCandidate = {
          ...candidate,
          enhanced_speakers: speakers,
          analysis_completed: true,
          speakers_found: speakers.length,
          crawl_stats,
          enhanced_confidence: speakers.length > 0 ? Math.min(0.9, (candidate.confidence || 0.5) + 0.3) : candidate.confidence
        };
        
        console.log(`Hybrid: Enhanced ${candidate.title} with ${speakers.length} speakers`);
        return enhancedCandidate;
        
      } catch (error) {
        console.warn(`Hybrid: Failed to enhance ${candidate.title}:`, error);
        return {
          ...candidate,
          enhanced_speakers: [],
          analysis_completed: false,
          speakers_found: 0,
          enhanced_confidence: candidate.confidence
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    enhancedCandidates.push(...batchResults);
    
    // Add delay between batches to respect rate limits
    if (i + maxConcurrent < candidates.length) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay between batches
    }
  }
  
  console.log(`Hybrid: Completed enhancement of ${enhancedCandidates.length} events`);
  return enhancedCandidates;
}

/**
 * Convert enhanced speakers to legacy format for compatibility
 */
export function convertEnhancedSpeakersToLegacy(enhancedSpeakers: EnhancedSpeakerData[]): Array<{
  name: string;
  title: string | null;
  org: string | null;
  bio: string | null;
  confidence: number;
}> {
  return enhancedSpeakers.map(speaker => ({
    name: speaker.name,
    title: speaker.title || null,
    org: speaker.company || null,
    bio: speaker.bio || null,
    confidence: 0.8 // High confidence for AI-enhanced data
  }));
}
