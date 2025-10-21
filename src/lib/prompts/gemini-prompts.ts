/**
 * Gemini Prompt Management System
 * 
 * Centralized prompt templates for different AI tasks across the application.
 * This allows for consistent prompting, easy updates, and better token management.
 */

export interface PromptConfig {
  maxTokens: number;
  temperature: number;
  systemContext?: string;
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
    maxTokens: 512,
    temperature: 0.1,
    systemContext: "You are an expert at extracting speaker information from event content in German and English."
  },
  EVENT_PRIORITIZATION: {
    maxTokens: 256,
    temperature: 0.1,
    systemContext: "You are an expert at rating event relevance for business professionals."
  },
  EVENT_METADATA: {
    maxTokens: 256,
    temperature: 0.1,
    systemContext: "You are an expert at extracting event metadata from web content."
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
  // Sanitize content to prevent token overflow - much more aggressive
  const sanitizedContent = sanitizePromptContent(content, 1000); // Reduced from 3000 to 1000
  
  const prompt = `Extract speakers:

${sanitizedContent}

Return JSON: {"speakers": [{"name": "Name", "title": "Title", "company": "Company"}]}
Max ${maxSpeakers} speakers.`;

  return {
    content: prompt,
    config: {
      ...BASE_CONFIGS.SPEAKER_EXTRACTION,
      maxTokens: 128 // Reduced from 256 to 128
    }
  };
}

/**
 * Generate event prioritization prompt
 */
export function createEventPrioritizationPrompt(
  urls: string[],
  industryContext: string = "general",
  locationContext: string = "Europe"
): EventPrioritizationPrompt {
  // Limit URLs to prevent token overflow - much more aggressive
  const limitedUrls = urls.slice(0, 5); // Reduced from 8 to 5
  
  const prompt = `Rate URLs for events:
${limitedUrls.join('\n')}

Return JSON: [{"url": "https://...", "score": 0.9, "reason": "brief"}]`;

  return {
    content: prompt,
    config: {
      ...BASE_CONFIGS.EVENT_PRIORITIZATION,
      maxTokens: 64 // Reduced from 128 to 64
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
  const prompt = `Extract event metadata from this content:

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

Focus on extracting accurate, factual information. Use "Unknown" for missing info.`;

  return {
    content: prompt,
    config: BASE_CONFIGS.EVENT_METADATA
  };
}

/**
 * Generate speaker enhancement prompt for detailed speaker profiles
 */
export function createSpeakerEnhancementPrompt(
  speakerData: any[],
  industryContext?: string
): SpeakerExtractionPrompt {
  const industryTerms = industryContext ? INDUSTRY_CONTEXT[industryContext as keyof typeof INDUSTRY_CONTEXT] || [] : [];
  
  const prompt = `Enhance these speaker profiles with additional information:

${JSON.stringify(speakerData, null, 2)}

Return enhanced JSON with same structure, adding:
- More detailed bios where possible
- Additional expertise areas
- Speaking history
- Education background
- Notable achievements
- Industry connections
- Recent news mentions

${industryTerms.length > 0 ? `Industry focus: ${industryTerms.join(", ")}` : ""}

Keep original data, only enhance with additional information.`;

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

  const prompt = `Identify sections relevant to ${targetType} in this content:

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

Extract only the most relevant sections.`;

  return {
    content: prompt,
    config: {
      maxTokens: 256,
      temperature: 0.1,
      systemContext: "You are an expert at identifying relevant content sections."
    }
  };
}

/**
 * Utility function to get optimal prompt based on content length
 */
export function getOptimalPromptConfig(contentLength: number, taskType: keyof typeof BASE_CONFIGS): PromptConfig {
  const baseConfig = BASE_CONFIGS[taskType];
  
  // Adjust tokens based on content length
  let maxTokens = baseConfig.maxTokens;
  if (contentLength > 10000) {
    maxTokens = Math.min(maxTokens, 256) as 256; // Shorter responses for long content
  } else if (contentLength < 1000) {
    maxTokens = Math.min(maxTokens * 1.5, 768) as 512; // More detailed responses for short content
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
