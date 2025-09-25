import { RetryService } from "./retry-service";

/**
 * Gemini Service
 * 
 * Handles AI-powered filtering and processing using Google's Gemini API
 * with comprehensive retry logic and error handling.
 */

export interface GeminiFilterRequest {
  items: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
  dropTitleRegex: RegExp;
  banHosts: Set<string>;
  searchConfig?: any;
}

export interface GeminiFilterResponse {
  filteredItems: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
  decisions: Array<{
    index: number;
    isEvent: boolean;
    reason: string;
  }>;
  processingTime: number;
}

export interface GeminiExtractionRequest {
  content: string;
  prompt: string;
  context?: any;
}

export interface GeminiExtractionResponse {
  result: any;
  confidence: number;
  processingTime: number;
}

/**
 * Gemini Service Class
 */
export class GeminiService {
  private static readonly GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  private static readonly MAX_TOKENS = 8192;
  private static readonly TEMPERATURE = 0.1;

  /**
   * Filter search results using Gemini AI
   */
  static async filterWithGemini(request: GeminiFilterRequest): Promise<GeminiFilterResponse> {
    const startTime = Date.now();
    
    return RetryService.executeWithRetry(
      "gemini",
      "filter",
      async () => {
        const { items, dropTitleRegex, banHosts, searchConfig = {} } = request;
        
        if (!items || items.length === 0) {
          return {
            filteredItems: [],
            decisions: [],
            processingTime: Date.now() - startTime
          };
        }

        // Build the filtering prompt
        const prompt = this.buildFilteringPrompt(items, dropTitleRegex, banHosts, searchConfig);
        
        // Call Gemini API
        const response = await this.callGeminiAPI(prompt);
        
        // Parse the response
        const result = this.parseFilterResponse(response, items);
        
        return {
          ...result,
          processingTime: Date.now() - startTime
        };
      }
    ).then(result => result.data);
  }

  /**
   * Extract structured data using Gemini AI
   */
  static async extractWithGemini(request: GeminiExtractionRequest): Promise<GeminiExtractionResponse> {
    const startTime = Date.now();
    
    return RetryService.executeWithRetry(
      "gemini",
      "extract",
      async () => {
        const { content, prompt, context } = request;
        
        // Build the extraction prompt
        const fullPrompt = this.buildExtractionPrompt(content, prompt, context);
        
        // Call Gemini API
        const response = await this.callGeminiAPI(fullPrompt);
        
        // Parse the response
        const result = this.parseExtractionResponse(response);
        
        return {
          ...result,
          processingTime: Date.now() - startTime
        };
      }
    ).then(result => result.data);
  }

  /**
   * Call the Gemini API with proper error handling
   */
  private static async callGeminiAPI(prompt: string): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const response = await RetryService.fetchWithRetry(
      "gemini",
      "api_call",
      `${this.GEMINI_API_URL}?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: this.TEMPERATURE,
            maxOutputTokens: this.MAX_TOKENS,
            topP: 0.8,
            topK: 10
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response from Gemini API");
    }

    return data;
  }

  /**
   * Build filtering prompt for Gemini
   */
  private static buildFilteringPrompt(
    items: Array<{ title: string; link: string; snippet: string }>,
    dropTitleRegex: RegExp,
    banHosts: Set<string>,
    searchConfig: any
  ): string {
    const itemsJson = JSON.stringify(items, null, 2);
    const banHostsList = Array.from(banHosts).join(", ");
    
    return `You are an expert event discovery assistant. Your task is to filter search results to identify actual business events, conferences, and professional gatherings.

SEARCH CONTEXT:
- Looking for: ${searchConfig.industry || 'business'} events
- Target audience: ${searchConfig.icpTerms?.join(', ') || 'professionals'}
- Exclude: ${banHostsList}

FILTERING RULES:
1. Keep items that represent actual events (conferences, summits, workshops, seminars, webinars, trade shows)
2. Exclude items that are:
   - News articles about events (not the events themselves)
   - Job postings or career pages
   - General company pages
   - Blog posts or articles
   - Social media posts (Instagram, Facebook, Twitter, LinkedIn, YouTube, TikTok)
   - Social media content (reels, posts, stories, videos)
   - Pages from banned hosts: ${banHostsList}
   - Items with titles matching: ${dropTitleRegex.source}

SEARCH RESULTS TO FILTER:
${itemsJson}

Please analyze each item and return a JSON response with this exact structure:
{
  "decisions": [
    {
      "index": 0,
      "isEvent": true,
      "reason": "Clear conference with agenda and speakers"
    }
  ],
  "filteredItems": [
    {
      "title": "Event Title",
      "link": "https://example.com",
      "snippet": "Event description"
    }
  ]
}

Return only the JSON response, no additional text.`;
  }

  /**
   * Build extraction prompt for Gemini
   */
  private static buildExtractionPrompt(content: string, prompt: string, context?: any): string {
    const contextStr = context ? `\n\nCONTEXT: ${JSON.stringify(context, null, 2)}` : '';
    
    return `${prompt}

CONTENT TO ANALYZE:
${content}${contextStr}

Please provide a structured response in JSON format. Be precise and only extract information that is clearly present in the content.`;
  }

  /**
   * Parse Gemini filter response
   */
  private static parseFilterResponse(response: any, originalItems: Array<{ title: string; link: string; snippet: string }>): {
    filteredItems: Array<{ title: string; link: string; snippet: string }>;
    decisions: Array<{ index: number; isEvent: boolean; reason: string }>;
  } {
    try {
      const text = response.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error("No JSON found in Gemini response");
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the response structure
      if (!parsed.decisions || !Array.isArray(parsed.decisions)) {
        throw new Error("Invalid decisions array in Gemini response");
      }
      
      if (!parsed.filteredItems || !Array.isArray(parsed.filteredItems)) {
        throw new Error("Invalid filteredItems array in Gemini response");
      }
      
      return {
        filteredItems: parsed.filteredItems,
        decisions: parsed.decisions
      };
    } catch (error) {
      console.error("Error parsing Gemini filter response:", error);
      
      // Fallback: return all items with basic filtering
      const filteredItems = originalItems.filter((item, index) => {
        // Basic filtering logic as fallback
        const title = item.title.toLowerCase();
        const link = item.link.toLowerCase();
        
        // Check for obvious non-events
        if (title.includes('job') || title.includes('career') || title.includes('hiring')) {
          return false;
        }
        
        if (link.includes('linkedin.com') || link.includes('indeed.com')) {
          return false;
        }
        
        return true;
      });
      
      return {
        filteredItems,
        decisions: originalItems.map((_, index) => ({
          index,
          isEvent: filteredItems.includes(originalItems[index]),
          reason: "Fallback filtering due to parsing error"
        }))
      };
    }
  }

  /**
   * Parse Gemini extraction response
   */
  private static parseExtractionResponse(response: any): {
    result: any;
    confidence: number;
  } {
    try {
      const text = response.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        return {
          result: { text },
          confidence: 0.5
        };
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        result: parsed,
        confidence: 0.9
      };
    } catch (error) {
      console.error("Error parsing Gemini extraction response:", error);
      
      return {
        result: { error: "Failed to parse response", raw: response.candidates[0].content.parts[0].text },
        confidence: 0.1
      };
    }
  }

  /**
   * Get service health status
   */
  static async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    apiKeyConfigured: boolean;
    lastError?: string;
  }> {
    const apiKeyConfigured = !!process.env.GEMINI_API_KEY;
    
    if (!apiKeyConfigured) {
      return {
        status: 'unhealthy',
        apiKeyConfigured: false,
        lastError: 'GEMINI_API_KEY not configured'
      };
    }

    try {
      // Test API connectivity with a simple request
      await this.callGeminiAPI("Test connectivity. Respond with: OK");
      return {
        status: 'healthy',
        apiKeyConfigured: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        apiKeyConfigured: true,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
