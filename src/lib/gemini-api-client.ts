/**
 * Unified Gemini API Client
 * 
 * Provides a consistent interface for all Gemini API calls across the application.
 * Handles timeouts, error recovery, and response parsing uniformly.
 */

// Environment variables
const geminiKey = process.env.GEMINI_API_KEY;
const modelPath = process.env.GEMINI_MODEL_PATH || 'v1beta/models/gemini-2.5-flash:generateContent';

// Configuration
const GEMINI_CONFIG = {
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  maxOutputTokens: 8192, // Increased to reasonable limit (8k tokens)
  temperature: 0.1,
  topP: 0.8,
  topK: 40
};

export interface GeminiRequest {
  prompt: string;
  systemInstruction?: string;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface GeminiResponse {
  text: string;
  usage?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GeminiAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public response?: any
  ) {
    super(message);
    this.name = 'GeminiAPIError';
  }
}

/**
 * Unified Gemini API client
 */
export class GeminiAPIClient {
  private static instance: GeminiAPIClient;
  private requestCount = 0;
  private lastRequestTime = 0;

  static getInstance(): GeminiAPIClient {
    if (!GeminiAPIClient.instance) {
      GeminiAPIClient.instance = new GeminiAPIClient();
    }
    return GeminiAPIClient.instance;
  }

  /**
   * Make a request to the Gemini API with proper error handling and timeouts
   */
  async generateContent(request: GeminiRequest): Promise<GeminiResponse> {
    if (!geminiKey) {
      throw new GeminiAPIError('Missing API key: GEMINI_API_KEY not set');
    }

    // Rate limiting - simple delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 100) { // 100ms minimum between requests
      await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    const url = `https://generativelanguage.googleapis.com/${modelPath}?key=${geminiKey}`;
    
    const requestBody = {
      contents: [{ parts: [{ text: request.prompt }] }],
      systemInstruction: request.systemInstruction ? {
        parts: [{ text: request.systemInstruction }]
      } : undefined,
      generationConfig: {
        temperature: request.temperature ?? GEMINI_CONFIG.temperature,
        maxOutputTokens: request.maxOutputTokens ?? GEMINI_CONFIG.maxOutputTokens,
        topP: request.topP ?? GEMINI_CONFIG.topP,
        topK: request.topK ?? GEMINI_CONFIG.topK
      }
    };

    console.log(`[gemini-api] Making request (${++this.requestCount}): ${request.prompt.substring(0, 100)}...`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(GEMINI_CONFIG.timeout)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[gemini-api] API error ${response.status}:`, errorText);
        throw new GeminiAPIError(
          `Gemini API error: ${response.status} ${response.statusText}`,
          response.status,
          response.statusText,
          errorText
        );
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      // Check finishReason first
      const finishReason = data.candidates?.[0]?.finishReason;
      const usageMetadata = data.usageMetadata;
      
      if (!text) {
        console.warn('[gemini-api] No text content in response:', {
          finishReason,
          usageMetadata,
          hasCandidates: !!data.candidates?.[0]
        });
        
        // Check if it's a MAX_TOKENS error
        if (finishReason === 'MAX_TOKENS') {
          console.warn('[gemini-api] MAX_TOKENS reached - response was truncated. Consider increasing maxOutputTokens or reducing prompt size.');
          throw new GeminiAPIError(
            'Response truncated due to token limit - increase maxOutputTokens or reduce prompt size', 
            undefined, 
            undefined, 
            { ...data, finishReason, usageMetadata }
          );
        }
        
        // Check for other finish reasons
        if (finishReason === 'SAFETY') {
          throw new GeminiAPIError('Response blocked by safety filters', undefined, undefined, data);
        }
        
        if (finishReason === 'RECITATION') {
          throw new GeminiAPIError('Response blocked due to recitation policy', undefined, undefined, data);
        }
        
        throw new GeminiAPIError(
          `No text content in Gemini response (finishReason: ${finishReason || 'unknown'})`, 
          undefined, 
          undefined, 
          { ...data, finishReason, usageMetadata }
        );
      }
      
      // Log if MAX_TOKENS was reached but we still got content (truncated response)
      if (finishReason === 'MAX_TOKENS' && text) {
        console.warn('[gemini-api] MAX_TOKENS reached but partial content received. Response may be truncated.');
      }

      console.log(`[gemini-api] Response received (${text.length} chars)`);

      return {
        text,
        usage: data.usageMetadata
      };

    } catch (error) {
      if (error instanceof GeminiAPIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new GeminiAPIError(`Gemini API timeout after ${GEMINI_CONFIG.timeout}ms`);
        }
        throw new GeminiAPIError(`Gemini API request failed: ${error.message}`);
      }

      throw new GeminiAPIError('Unknown Gemini API error');
    }
  }

  /**
   * Generate content with retry logic
   */
  async generateContentWithRetry(request: GeminiRequest): Promise<GeminiResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= GEMINI_CONFIG.maxRetries; attempt++) {
      try {
        return await this.generateContent(request);
      } catch (error) {
        lastError = error as Error;
        console.warn(`[gemini-api] Attempt ${attempt} failed:`, error);

        if (attempt < GEMINI_CONFIG.maxRetries) {
          const delay = GEMINI_CONFIG.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[gemini-api] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new GeminiAPIError('All retry attempts failed');
  }

  /**
   * Parse JSON from Gemini response text
   */
  parseJsonResponse(text: string): any {
    try {
      // First, try to find JSON in code blocks
      const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        return JSON.parse(jsonBlockMatch[1]);
      }

      // Try to find JSON object
      const jsonObjectMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonObjectMatch) {
        return JSON.parse(jsonObjectMatch[0]);
      }

      // Try to find JSON array
      const jsonArrayMatch = text.match(/\[[\s\S]*?\]/);
      if (jsonArrayMatch) {
        return JSON.parse(jsonArrayMatch[0]);
      }

      // If no JSON found, try to parse the entire text
      return JSON.parse(text);
    } catch (error) {
      console.warn('[gemini-api] Failed to parse JSON response:', error);
      console.warn('[gemini-api] Raw response:', text.substring(0, 500));
      throw new GeminiAPIError(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const geminiClient = GeminiAPIClient.getInstance();

// Export convenience functions
export async function generateContent(request: GeminiRequest): Promise<GeminiResponse> {
  return geminiClient.generateContent(request);
}

export async function generateContentWithRetry(request: GeminiRequest): Promise<GeminiResponse> {
  return geminiClient.generateContentWithRetry(request);
}

export function parseJsonResponse(text: string): any {
  return geminiClient.parseJsonResponse(text);
}
