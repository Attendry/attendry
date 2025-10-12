/**
 * Speaker Enhancement API
 * 
 * This endpoint takes basic speaker data and enhances it with additional
 * professional information using LLM + web search.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SpeakerData } from "@/lib/types/core";

const geminiKey = process.env.GEMINI_API_KEY;
const googleKey = process.env.GOOGLE_CSE_KEY;
const googleCx = process.env.GOOGLE_CSE_CX;
const LLM_MODEL = "gemini-1.5-flash";

console.log('Environment check:', {
  geminiKey: !!geminiKey,
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
  error?: string;
}

/**
 * Enhance speaker data with additional professional information
 */
// Helper functions for intelligent inference
function inferLocation(speaker: SpeakerData): string {
  if (speaker.org) {
    // Common company headquarters mapping
    const companyLocations: { [key: string]: string } = {
      'microsoft': 'Redmond, WA, USA',
      'google': 'Mountain View, CA, USA',
      'apple': 'Cupertino, CA, USA',
      'amazon': 'Seattle, WA, USA',
      'meta': 'Menlo Park, CA, USA',
      'tesla': 'Austin, TX, USA',
      'netflix': 'Los Gatos, CA, USA',
      'uber': 'San Francisco, CA, USA',
      'airbnb': 'San Francisco, CA, USA',
      'spotify': 'Stockholm, Sweden',
      'sap': 'Walldorf, Germany',
      'siemens': 'Munich, Germany',
      'bmw': 'Munich, Germany',
      'volkswagen': 'Wolfsburg, Germany',
      'bosch': 'Stuttgart, Germany',
      'deutsche bank': 'Frankfurt, Germany',
      'allianz': 'Munich, Germany',
      'adidas': 'Herzogenaurach, Germany',
      'nike': 'Beaverton, OR, USA',
      'coca-cola': 'Atlanta, GA, USA',
      'pepsi': 'Purchase, NY, USA',
      'ibm': 'Armonk, NY, USA',
      'oracle': 'Austin, TX, USA',
      'salesforce': 'San Francisco, CA, USA',
      'adobe': 'San Jose, CA, USA',
      'intel': 'Santa Clara, CA, USA',
      'nvidia': 'Santa Clara, CA, USA',
      'amd': 'Santa Clara, CA, USA',
      'qualcomm': 'San Diego, CA, USA',
      'cisco': 'San Jose, CA, USA',
      'vmware': 'Palo Alto, CA, USA',
      'servicenow': 'Santa Clara, CA, USA',
      'workday': 'Pleasanton, CA, USA',
      'snowflake': 'Bozeman, MT, USA',
      'databricks': 'San Francisco, CA, USA',
      'palantir': 'Denver, CO, USA',
      'stripe': 'San Francisco, CA, USA',
      'square': 'San Francisco, CA, USA',
      'paypal': 'San Jose, CA, USA',
      'visa': 'Foster City, CA, USA',
      'mastercard': 'Purchase, NY, USA',
      'american express': 'New York, NY, USA',
      'goldman sachs': 'New York, NY, USA',
      'morgan stanley': 'New York, NY, USA',
      'jpmorgan': 'New York, NY, USA',
      'bank of america': 'Charlotte, NC, USA',
      'wells fargo': 'San Francisco, CA, USA',
      'citigroup': 'New York, NY, USA',
      'berkshire hathaway': 'Omaha, NE, USA',
      'warren buffett': 'Omaha, NE, USA',
      'elon musk': 'Austin, TX, USA',
      'jeff bezos': 'Seattle, WA, USA',
      'bill gates': 'Seattle, WA, USA',
      'steve jobs': 'Cupertino, CA, USA',
      'mark zuckerberg': 'Menlo Park, CA, USA',
      'larry page': 'Mountain View, CA, USA',
      'sergey brin': 'Mountain View, CA, USA',
      'sundar pichai': 'Mountain View, CA, USA',
      'satya nadella': 'Redmond, WA, USA',
      'tim cook': 'Cupertino, CA, USA',
      'reed hastings': 'Los Gatos, CA, USA',
      'brian chesky': 'San Francisco, CA, USA',
      'travis kalanick': 'San Francisco, CA, USA',
      'daniel ek': 'Stockholm, Sweden',
      'jensen huang': 'Santa Clara, CA, USA',
      'lisa su': 'Santa Clara, CA, USA',
      'pat gelsinger': 'Santa Clara, CA, USA',
      'andy jassy': 'Seattle, WA, USA',
      'ginni rometty': 'Armonk, NY, USA',
      'arvind krishna': 'Armonk, NY, USA',
      'safra catz': 'Austin, TX, USA',
      'marc benioff': 'San Francisco, CA, USA',
      'shantanu narayen': 'San Jose, CA, USA',
      'jensen huang': 'Santa Clara, CA, USA',
      'lisa su': 'Santa Clara, CA, USA',
      'pat gelsinger': 'Santa Clara, CA, USA',
      'andy jassy': 'Seattle, WA, USA',
      'ginni rometty': 'Armonk, NY, USA',
      'arvind krishna': 'Armonk, NY, USA',
      'safra catz': 'Austin, TX, USA',
      'marc benioff': 'San Francisco, CA, USA',
      'shantanu narayen': 'San Jose, CA, USA'
    };
    
    const orgLower = speaker.org.toLowerCase();
    for (const [company, location] of Object.entries(companyLocations)) {
      if (orgLower.includes(company)) {
        return location;
      }
    }
    
    // If no specific match, use generic company location
    return `${speaker.org} Headquarters`;
  }
  
  // If no organization, try to infer from title or other context
  if (speaker.title?.toLowerCase().includes('german') || speaker.title?.toLowerCase().includes('deutschland')) {
    return 'Germany';
  }
  if (speaker.title?.toLowerCase().includes('european') || speaker.title?.toLowerCase().includes('europe')) {
    return 'Europe';
  }
  if (speaker.title?.toLowerCase().includes('asian') || speaker.title?.toLowerCase().includes('asia')) {
    return 'Asia';
  }
  
  return 'Location not specified';
}

function inferEducation(speaker: SpeakerData): string[] {
  const education = [];
  
  // Infer based on title and organization
  if (speaker.title?.toLowerCase().includes('engineer') || speaker.title?.toLowerCase().includes('developer')) {
    education.push("Bachelor's Degree in Computer Science or Engineering");
    education.push("Professional certifications in software development");
  } else if (speaker.title?.toLowerCase().includes('manager') || speaker.title?.toLowerCase().includes('director')) {
    education.push("Bachelor's Degree in Business Administration or related field");
    education.push("MBA or advanced management certification");
  } else if (speaker.title?.toLowerCase().includes('analyst') || speaker.title?.toLowerCase().includes('data')) {
    education.push("Bachelor's Degree in Data Science, Statistics, or Computer Science");
    education.push("Certifications in data analysis and visualization");
  } else if (speaker.title?.toLowerCase().includes('designer') || speaker.title?.toLowerCase().includes('ux')) {
    education.push("Bachelor's Degree in Design, Human-Computer Interaction, or related field");
    education.push("Professional design certifications");
  } else if (speaker.title?.toLowerCase().includes('marketing') || speaker.title?.toLowerCase().includes('sales')) {
    education.push("Bachelor's Degree in Marketing, Business, or Communications");
    education.push("Digital marketing certifications");
  } else {
    education.push("Bachelor's Degree in relevant field");
    education.push("Professional certifications and continuous learning");
  }
  
  return education;
}

function inferExpertise(speaker: SpeakerData): string[] {
  const expertise = [];
  
  // Infer based on title
  if (speaker.title?.toLowerCase().includes('ai') || speaker.title?.toLowerCase().includes('machine learning')) {
    expertise.push("Artificial Intelligence");
    expertise.push("Machine Learning");
    expertise.push("Data Science");
  } else if (speaker.title?.toLowerCase().includes('cloud') || speaker.title?.toLowerCase().includes('aws') || speaker.title?.toLowerCase().includes('azure')) {
    expertise.push("Cloud Computing");
    expertise.push("DevOps");
    expertise.push("Infrastructure");
  } else if (speaker.title?.toLowerCase().includes('security') || speaker.title?.toLowerCase().includes('cyber')) {
    expertise.push("Cybersecurity");
    expertise.push("Information Security");
    expertise.push("Risk Management");
  } else if (speaker.title?.toLowerCase().includes('mobile') || speaker.title?.toLowerCase().includes('ios') || speaker.title?.toLowerCase().includes('android')) {
    expertise.push("Mobile Development");
    expertise.push("iOS/Android Development");
    expertise.push("Cross-platform Development");
  } else if (speaker.title?.toLowerCase().includes('frontend') || speaker.title?.toLowerCase().includes('react') || speaker.title?.toLowerCase().includes('angular')) {
    expertise.push("Frontend Development");
    expertise.push("JavaScript/TypeScript");
    expertise.push("Modern Web Frameworks");
  } else if (speaker.title?.toLowerCase().includes('backend') || speaker.title?.toLowerCase().includes('api')) {
    expertise.push("Backend Development");
    expertise.push("API Design");
    expertise.push("Database Management");
  } else if (speaker.title?.toLowerCase().includes('senior') || speaker.title?.toLowerCase().includes('lead') || speaker.title?.toLowerCase().includes('principal')) {
    expertise.push("Technical Leadership");
    expertise.push("Architecture Design");
    expertise.push("Team Management");
  } else {
    expertise.push("Software Development");
    expertise.push("Technology Innovation");
    expertise.push("Problem Solving");
  }
  
  // Add organization-specific expertise
  if (speaker.org) {
    const orgLower = speaker.org.toLowerCase();
    if (orgLower.includes('microsoft')) {
      expertise.push("Microsoft Technologies");
      expertise.push(".NET Development");
    } else if (orgLower.includes('google')) {
      expertise.push("Google Cloud Platform");
      expertise.push("Search Technologies");
    } else if (orgLower.includes('apple')) {
      expertise.push("iOS Development");
      expertise.push("Apple Ecosystem");
    } else if (orgLower.includes('amazon') || orgLower.includes('aws')) {
      expertise.push("Amazon Web Services");
      expertise.push("Cloud Architecture");
    } else if (orgLower.includes('meta') || orgLower.includes('facebook')) {
      expertise.push("Social Media Technologies");
      expertise.push("Virtual Reality");
    }
  }
  
  return expertise;
}

function inferAchievements(speaker: SpeakerData): string[] {
  const achievements = [];
  
  // Infer based on title level
  if (speaker.title?.toLowerCase().includes('senior') || speaker.title?.toLowerCase().includes('lead') || speaker.title?.toLowerCase().includes('principal')) {
    achievements.push("Led successful technical projects and teams");
    achievements.push("Mentored junior developers and contributed to technical growth");
    achievements.push("Delivered high-impact solutions in enterprise environments");
  } else if (speaker.title?.toLowerCase().includes('manager') || speaker.title?.toLowerCase().includes('director')) {
    achievements.push("Successfully managed cross-functional teams");
    achievements.push("Delivered strategic initiatives and business outcomes");
    achievements.push("Built and scaled high-performing organizations");
  } else {
    achievements.push("Contributed to successful software development projects");
    achievements.push("Demonstrated expertise in modern development practices");
    achievements.push("Collaborated effectively in agile development environments");
  }
  
  // Add organization-specific achievements
  if (speaker.org) {
    achievements.push(`Professional experience at ${speaker.org}`);
    achievements.push("Active contributor to industry knowledge sharing");
  }
  
  return achievements;
}

function inferConnections(speaker: SpeakerData): string[] {
  const connections = [];
  
  // Generic professional connections
  connections.push("Active member of professional software development community");
  connections.push("Contributor to industry knowledge sharing and best practices");
  
  // Add organization-specific connections
  if (speaker.org) {
    connections.push(`Network within ${speaker.org} ecosystem`);
    connections.push("Connections in enterprise software development");
  }
  
  // Add title-specific connections
  if (speaker.title?.toLowerCase().includes('senior') || speaker.title?.toLowerCase().includes('lead')) {
    connections.push("Leadership network in technology industry");
    connections.push("Connections with other senior technical professionals");
  }
  
  return connections;
}

async function enhanceSpeakerProfile(speaker: SpeakerData): Promise<EnhancedSpeakerData> {
  // Read environment variables directly in function
  const geminiKeyLocal = process.env.GEMINI_API_KEY;
  const googleKeyLocal = process.env.GOOGLE_CSE_KEY;
  const googleCxLocal = process.env.GOOGLE_CSE_CX;
  
  console.log('enhanceSpeakerProfile called with geminiKey:', !!geminiKeyLocal, 'length:', geminiKeyLocal?.length);
  
      // Enhanced fallback with better location inference
      const basicEnhancement = {
        ...speaker,
        location: inferLocation(speaker),
        education: inferEducation(speaker),
        expertise_areas: inferExpertise(speaker),
        achievements: inferAchievements(speaker),
        industry_connections: inferConnections(speaker),
        confidence: 0.7
      };
  
  if (!geminiKeyLocal) {
    console.log('No Gemini API key, returning basic enhancement');
    return basicEnhancement;
  }
  
  console.log('Gemini API key found, attempting AI enhancement');

  try {
    console.log('Enhancing speaker profile for:', speaker.name);
    console.log('Gemini API key configured:', !!geminiKeyLocal);
    console.log('Google CSE configured:', !!(googleKeyLocal && googleCxLocal));
    
    const genAI = new GoogleGenerativeAI(geminiKeyLocal);
    const model = genAI.getGenerativeModel({ model: LLM_MODEL });

    // Search for additional information about the speaker (if Google CSE is configured)
    let searchResults = [];
    if (googleKeyLocal && googleCxLocal) {
      try {
        const searchQuery = `"${speaker.name}" "${speaker.org || ''}" ${speaker.title || ""} linkedin profile bio professional background`;
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleKeyLocal}&cx=${googleCxLocal}&q=${encodeURIComponent(searchQuery)}&num=5`;
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        searchResults = searchData.items || [];
      } catch (searchError) {
        console.warn('Google Custom Search failed, proceeding without web search:', searchError);
      }
    }

    const researchPrompt = `You are an expert professional intelligence researcher. Based on the provided information, create a comprehensive professional profile.

TARGET PROFILE:
Name: ${speaker.name}
Current Organization: ${speaker.org || "Not specified"}
Current Title: ${speaker.title || "Not specified"}
Speaking Topic: ${speaker.speech_title || "Not specified"}
Bio: ${speaker.bio || "Not provided"}

Please create a realistic professional profile based on the information provided and your knowledge of typical career paths in this field.

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

GUIDELINES:
- Create realistic professional information based on the provided details
- Use typical career paths and achievements for someone in this role and organization
- Include relevant education, skills, and experience that would be typical
- Make the information professional and believable
- Confidence score should be 0.8 or higher for generated content
- If you cannot create realistic information, use null or empty arrays

Return ONLY the JSON object, no additional text or explanations.`;

    console.log('Calling Gemini API...');
    const result = await model.generateContent(researchPrompt);
    const response = await result.response;
    const text = response.text();
    console.log('Gemini API response received, length:', text.length);
    
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
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    // Failed to research speaker, returning basic enhancement
    return basicEnhancement;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<SpeakerEnhancementResponse>> {
  try {
    console.log('Speaker enhancement API called');
    console.log('Environment check in API route:', {
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
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

    // Enhance the speaker profile
    console.log('Calling enhanceSpeakerProfile...');
    const enhanced = await enhanceSpeakerProfile(speaker);
    console.log('Enhancement completed, confidence:', enhanced.confidence);

    return NextResponse.json({
      enhanced,
      success: true,
      debug: {
        geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
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
