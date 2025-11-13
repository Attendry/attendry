/**
 * LLM Service Abstraction
 * 
 * Provides a unified interface for multiple LLM providers (Gemini default, Claude optional for premium)
 * Follows existing Gemini service patterns for consistency
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiService } from './gemini-service';
import { EnhancedGeminiService } from './enhanced-gemini-service';
import { RetryService } from './retry-service';
import { safeParseJson } from '@/lib/utils/json-parser';

export type LLMProvider = 'gemini' | 'claude';
export type LLMModel = 'gemini-2.5-flash' | 'claude-3.5-sonnet';

export interface LLMRequest {
  prompt: string;
  data?: any;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

export interface LLMResponse {
  content: any;
  tokensUsed?: number;
  provider: LLMProvider;
  model: string;
  processingTime: number;
}

export interface LLMOptions {
  provider?: LLMProvider;
  model?: LLMModel;
  useCache?: boolean;
  timeout?: number;
}

/**
 * LLM Service Class
 * 
 * Provides unified interface for LLM calls with provider abstraction
 */
export class LLMService {
  private static geminiService: EnhancedGeminiService | null = null;
  private static readonly DEFAULT_PROVIDER: LLMProvider = 'gemini';
  private static readonly DEFAULT_MODEL: LLMModel = 'gemini-2.5-flash';
  private static readonly DEFAULT_TEMPERATURE = 0.1;
  private static readonly DEFAULT_MAX_TOKENS = 4096;
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  /**
   * Initialize Gemini service instance
   */
  private static getGeminiService(): EnhancedGeminiService {
    if (!this.geminiService) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }
      this.geminiService = new EnhancedGeminiService(apiKey);
    }
    return this.geminiService;
  }

  /**
   * Analyze trends using LLM
   */
  static async analyzeTrends(
    prompt: string,
    data: any,
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const provider = options.provider || this.DEFAULT_PROVIDER;
    const model = options.model || this.DEFAULT_MODEL;

    if (provider === 'gemini') {
      return this.callGemini(prompt, data, {
        ...options,
        model: model as 'gemini-2.5-flash',
        responseFormat: 'json'
      });
    } else if (provider === 'claude') {
      // TODO: Implement Claude support when needed
      throw new Error('Claude provider not yet implemented. Use Gemini for now.');
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Extract topics using LLM
   */
  static async extractTopics(
    prompt: string,
    data: any,
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    return this.analyzeTrends(prompt, data, {
      ...options,
      responseFormat: 'json'
    });
  }

  /**
   * Generate event intelligence using LLM
   */
  static async generateIntelligence(
    prompt: string,
    data: any,
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const provider = options.provider || this.DEFAULT_PROVIDER;
    const model = options.model || this.DEFAULT_MODEL;

    if (provider === 'gemini') {
      return this.callGemini(prompt, data, {
        ...options,
        model: model as 'gemini-2.5-flash',
        responseFormat: 'json'
      });
    } else if (provider === 'claude') {
      // TODO: Implement Claude support when needed
      throw new Error('Claude provider not yet implemented. Use Gemini for now.');
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Call Gemini API with unified interface
   */
  private static async callGemini(
    prompt: string,
    data: any,
    options: LLMOptions & { model?: 'gemini-2.5-flash'; responseFormat?: 'json' | 'text' }
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('[LLMService] GEMINI_API_KEY not configured');
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Use model name consistent with rest of codebase
    // Note: If gemini-2.5-flash doesn't work, try gemini-1.5-flash
    const modelName = options.model || this.DEFAULT_MODEL;
    
    console.log(`[LLMService] Calling Gemini API with model: ${modelName}`);
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: options.responseFormat === 'json' ? 'application/json' : undefined,
        temperature: options.temperature ?? this.DEFAULT_TEMPERATURE,
        maxOutputTokens: options.maxTokens ?? this.DEFAULT_MAX_TOKENS,
      }
    });

    // Build full prompt with data context
    const fullPrompt = data 
      ? `${prompt}\n\nData:\n${JSON.stringify(data, null, 2)}`
      : prompt;

    console.log(`[LLMService] Prompt length: ${fullPrompt.length} characters`);

    try {
      const retryResult = await RetryService.executeWithRetry(
        'gemini',
        'llm_call',
        async () => {
          console.log('[LLMService] Making Gemini API call...');
          const response = await model.generateContent(fullPrompt);
          const text = response.response.text();
          console.log(`[LLMService] Gemini API call successful, response length: ${text.length}`);
          return text;
        }
      );
      
      const result = retryResult.data;

      let content: any;
      if (options.responseFormat === 'json') {
        content = safeParseJson(result);
        if (!content) {
          console.warn('[LLMService] Failed to parse JSON response, using raw text');
          content = result;
        }
      } else {
        content = result;
      }

      // Estimate tokens (rough: 1 token ≈ 4 characters)
      const tokensUsed = Math.ceil((fullPrompt.length + result.length) / 4);

      console.log(`[LLMService] Intelligence generation complete, tokens: ~${tokensUsed}, time: ${Date.now() - startTime}ms`);

      return {
        content,
        tokensUsed,
        provider: 'gemini',
        model: modelName,
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      console.error('[LLMService] Gemini call failed:', error);
      console.error('[LLMService] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  }

  /**
   * Check if user has premium access (for Claude support)
   */
  static async isPremiumUser(userId?: string): Promise<boolean> {
    // TODO: Implement premium user check
    // For now, always return false (use Gemini only)
    return false;
  }

  /**
   * Get recommended provider for user
   */
  static async getRecommendedProvider(userId?: string): Promise<LLMProvider> {
    const isPremium = await this.isPremiumUser(userId);
    return isPremium ? 'claude' : 'gemini';
  }
}

