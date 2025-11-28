/**
 * LLM Service
 * Handles communication with LLM providers (OpenAI, Anthropic, etc.)
 */

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMService {
  private apiKey: string;
  private provider: 'openai' | 'anthropic' | 'gemini';
  private model: string;
  private maxTokens: number;
  private baseURL: string;

  constructor() {
    // Support both LLM_API_KEY (generic) and GEMINI_API_KEY (existing pattern)
    this.apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || '';
    this.provider = (process.env.LLM_PROVIDER as 'openai' | 'anthropic' | 'gemini') || 'gemini';
    this.model = process.env.LLM_MODEL || this.getDefaultModel();
    this.maxTokens = parseInt(process.env.LLM_MAX_TOKENS || '1000');
    this.baseURL = process.env.LLM_BASE_URL || '';
  }

  private getDefaultModel(): string {
    switch (this.provider) {
      case 'openai':
        return 'gpt-4-turbo-preview';
      case 'anthropic':
        return 'claude-3-opus-20240229';
      case 'gemini':
        return process.env.GEMINI_MODEL_PATH?.replace(':generateContent', '') || 'gemini-2.5-flash';
      default:
        return 'gemini-2.5-flash';
    }
  }

  /**
   * Generate outreach message
   */
  async generateOutreachMessage(prompt: string, options?: { maxTokens?: number }): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('LLM API key not configured');
    }

    // Use higher default for outreach messages (subject + body can be long)
    const maxTokens = options?.maxTokens || 2048;

    if (this.provider === 'openai') {
      return await this.callOpenAI(prompt, maxTokens);
    } else if (this.provider === 'anthropic') {
      return await this.callAnthropic(prompt, maxTokens);
    } else {
      return await this.callGemini(prompt, maxTokens);
    }
  }

  /**
   * Generate text summary (not JSON formatted)
   */
  async generateTextSummary(prompt: string, options?: { maxTokens?: number }): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('LLM API key not configured');
    }

    const maxTokens = options?.maxTokens || 512;

    if (this.provider === 'gemini') {
      return await this.callGemini(prompt, maxTokens, false); // false = don't force JSON
    } else {
      // For other providers, use regular method
      return await this.generateOutreachMessage(prompt, { maxTokens });
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string, maxTokensOverride?: number): Promise<LLMResponse> {
    const tokens = maxTokensOverride || this.maxTokens;
    const url = this.baseURL || 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert sales outreach specialist. Draft personalized, professional outreach messages that are warm, specific, and action-oriented. Always respond with valid JSON when requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: tokens,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    return {
      content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string, maxTokensOverride?: number): Promise<LLMResponse> {
    const tokens = maxTokensOverride || this.maxTokens;
    const url = this.baseURL || 'https://api.anthropic.com/v1/messages';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: tokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        system: 'You are an expert sales outreach specialist. Draft personalized, professional outreach messages that are warm, specific, and action-oriented. Always respond with valid JSON when requested.'
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';
    
    return {
      content,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      } : undefined
    };
  }

  /**
   * Call Gemini API
   */
  private async callGemini(prompt: string, maxTokensOverride?: number, forceJSON: boolean = true): Promise<LLMResponse> {
    const tokens = maxTokensOverride || this.maxTokens;
    const apiKey = this.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const modelPath = process.env.GEMINI_MODEL_PATH || 'v1beta/models/gemini-2.5-flash:generateContent';
    const url = `https://generativelanguage.googleapis.com/${modelPath}?key=${apiKey}`;

    const systemInstruction = 'You are an expert sales outreach specialist. Draft personalized, professional outreach messages that are warm, specific, and action-oriented. Always respond with valid JSON when requested.';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        systemInstruction: {
          parts: [{
            text: systemInstruction
          }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: tokens,
          topP: 0.8,
          topK: 10,
          ...(forceJSON ? { responseMimeType: 'application/json' } : {})
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No candidates in Gemini response');
    }

    const candidate = data.candidates[0];
    const content = candidate.content?.parts?.[0]?.text || '';

    if (!content) {
      const finishReason = candidate.finishReason;
      if (finishReason === 'SAFETY') {
        throw new Error('Response blocked by safety filters');
      }
      throw new Error(`No content in Gemini response (finishReason: ${finishReason || 'unknown'})`);
    }

    return {
      content,
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: (data.usageMetadata.promptTokenCount || 0) + (data.usageMetadata.candidatesTokenCount || 0)
      } : undefined
    };
  }

  /**
   * Parse JSON response from LLM
   */
  parseJSONResponse<T = any>(content: string): T {
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Try direct JSON parse
      return JSON.parse(content);
    } catch (error) {
      // If parsing fails, try to extract JSON object from text
      const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        try {
          return JSON.parse(jsonObjectMatch[0]);
        } catch {
          throw new Error('Failed to parse LLM response as JSON');
        }
      }
      throw new Error('No valid JSON found in LLM response');
    }
  }
}
