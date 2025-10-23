/**
 * Gemini Prompt Management System
 * 
 * Centralized prompt templates for different AI tasks across the application.
 * This allows for consistent prompting, easy updates, and better token management.
 */

export interface PromptConfig {
  maxTokens: number;
  temperature: number;
  systemInstruction?: string;
  examples?: string[];
  constraints?: string[];
}

export interface SpeakerExtractionPrompt {
  content: string;
  config: PromptConfig;
}

export interface EventPrioritizationPrompt {
  content: string;
  config: PromptConfig;
}

export interface EventMetadataPrompt {
  content: string;
  config: PromptConfig;
}

// Base configurations for different task types
const BASE_CONFIGS = {
  SPEAKER_EXTRACTION: {
    maxTokens: 1024, // Increased with system instructions
    temperature: 0.1,
    systemInstruction: `You are a professional event analyst specializing in extracting speaker information from German and English event content. You identify speakers by their roles (Referent, Speaker, Moderator, etc.) and extract their professional details accurately.`
  },
  EVENT_PRIORITIZATION: {
    maxTokens: 512, // Increased with system instructions
    temperature: 0.1,
    systemInstruction: `You are a business event curator who evaluates event URLs for relevance to business professionals. You focus on conferences, workshops, and professional networking events that provide value to industry experts.`
  },
  EVENT_METADATA: {
    maxTokens: 512, // Increased with system instructions
    temperature: 0.1,
    systemInstruction: `You are an event information specialist who extracts structured metadata from event content. You identify key details like dates, locations, organizers, and registration information with high accuracy.`
  }
} as const;

// German and English terms for speaker identification
const SPEAKER_TERMS = {
  german: [
    "Referent", "Referentin", "Sprecher", "Sprecherin", "Moderator", "Moderatorin",
    "Vortragender", "Vortragende", "Präsentator", "Präsentatorin", "Keynote",
    "Workshop-Leiter", "Workshop-Leiterin", "Panelist", "Panelistin"
  ],
  english: [
    "Speaker", "Presenter", "Moderator", "Keynote", "Panelist", "Facilitator",
    "Instructor", "Trainer", "Expert", "Specialist", "Guest", "Host"
  ],
  titles: [
    "Prof.", "Prof. Dr.", "Dr.", "Mag.", "MBA", "LL.M.", "MSc", "BSc",
    "Director", "Manager", "Head of", "Chief", "VP", "Senior", "Lead",
    "CEO", "CTO", "CFO", "COO", "Founder", "Co-Founder"
  ]
};

// Industry-specific terms to look for
const INDUSTRY_CONTEXT = {
  legal: ["Recht", "Legal", "Compliance", "Regulatory", "GDPR", "Datenschutz"],
  tech: ["Technology", "Digital", "Innovation", "AI", "Machine Learning", "Blockchain"],
  business: ["Business", "Management", "Strategy", "Leadership", "Entrepreneurship"],
  finance: ["Finance", "Banking", "Fintech", "Investment", "Trading", "Risk Management"]
};

/**
 * Generate speaker extraction prompt optimized for token usage
 */
export function createSpeakerExtractionPrompt(
  content: string,
  maxSpeakers: number = 15,
  industryContext?: string
): SpeakerExtractionPrompt {
  // Conservative content limit to prevent token overflow
  const sanitizedContent = sanitizePromptContent(content, 2000); // Conservative limit
  
  const prompt = `Extract speakers from this event content:

${sanitizedContent}

Return JSON: {"speakers": [{"name": "Full Name", "title": "Job Title", "company": "Company Name"}]}

Look for: ${SPEAKER_TERMS.german.slice(0, 5).join(", ")} or ${SPEAKER_TERMS.english.slice(0, 5).join(", ")}
Focus on: business professionals, industry experts, keynote speakers, panelists
Max ${maxSpeakers} speakers.`;

  return {
    content: prompt,
    config: {
      ...BASE_CONFIGS.SPEAKER_EXTRACTION,
      maxTokens: 2048 // Back to reasonable limit
    }
  };
}

/**
 * Generate event prioritization prompt with user-specific terms
 */
export function createEventPrioritizationPrompt(
  urls: string[],
  industryContext: string = "general",
  locationContext: string = "Europe",
  userIndustryTerms: string[] = [],
  userIcpTerms: string[] = [],
  timeframeContext?: string
): EventPrioritizationPrompt {
  // Very conservative URL limit to prevent token overflow
  const limitedUrls = urls.slice(0, 3); // Reduced from 5 to 3
  
  // Build minimal user-specific context to reduce tokens
  const userContext = [];
  if (userIndustryTerms.length > 0) {
    userContext.push(`Industry: ${userIndustryTerms.slice(0, 3).join(", ")}`); // Reduced from 5 to 3
  }
  if (userIcpTerms.length > 0) {
    userContext.push(`Audience: ${userIcpTerms.slice(0, 3).join(", ")}`); // Reduced from 5 to 3
  }
  if (timeframeContext) {
    userContext.push(`Time: ${timeframeContext}`);
  }
  
  const userContextText = userContext.length > 0 ? `\nContext: ${userContext.join("; ")}` : "";
  
  // Optimized prompt with minimal text to reduce token usage
  const prompt = `Rate these URLs for business relevance:

${limitedUrls.join('\n')}

Return JSON: [{"url": "https://...", "score": 0.9, "reason": "brief reason"}]

Focus: conferences, workshops, professional events, business networking
Location: ${locationContext}${userContextText}

Prioritize events matching user's industry and audience.`;

  return {
    content: prompt,
    config: {
      ...BASE_CONFIGS.EVENT_PRIORITIZATION,
      maxTokens: 512 // Reduced from 1024 to 512 to prevent token overflow
    }
  };
}

/**
 * Generate event metadata extraction prompt
 */
export function createEventMetadataPrompt(
  content: string,
  eventTitle?: string,
  eventDate?: string,
  country?: string
): EventMetadataPrompt {
  const prompt = `Extract business event metadata from this content:

${content}

Return JSON:
{
  "title": "Event title",
  "description": "Event description", 
  "date": "Event date",
  "location": "Event location/city",
  "organizer": "Event organizer name",
  "website": "Event website URL",
  "registrationUrl": "Registration URL if found"
}

${eventTitle ? `Known title: ${eventTitle}` : ""}
${eventDate ? `Known date: ${eventDate}` : ""}
${country ? `Known country: ${country}` : ""}

Focus on: business events, professional conferences, workshops, industry events
Extract accurate, factual information. Use "Unknown" for missing info.`;

  return {
    content: prompt,
    config: BASE_CONFIGS.EVENT_METADATA
  };
}

/**
 * Generate speaker enhancement prompt for detailed speaker profiles with user-specific terms
 */
export function createSpeakerEnhancementPrompt(
  speakerData: any[],
  industryContext?: string,
  userIndustryTerms: string[] = [],
  userIcpTerms: string[] = []
): SpeakerExtractionPrompt {
  const industryTerms = industryContext ? INDUSTRY_CONTEXT[industryContext as keyof typeof INDUSTRY_CONTEXT] || [] : [];
  
  // Build user-specific context
  const userContext = [];
  if (userIndustryTerms.length > 0) {
    userContext.push(`User industry focus: ${userIndustryTerms.slice(0, 5).join(", ")}`);
  }
  if (userIcpTerms.length > 0) {
    userContext.push(`User target audience: ${userIcpTerms.slice(0, 5).join(", ")}`);
  }
  
  const userContextText = userContext.length > 0 ? `\n\nUser-specific context:\n${userContext.join("\n")}` : "";
  
  const prompt = `Enhance these business speaker profiles with additional information:

${JSON.stringify(speakerData, null, 2)}

Return enhanced JSON with same structure, adding:
- More detailed professional bios
- Business and industry expertise areas
- Professional speaking history
- Education and certification background
- Notable business achievements
- Industry connections and networks
- Recent professional news mentions

${industryTerms.length > 0 ? `Industry focus: ${industryTerms.join(", ")}` : ""}${userContextText}

Focus on: business professionals, industry experts, keynote speakers, panelists
Prioritize speakers that match the user's industry focus and target audience.
Keep original data, only enhance with additional professional information.`;

  return {
    content: prompt,
    config: {
      ...BASE_CONFIGS.SPEAKER_EXTRACTION,
      maxTokens: 768 // More tokens for enhancement
    }
  };
}

/**
 * Generate content filtering prompt to identify relevant sections
 */
export function createContentFilterPrompt(
  content: string,
  targetType: 'speakers' | 'agenda' | 'sponsors' | 'general'
): SpeakerExtractionPrompt {
  const targetTerms = {
    speakers: [...SPEAKER_TERMS.german, ...SPEAKER_TERMS.english],
    agenda: ["agenda", "program", "schedule", "timetable", "programm", "zeitplan"],
    sponsors: ["sponsor", "partner", "unterstützer", "förderer"],
    general: ["event", "conference", "summit", "workshop", "veranstaltung", "kongress"]
  };

  const prompt = `Identify sections relevant to ${targetType} in this business event content:

${content}

Look for: ${targetTerms[targetType].join(", ")}

Return JSON:
{
  "relevant_sections": [
    {
      "section": "section text",
      "relevance_score": 0.8,
      "reason": "why relevant"
    }
  ]
}

Focus on: business events, professional conferences, industry events, business speakers
Extract only the most relevant sections for business professionals.`;

  return {
    content: prompt,
    config: {
      maxTokens: 512,
      temperature: 0.1,
      systemInstruction: "You are an expert at identifying relevant content sections."
    }
  };
}

/**
 * Utility function to get optimal prompt based on content length
 */
export function getOptimalPromptConfig(contentLength: number, taskType: keyof typeof BASE_CONFIGS): PromptConfig {
  const baseConfig = BASE_CONFIGS[taskType];
  
  // Adjust tokens based on content length
  let maxTokens: number = baseConfig.maxTokens;
  if (contentLength > 10000) {
    maxTokens = 256; // Shorter responses for long content
  } else if (contentLength < 1000) {
    maxTokens = 512; // More detailed responses for short content
  }
  
  return {
    ...baseConfig,
    maxTokens
  };
}

/**
 * Validate and clean prompt content to prevent token limit issues
 */
export function sanitizePromptContent(content: string, maxLength: number = 8000): string {
  if (content.length <= maxLength) {
    return content;
  }
  
  // Truncate and add ellipsis
  return content.substring(0, maxLength - 100) + "\n\n[Content truncated for token limits]";
}

/**
 * Get fallback prompt for when primary prompt fails
 */
export function getFallbackPrompt(taskType: keyof typeof BASE_CONFIGS): string {
  const fallbacks = {
    SPEAKER_EXTRACTION: "Extract speaker names and basic info from the content. Return JSON with speakers array.",
    EVENT_PRIORITIZATION: "Rate these URLs 1-10 for business relevance. Return JSON with scores.",
    EVENT_METADATA: "Extract basic event info: title, date, location. Return JSON."
  };
  
  return fallbacks[taskType];
}
