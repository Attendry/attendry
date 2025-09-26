/**
 * Optimized Prompt Templates
 * 
 * Provides concise, efficient prompts for Gemini API calls to minimize
 * token usage while maintaining quality results.
 */

export interface PromptContext {
  industry?: string;
  country?: string;
  countryName?: string;
  searchConfig?: any;
  userProfile?: any;
}

export interface PromptTemplate {
  template: string;
  estimatedTokens: number;
  description: string;
}

/**
 * Optimized Prompt Templates
 */
export class PromptTemplates {
  private static readonly TEMPLATES = {
    // Speaker extraction - optimized for batch processing
    SPEAKER_EXTRACTION_BATCH: {
      template: `Extract speakers from events. Return JSON array:
[
  {
    "eventId": "id",
    "speakers": [
      {
        "name": "Name",
        "org": "Organization", 
        "title": "Job Title",
        "session_title": "Session",
        "confidence": 0.9
      }
    ]
  }
]

EVENTS:
{events}

Extract only clear speaker info. Empty array if none found.`,
      estimatedTokens: 200,
      description: "Batch speaker extraction with minimal prompt"
    },

    // URL prioritization - optimized for batch processing
    URL_PRIORITIZATION_BATCH: {
      template: `Prioritize URLs for events in {industry}, {country}. Score 0.9-1.0: direct event pages, 0.7-0.8: event aggregators, 0.5-0.6: company calendars, 0.0-0.4: news/jobs. Exclude: news, jobs, social media.

URLS:
{urls}

Return JSON:
{
  "prioritizedUrls": ["url1", "url2"],
  "reasons": [{"url": "url1", "score": 0.9, "reason": "Direct conference page"}]
}

Return top 15 most promising URLs.`,
      estimatedTokens: 150,
      description: "Batch URL prioritization with concise scoring"
    },

    // Event filtering - optimized for batch processing
    EVENT_FILTERING_BATCH: {
      template: `Filter events in {country}. Keep: conferences, workshops, seminars. Exclude: jobs, news, social. Return JSON:
{
  "decisions": [
    {"index": 0, "isEvent": true, "reason": "Conference with agenda"}
  ]
}

EVENTS:
{events}`,
      estimatedTokens: 100,
      description: "Batch event filtering with minimal criteria"
    },

    // Single event speaker extraction
    SPEAKER_EXTRACTION_SINGLE: {
      template: `Extract speakers from: {title}
Description: {description}
Return JSON: {"speakers": [{"name": "Name", "org": "Org", "title": "Title", "session_title": "Session", "confidence": 0.9}]}`,
      estimatedTokens: 50,
      description: "Single event speaker extraction"
    },

    // URL prioritization single
    URL_PRIORITIZATION_SINGLE: {
      template: `Score URL for events in {industry}, {country}: {url}
Title: {title}
Snippet: {snippet}
Return: {"score": 0.9, "reason": "Direct event page"}`,
      estimatedTokens: 30,
      description: "Single URL prioritization"
    },

    // Event filtering single
    EVENT_FILTERING_SINGLE: {
      template: `Is this an event in {country}? Title: {title}, Link: {link}
Return: {"isEvent": true, "reason": "Conference"}`,
      estimatedTokens: 25,
      description: "Single event filtering"
    }
  };

  /**
   * Get optimized prompt for speaker extraction batch
   */
  static getSpeakerExtractionBatchPrompt(
    events: Array<{
      id: string;
      title: string;
      description: string;
      starts_at?: string;
      location?: string;
      city?: string;
    }>
  ): string {
    const eventsData = events.map((event, index) => ({
      id: event.id,
      index,
      title: event.title,
      description: event.description?.substring(0, 300) || '', // Limit description
      date: event.starts_at,
      location: event.location || event.city
    }));

    return this.TEMPLATES.SPEAKER_EXTRACTION_BATCH.template
      .replace('{events}', JSON.stringify(eventsData, null, 2));
  }

  /**
   * Get optimized prompt for URL prioritization batch
   */
  static getUrlPrioritizationBatchPrompt(
    urls: Array<{
      title: string;
      link: string;
      snippet: string;
    }>,
    context: PromptContext
  ): string {
    const urlsData = urls.map((url, index) => ({
      index,
      title: url.title,
      link: url.link,
      snippet: url.snippet?.substring(0, 150) || '' // Limit snippet
    }));

    return this.TEMPLATES.URL_PRIORITIZATION_BATCH.template
      .replace('{industry}', context.industry || 'business')
      .replace('{country}', context.countryName || context.country || '')
      .replace('{urls}', JSON.stringify(urlsData, null, 2));
  }

  /**
   * Get optimized prompt for event filtering batch
   */
  static getEventFilteringBatchPrompt(
    events: Array<{
      title: string;
      link: string;
      snippet: string;
    }>,
    context: PromptContext
  ): string {
    const eventsData = events.map((event, index) => ({
      index,
      title: event.title,
      link: event.link,
      snippet: event.snippet?.substring(0, 100) || '' // Limit snippet
    }));

    return this.TEMPLATES.EVENT_FILTERING_BATCH.template
      .replace('{country}', context.countryName || context.country || '')
      .replace('{events}', JSON.stringify(eventsData, null, 2));
  }

  /**
   * Get optimized prompt for single speaker extraction
   */
  static getSpeakerExtractionSinglePrompt(
    title: string,
    description: string
  ): string {
    return this.TEMPLATES.SPEAKER_EXTRACTION_SINGLE.template
      .replace('{title}', title)
      .replace('{description}', description?.substring(0, 500) || '');
  }

  /**
   * Get optimized prompt for single URL prioritization
   */
  static getUrlPrioritizationSinglePrompt(
    url: string,
    title: string,
    snippet: string,
    context: PromptContext
  ): string {
    return this.TEMPLATES.URL_PRIORITIZATION_SINGLE.template
      .replace('{industry}', context.industry || 'business')
      .replace('{country}', context.countryName || context.country || '')
      .replace('{url}', url)
      .replace('{title}', title)
      .replace('{snippet}', snippet?.substring(0, 200) || '');
  }

  /**
   * Get optimized prompt for single event filtering
   */
  static getEventFilteringSinglePrompt(
    title: string,
    link: string,
    context: PromptContext
  ): string {
    return this.TEMPLATES.EVENT_FILTERING_SINGLE.template
      .replace('{country}', context.countryName || context.country || '')
      .replace('{title}', title)
      .replace('{link}', link);
  }

  /**
   * Get template information
   */
  static getTemplateInfo(templateName: keyof typeof PromptTemplates.TEMPLATES): PromptTemplate {
    return this.TEMPLATES[templateName];
  }

  /**
   * Get all template information
   */
  static getAllTemplateInfo(): Record<string, PromptTemplate> {
    return this.TEMPLATES;
  }

  /**
   * Estimate total tokens for a batch operation
   */
  static estimateBatchTokens(
    templateName: keyof typeof PromptTemplates.TEMPLATES,
    itemCount: number
  ): number {
    const template = this.TEMPLATES[templateName];
    const baseTokens = template.estimatedTokens;
    
    // Estimate additional tokens per item
    const tokensPerItem = templateName.includes('SPEAKER') ? 50 : 
                         templateName.includes('URL') ? 30 : 25;
    
    return baseTokens + (itemCount * tokensPerItem);
  }

  /**
   * Get the most efficient template for a given operation
   */
  static getMostEfficientTemplate(
    operation: 'speaker_extraction' | 'url_prioritization' | 'event_filtering',
    itemCount: number
  ): {
    templateName: string;
    estimatedTokens: number;
    recommendation: string;
  } {
    if (itemCount === 1) {
      // Single item - use single templates
      switch (operation) {
        case 'speaker_extraction':
          return {
            templateName: 'SPEAKER_EXTRACTION_SINGLE',
            estimatedTokens: this.TEMPLATES.SPEAKER_EXTRACTION_SINGLE.estimatedTokens,
            recommendation: 'Use single template for one item'
          };
        case 'url_prioritization':
          return {
            templateName: 'URL_PRIORITIZATION_SINGLE',
            estimatedTokens: this.TEMPLATES.URL_PRIORITIZATION_SINGLE.estimatedTokens,
            recommendation: 'Use single template for one item'
          };
        case 'event_filtering':
          return {
            templateName: 'EVENT_FILTERING_SINGLE',
            estimatedTokens: this.TEMPLATES.EVENT_FILTERING_SINGLE.estimatedTokens,
            recommendation: 'Use single template for one item'
          };
      }
    } else {
      // Multiple items - use batch templates
      switch (operation) {
        case 'speaker_extraction':
          return {
            templateName: 'SPEAKER_EXTRACTION_BATCH',
            estimatedTokens: this.estimateBatchTokens('SPEAKER_EXTRACTION_BATCH', itemCount),
            recommendation: `Use batch template for ${itemCount} items`
          };
        case 'url_prioritization':
          return {
            templateName: 'URL_PRIORITIZATION_BATCH',
            estimatedTokens: this.estimateBatchTokens('URL_PRIORITIZATION_BATCH', itemCount),
            recommendation: `Use batch template for ${itemCount} items`
          };
        case 'event_filtering':
          return {
            templateName: 'EVENT_FILTERING_BATCH',
            estimatedTokens: this.estimateBatchTokens('EVENT_FILTERING_BATCH', itemCount),
            recommendation: `Use batch template for ${itemCount} items`
          };
      }
    }
  }

  /**
   * Compress prompt by removing unnecessary whitespace and characters
   */
  static compressPrompt(prompt: string): string {
    return prompt
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .replace(/\s*([{}[\]])/g, '$1') // Remove spaces before brackets
      .replace(/([{}[\]})\s*/g, '$1') // Remove spaces after brackets
      .trim();
  }

  /**
   * Get context for prompts
   */
  static buildPromptContext(
    searchConfig?: any,
    userProfile?: any,
    country?: string
  ): PromptContext {
    const countryName = country === 'de' ? 'Germany' : 
                       country === 'us' ? 'United States' : 
                       country === 'uk' ? 'United Kingdom' : 
                       country === 'fr' ? 'France' : 
                       country;

    return {
      industry: searchConfig?.industry || 'business',
      country,
      countryName,
      searchConfig,
      userProfile
    };
  }
}
