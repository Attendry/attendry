/**
 * Speaker Enhancement API
 * 
 * This endpoint takes basic speaker data and enhances it with additional
 * professional information using real search data and AI processing.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { SpeakerData } from "@/lib/types/core";
import { supabaseServer } from "@/lib/supabase-server";

const geminiKey = process.env.GEMINI_API_KEY;
const firecrawlKey = process.env.FIRECRAWL_KEY;
const googleKey = process.env.GOOGLE_CSE_KEY;
const googleCx = process.env.GOOGLE_CSE_CX;
// Use Gemini 2.5 Pro via REST (same pattern as elsewhere in app)
const GEMINI_MODEL_PATH = process.env.GEMINI_MODEL_PATH || 'v1beta/models/gemini-2.5-pro:generateContent';

console.log('Environment check:', {
  geminiKey: !!geminiKey,
  firecrawlKey: !!firecrawlKey,
  googleKey: !!googleKey,
  googleCx: !!googleCx,
  geminiKeyLength: geminiKey?.length || 0
});

interface EnhancedSpeakerData extends SpeakerData {
  location?: string;
  education?: string[];
  publications?: string[];
  career_history?: string[];
  social_links?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  expertise_areas?: string[];
  speaking_history?: string[];
  achievements?: string[];
  industry_connections?: string[];
  recent_news?: string[];
}

interface SpeakerEnhancementRequest {
  speaker: SpeakerData;
}

interface SpeakerEnhancementResponse {
  enhanced: EnhancedSpeakerData;
  success: boolean;
  stored?: boolean;
  cached?: boolean;
  error?: string;
}

/**
 * Enhance speaker data with real search-based information
 */
async function enhanceSpeakerProfile(speaker: SpeakerData): Promise<EnhancedSpeakerData> {
  console.log('enhanceSpeakerProfile called for:', speaker.name);
  console.log('Available services:', {
    gemini: !!geminiKey,
    firecrawl: !!firecrawlKey,
    cse: !!(googleKey && googleCx)
  });
  
  // Build comprehensive search query for the speaker
  const searchQuery = `"${speaker.name}" ${speaker.title || ''} ${speaker.org || ''} linkedin profile bio professional background`;
  console.log('Search query:', searchQuery);
  
  let searchContext = '';
  let searchResults = [] as any[];
  
  // Use Firecrawl for comprehensive web search (up to 50 concurrent sessions)
  if (firecrawlKey) {
    try {
      console.log('Using Firecrawl for speaker research...');
      
      const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 10,
          searchOptions: {
            includeHtml: false,
            onlyMainContent: true
          }
        })
      });
      
      if (firecrawlResponse.ok) {
        const firecrawlData = await firecrawlResponse.json();
        searchResults = firecrawlData.data || [];
        console.log('Firecrawl results:', searchResults.length);
        // Light prioritization: prefer URLs that look like org-owned pages
        if (speaker.org) {
          const orgKey = speaker.org.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
          searchResults.sort((a: any, b: any) => {
            const as = String(a.url || a.link || '').toLowerCase();
            const bs = String(b.url || b.link || '').toLowerCase();
            const amatch = orgKey.some(k => as.includes(k));
            const bmatch = orgKey.some(k => bs.includes(k));
            return (bmatch ? 1 : 0) - (amatch ? 1 : 0);
          });
        }
        if (searchResults.length > 0) {
          searchContext = searchResults.map((result: any, index: number) => 
            `${index + 1}. ${result.title}\n   ${result.content || result.snippet}\n   URL: ${result.url}`
          ).join('\n\n');
        }
      }
    } catch (firecrawlError) {
      console.warn('Firecrawl search failed:', firecrawlError);
    }
  }
  
  // Fallback to Google CSE if Firecrawl fails or isn't available
  if (!searchContext && googleKey && googleCx) {
    try {
      console.log('Using Google CSE for speaker research...');
      
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}&num=5`;
      const searchResponse = await fetch(searchUrl);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        searchResults = searchData.items || [];
        console.log('CSE results:', searchResults.length);
        if (speaker.org) {
          const orgKey = speaker.org.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
          searchResults.sort((a: any, b: any) => {
            const as = String(a.link || a.url || '').toLowerCase();
            const bs = String(b.link || b.url || '').toLowerCase();
            const amatch = orgKey.some(k => as.includes(k));
            const bmatch = orgKey.some(k => bs.includes(k));
            return (bmatch ? 1 : 0) - (amatch ? 1 : 0);
          });
        }
        
        if (searchResults.length > 0) {
          searchContext = searchResults.map((item: any, index: number) => 
            `${index + 1}. ${item.title}\n   ${item.snippet}\n   URL: ${item.link}`
          ).join('\n\n');
        }
      }
    } catch (cseError) {
      console.warn('CSE search failed:', cseError);
    }
  }
  
  // If we have search results, use AI to process them
  if (searchContext && geminiKey) {
    try {
      console.log('Processing search results with AI...');

      const prompt = `You are a professional research assistant. Based on the following information about a speaker and real search results, generate a comprehensive professional profile. Always include provenance (source URLs) for media and, when available, for connections.

Speaker Information:
- Name: ${speaker.name}
- Title: ${speaker.title || 'Not specified'}
- Organization: ${speaker.org || 'Not specified'}

Real Search Results:
${searchContext}

Please extract and synthesize real information from the search results. Create a professional profile based on actual data found online. Be specific and accurate, avoiding generic statements.

Return ONLY a valid JSON object with these fields and nothing else. Do not include any markdown fences or extra text:
{
  "title": "Current job title based on search results or existing data",
  "organization": "Current organization/company/affiliation based on search results or existing data",
  "location": "Specific location based on search results or organization",
  "education": ["List of 2-3 relevant educational background items based on actual data"],
  "expertise_areas": ["List of 3-5 specific areas of expertise based on real information"],
  "achievements": ["List of 2-3 specific professional achievements based on search results"],
  "industry_connections": [
    { "name": "Full name or entity", "org": "Organization if relevant", "url": "https://... (if available)" }
  ],
  "recent_news": [
    { "title": "Headline", "url": "https://...", "date": "YYYY-MM-DD" }
  ]
}

async function findCachedSpeakerProfile(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
  speaker: SpeakerData
): Promise<EnhancedSpeakerData | null> {
  try {
    const speakerKey = (speaker.profile_url || speaker.name || 'unknown')
      .toLowerCase()
      .trim();

    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ speaker, speakerKey }))
      .digest('hex');

    const { data, error } = await supabase
      .from('enhanced_speaker_profiles')
      .select('enhanced_data')
      .eq('user_id', userId)
      .eq('speaker_key', speakerKey)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load cached speaker profile:', error.message);
      return null;
    }

    if (!data?.enhanced_data) {
      return null;
    }

    const cached = data.enhanced_data as EnhancedSpeakerData & { fingerprint?: string };
    if (cached.fingerprint && cached.fingerprint === fingerprint) {
      return cached;
    }

    return null;
  } catch (error) {
    console.warn('Error retrieving cached speaker profile:', error);
    return null;
  }
}

async function persistEnhancedSpeaker(
  enhanced: EnhancedSpeakerData,
  original: SpeakerData,
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string
): Promise<boolean> {
  try {
    const speakerKey = (enhanced.profile_url || original.profile_url || enhanced.name || original.name || 'unknown')
      .toLowerCase()
      .trim();

    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ speaker: original, speakerKey }))
      .digest('hex');

    const payload = {
      user_id: userId,
      speaker_key: speakerKey,
      speaker_name: enhanced.name || original.name,
      speaker_org: enhanced.org || original.org || null,
      speaker_title: enhanced.title || original.title || null,
      session_title: original.session || enhanced.session || null,
      profile_url: enhanced.profile_url || original.profile_url || null,
      raw_input: original,
      enhanced_data: { ...enhanced, fingerprint },
      confidence: enhanced.confidence ?? null,
      last_enhanced_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('enhanced_speaker_profiles')
      .upsert(payload, { onConflict: 'user_id,speaker_key' });

    if (upsertError) {
      console.warn('Failed to upsert enhanced speaker profile', upsertError.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Error persisting enhanced speaker profile:', error);
    return false;
  }
}

Base the information on the actual search results. If specific information isn't found, make reasonable inferences based on the person's role and organization, but avoid generic statements.`;

      const url = `https://generativelanguage.googleapis.com/${GEMINI_MODEL_PATH}?key=${geminiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      });
      const raw = await resp.text();
      if (!resp.ok) {
        console.warn('[ai] Gemini call failed', { status: resp.status, statusText: resp.statusText, body: raw.slice(0, 500), modelPath: GEMINI_MODEL_PATH });
        throw new Error(`Gemini call failed: ${resp.status} ${resp.statusText}`);
      }
      let text = '';
      try {
        const data = JSON.parse(raw);
        const candidates = Array.isArray(data.candidates) ? data.candidates : [];
        const parts = candidates?.[0]?.content?.parts || [];
        text = parts.map((p: any) => p.text).filter(Boolean).join('\n');
      } catch (_) {
        text = raw;
      }
      console.log('[ai] Response text length:', text?.length || 0, 'modelPath:', GEMINI_MODEL_PATH);
      
      // Parse the JSON response
      let enhancedData: any;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          enhancedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        throw parseError;
      }
      // Filter recent_news to last 2 years and ensure provenance
      if (Array.isArray(enhancedData?.recent_news)) {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        enhancedData.recent_news = enhancedData.recent_news
          .filter((it: any) => it && typeof it === 'object' && it.url)
          .filter((it: any) => {
            const d = it.date ? new Date(it.date) : null;
            return d instanceof Date && !isNaN(d.getTime()) ? d >= twoYearsAgo : true;
          });
      }

      // Combine with original speaker data
      const enhanced = {
        ...speaker,
        ...enhancedData,
        title: enhancedData?.title || speaker.title || enhancedData?.role || null,
        org: enhancedData?.organization || speaker.org || enhancedData?.company || null,
        confidence: 0.9 // High confidence for search-based content
      };
      
      console.log('AI enhancement completed successfully');
      return enhanced;
      
    } catch (aiError) {
      console.error('AI enhancement failed:', aiError);
    }
  }
  
  // Fallback: return minimal enhancement
  console.log('Using fallback enhancement');
  return {
    ...speaker,
    location: speaker.org ? `${speaker.org} Headquarters` : 'Location not specified',
    education: [`Professional background in ${speaker.title?.toLowerCase() || 'relevant field'}`],
    expertise_areas: [speaker.title || 'Professional expertise'],
    achievements: [`Professional experience at ${speaker.org || 'various organizations'}`],
    industry_connections: ['Professional network'],
    confidence: 0.3 // Low confidence for fallback
  };
}

export async function POST(req: NextRequest): Promise<NextResponse<SpeakerEnhancementResponse>> {
  try {
    console.log('Speaker enhancement API called');
    console.log('Environment check in API route:', {
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      FIRECRAWL_KEY: !!process.env.FIRECRAWL_KEY,
      GOOGLE_CSE_KEY: !!process.env.GOOGLE_CSE_KEY,
      GOOGLE_CSE_CX: !!process.env.GOOGLE_CSE_CX,
      length: process.env.GEMINI_API_KEY?.length || 0
    });
    
    const requestData: SpeakerEnhancementRequest = await req.json();
    const { speaker } = requestData;
    console.log('Request data received:', { name: speaker.name, org: speaker.org });

    if (!speaker || !speaker.name) {
      return NextResponse.json({
        enhanced: speaker as EnhancedSpeakerData,
        success: false,
        error: "Speaker name is required"
      }, { status: 400 });
    }

    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      console.warn('Failed to retrieve authenticated user:', userErr.message);
    }
    const userId = userRes?.user?.id || null;

    let cachedProfile: EnhancedSpeakerData | null = null;
    let cached = false;
    if (userId) {
      cachedProfile = await findCachedSpeakerProfile(supabase, userId, speaker);
      if (cachedProfile) {
        cached = true;
      }
    }

    const enhanced = cachedProfile || await enhanceSpeakerProfile(speaker);
    if (!cached) {
      console.log('Enhancement completed, confidence:', enhanced.confidence);
    } else {
      console.log('Returning cached enhanced speaker profile');
    }

    let stored = false;
    if (userId) {
      try {
        stored = await persistEnhancedSpeaker(enhanced, speaker, supabase, userId);
      } catch (persistError) {
        console.warn('Failed to persist enhanced speaker profile:', persistError);
      }
    }

    return NextResponse.json({
      enhanced,
      success: true,
      stored,
      cached,
      debug: {
        geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
        firecrawlKeyConfigured: !!process.env.FIRECRAWL_KEY,
        googleCseConfigured: !!(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX),
        confidence: enhanced.confidence,
        hasEnhancedFields: !!(enhanced.education || enhanced.publications || enhanced.career_history)
      }
    });

  } catch (error) {
    console.error('Speaker enhancement error:', error);
    return NextResponse.json({
      enhanced: {} as EnhancedSpeakerData,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}