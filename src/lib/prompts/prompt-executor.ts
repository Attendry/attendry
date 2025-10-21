/**
 * Prompt Executor
 * 
 * Handles execution of Gemini prompts with proper error handling,
 * fallbacks, and token management.
 */

import { 
  SpeakerExtractionPrompt, 
  EventPrioritizationPrompt, 
  EventMetadataPrompt,
  getFallbackPrompt,
  sanitizePromptContent,
  getOptimalPromptConfig
} from './gemini-prompts';

export interface PromptExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fallbackUsed?: boolean;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

export class PromptExecutor {
  private static instance: PromptExecutor;
  
  public static getInstance(): PromptExecutor {
    if (!PromptExecutor.instance) {
      PromptExecutor.instance = new PromptExecutor();
    }
    return PromptExecutor.instance;
  }

  /**
   * Execute speaker extraction prompt
   */
  async executeSpeakerExtraction(
    prompt: SpeakerExtractionPrompt,
    content: string
  ): Promise<PromptExecutionResult<{ speakers: any[] }>> {
    try {
      // Sanitize content to prevent token issues - more aggressive
      const sanitizedContent = sanitizePromptContent(content, 2000); // Reduced from 6000 to 2000
      
      // Import Gemini client
      const { generateContentWithRetry, parseJsonResponse } = await import('../gemini-api-client');
      
      // Execute with retry logic
      const response = await generateContentWithRetry({
        prompt: prompt.content.replace('${content}', sanitizedContent),
        maxOutputTokens: Math.min(prompt.config.maxTokens, 256), // Cap at 256 tokens
        temperature: prompt.config.temperature
      });
      
      // Parse response
      const data = parseJsonResponse(response.text);
      
      return {
        success: true,
        data,
        tokenUsage: {
          input: sanitizedContent.length,
          output: response.text.length,
          total: sanitizedContent.length + response.text.length
        }
      };
      
    } catch (error) {
      console.warn('Speaker extraction prompt failed, trying fallback:', error);
      
      // Try fallback with even more aggressive content reduction
      try {
        const { generateContentWithRetry, parseJsonResponse } = await import('../gemini-api-client');
        
        const fallbackPrompt = getFallbackPrompt('SPEAKER_EXTRACTION');
        const response = await generateContentWithRetry({
          prompt: `${fallbackPrompt}\n\nContent: ${sanitizePromptContent(content, 1000)}`, // Reduced to 1000
          maxOutputTokens: 128, // Reduced to 128
          temperature: 0.1
        });
        
        const data = parseJsonResponse(response.text);
        
        return {
          success: true,
          data,
          fallbackUsed: true,
          tokenUsage: {
            input: content.length,
            output: response.text.length,
            total: content.length + response.text.length
          }
        };
        
      } catch (fallbackError) {
        return {
          success: false,
          error: `Primary: ${error instanceof Error ? error.message : 'Unknown error'}, Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`,
          fallbackUsed: true
        };
      }
    }
  }

  /**
   * Execute event prioritization prompt
   */
  async executeEventPrioritization(
    prompt: EventPrioritizationPrompt
  ): Promise<PromptExecutionResult<Array<{ url: string; score: number; reason: string }>>> {
    try {
      // Further sanitize the prompt to prevent MAX_TOKENS
      const sanitizedPrompt = sanitizePromptContent(prompt.content, 2000);
      
      const { generateContentWithRetry, parseJsonResponse } = await import('../gemini-api-client');
      
      const response = await generateContentWithRetry({
        prompt: sanitizedPrompt,
        maxOutputTokens: Math.min(prompt.config.maxTokens, 128), // Cap at 128 tokens
        temperature: prompt.config.temperature
      });
      
      const data = parseJsonResponse(response.text);
      
      return {
        success: true,
        data,
        tokenUsage: {
          input: sanitizedPrompt.length,
          output: response.text.length,
          total: sanitizedPrompt.length + response.text.length
        }
      };
      
    } catch (error) {
      console.warn('Event prioritization prompt failed, using fallback scoring:', error);
      
      // Fallback: simple scoring based on URL patterns
      const urls = prompt.content.match(/https?:\/\/[^\s]+/g) || [];
      const fallbackData = urls.slice(0, 10).map((url, index) => ({
        url,
        score: Math.max(0.1, 1.0 - (index * 0.1)),
        reason: 'Fallback scoring due to AI failure'
      }));
      
      return {
        success: true,
        data: fallbackData,
        fallbackUsed: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute event metadata extraction prompt
   */
  async executeEventMetadata(
    prompt: EventMetadataPrompt
  ): Promise<PromptExecutionResult<{
    title: string;
    description: string;
    date: string;
    location: string;
    organizer: string;
    website: string;
    registrationUrl?: string;
  }>> {
    try {
      const { generateContentWithRetry, parseJsonResponse } = await import('../gemini-api-client');
      
      const response = await generateContentWithRetry({
        prompt: prompt.content,
        maxOutputTokens: prompt.config.maxTokens,
        temperature: prompt.config.temperature
      });
      
      const data = parseJsonResponse(response.text);
      
      return {
        success: true,
        data,
        tokenUsage: {
          input: prompt.content.length,
          output: response.text.length,
          total: prompt.content.length + response.text.length
        }
      };
      
    } catch (error) {
      console.warn('Event metadata extraction failed, using fallback:', error);
      
      // Fallback: extract basic info from content
      const content = prompt.content;
      const fallbackData = {
        title: this.extractTitleFromContent(content),
        description: this.extractDescriptionFromContent(content),
        date: 'Unknown Date',
        location: 'Unknown Location',
        organizer: 'Unknown Organizer',
        website: this.extractWebsiteFromContent(content)
      };
      
      return {
        success: true,
        data: fallbackData,
        fallbackUsed: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute any prompt with automatic error handling
   */
  async executePrompt<T = any>(
    prompt: string,
    config: { maxTokens: number; temperature: number },
    fallbackData?: T
  ): Promise<PromptExecutionResult<T>> {
    try {
      const { generateContentWithRetry, parseJsonResponse } = await import('../gemini-api-client');
      
      const response = await generateContentWithRetry({
        prompt,
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });
      
      const data = parseJsonResponse(response.text);
      
      return {
        success: true,
        data,
        tokenUsage: {
          input: prompt.length,
          output: response.text.length,
          total: prompt.length + response.text.length
        }
      };
      
    } catch (error) {
      if (fallbackData) {
        return {
          success: true,
          data: fallbackData,
          fallbackUsed: true,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Batch execute multiple prompts with rate limiting
   */
  async executeBatch<T = any>(
    prompts: Array<{ prompt: string; config: { maxTokens: number; temperature: number } }>,
    delayMs: number = 1000
  ): Promise<Array<PromptExecutionResult<T>>> {
    const results: Array<PromptExecutionResult<T>> = [];
    
    for (let i = 0; i < prompts.length; i++) {
      const result = await this.executePrompt<T>(prompts[i].prompt, prompts[i].config);
      results.push(result);
      
      // Add delay between requests to respect rate limits
      if (i < prompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return results;
  }

  // Helper methods for fallback data extraction
  private extractTitleFromContent(content: string): string {
    const titleMatch = content.match(/(?:title|event)[:\s]+([^\n]+)/i);
    if (titleMatch) return titleMatch[1].trim();
    
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();
    
    return 'Unknown Event';
  }

  private extractDescriptionFromContent(content: string): string {
    const descMatch = content.match(/(?:description|about)[:\s]+([^\n]+)/i);
    if (descMatch) return descMatch[1].trim();
    
    // Take first sentence as description
    const firstSentence = content.split('.')[0];
    if (firstSentence.length > 10) return firstSentence.trim();
    
    return 'Event description not available';
  }

  private extractWebsiteFromContent(content: string): string {
    const urlMatch = content.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : '';
  }
}

// Export singleton instance
export const promptExecutor = PromptExecutor.getInstance();
