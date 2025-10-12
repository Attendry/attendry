/**
 * Speaker Enhancement API
 * 
 * This endpoint takes basic speaker data and enhances it with additional
 * professional information using LLM + web search.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SpeakerData } from "@/lib/types/core";

const geminiKey = process.env.GOOGLE_AI_API_KEY;
const googleKey = process.env.GOOGLE_CSE_KEY;
const googleCx = process.env.GOOGLE_CSE_CX;
const LLM_MODEL = "gemini-1.5-flash";

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
  error?: string;
}

/**
 * Enhance speaker data with additional professional information
 */
async function enhanceSpeakerProfile(speaker: SpeakerData): Promise<EnhancedSpeakerData> {
  if (!geminiKey || !googleKey || !googleCx) {
    // Missing API keys, return basic profile with low confidence
    return {
      ...speaker,
      confidence: 0.3
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: LLM_MODEL });

    // Search for additional information about the speaker
    const searchQuery = `"${speaker.name}" "${speaker.org || ''}" ${speaker.title || ""} linkedin profile bio professional background`;
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}&num=5`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    const searchResults = searchData.items || [];

    const researchPrompt = `You are an expert professional intelligence researcher. Conduct a thorough investigation of this professional and provide comprehensive intelligence.

TARGET PROFILE:
Name: ${speaker.name}
Current Organization: ${speaker.org || "Not specified"}
Current Title: ${speaker.title || "Not specified"}
Speaking Topic: ${speaker.speech_title || "Not specified"}

SEARCH RESULTS TO ANALYZE:
${searchResults.map((result: any, index: number) => 
  `${index + 1}. ${result.title} - ${result.snippet} - ${result.link}`
).join('\n')}

CONDUCT COMPREHENSIVE RESEARCH AND PROVIDE:

{
  "name": "${speaker.name}",
  "org": "${speaker.org || ''}",
  "title": "${speaker.title || ''}",
  "speech_title": "${speaker.speech_title || ''}",
  "session": "${speaker.session || ''}",
  "bio": "Detailed professional biography (3-4 sentences covering career highlights, expertise, and achievements)",
  "location": "Current city, Country",
  "education": [
    "Degree, Institution (Year)",
    "Additional education or certifications"
  ],
  "publications": [
    "Recent publications, articles, or thought leadership pieces",
    "Books, papers, or notable content"
  ],
  "career_history": [
    "Current Role, Company (Year-present)",
    "Previous Role, Company (Year-Year)",
    "Earlier career progression"
  ],
  "social_links": {
    "linkedin": "LinkedIn profile URL if found",
    "twitter": "Twitter handle if found",
    "website": "Personal or company website if found"
  },
  "expertise_areas": [
    "Primary area of expertise",
    "Secondary expertise areas",
    "Industry specializations"
  ],
  "speaking_history": [
    "Recent speaking engagements",
    "Notable presentations or keynotes",
    "Conference appearances"
  ],
  "achievements": [
    "Professional achievements and awards",
    "Notable accomplishments",
    "Industry recognition"
  ],
  "industry_connections": [
    "Professional associations",
    "Board memberships",
    "Industry networks"
  ],
  "recent_news": [
    "Recent media mentions",
    "Industry news and updates",
    "Thought leadership appearances"
  ],
  "confidence": 0.8
}

RESEARCH GUIDELINES:
- Conduct deep professional research using all available sources
- Extract specific details: exact job titles, company names, dates, locations
- Find recent publications, speaking engagements, and media mentions
- Identify professional achievements, awards, and recognition
- Map industry connections and professional networks
- Include recent news mentions and thought leadership
- Be thorough but accurate - only include verifiable information
- Use specific dates, institutions, and company names
- Confidence score should reflect data quality and completeness
- If information is unavailable, use null or empty arrays
- Focus on professional, verifiable information only

Return ONLY the JSON object, no additional text or explanations.`;

    const result = await model.generateContent(researchPrompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean and parse the response
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const jsonStart = cleanText.indexOf('{');
    const jsonEnd = cleanText.lastIndexOf('}') + 1;
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleanText = cleanText.substring(jsonStart, jsonEnd);
    }
    
    const enrichedProfile = JSON.parse(cleanText);
    
    // Merge with original speaker data, preserving original values
    return {
      ...speaker,
      ...enrichedProfile,
      confidence: enrichedProfile.confidence || 0.7
    };
    
  } catch (error) {
    console.error('Error enhancing speaker profile:', error);
    // Failed to research speaker, returning basic profile with low confidence
    return {
      ...speaker,
      confidence: 0.3
    };
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<SpeakerEnhancementResponse>> {
  try {
    const requestData: SpeakerEnhancementRequest = await req.json();
    const { speaker } = requestData;

    if (!speaker || !speaker.name) {
      return NextResponse.json({
        enhanced: speaker as EnhancedSpeakerData,
        success: false,
        error: "Speaker name is required"
      }, { status: 400 });
    }

    // Enhance the speaker profile
    const enhanced = await enhanceSpeakerProfile(speaker);

    return NextResponse.json({
      enhanced,
      success: true
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
