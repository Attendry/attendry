/**
 * LLM call robustness wrapper
 * Handles retries, adaptive chunking, and strict schema validation
 */

export interface LLMRetryOptions {
  maxRetries?: number;
  initialChunkSize?: number;
  chunkReductionFactor?: number;
  requireJsonKey?: string; // Required top-level key in JSON response
  timeoutMs?: number;
}

export interface LLMResult<T = any> {
  success: boolean;
  data: T | null;
  attempts: number;
  chunkSizesUsed: number[];
  error?: string;
}

/**
 * Execute LLM call with retry and adaptive chunking
 * 
 * @param chunks - Array of content chunks to process
 * @param executor - Function that calls the LLM for a single chunk
 * @param options - Retry configuration
 * @returns Aggregated results from all chunks
 */
export async function executeLLMWithRetry<T>(
  chunks: string[],
  executor: (chunk: string, chunkIndex: number) => Promise<string | null>,
  options: LLMRetryOptions = {}
): Promise<LLMResult<T[]>> {
  const {
    maxRetries = 2,
    initialChunkSize = chunks[0]?.length || 3000,
    chunkReductionFactor = 0.7,
    requireJsonKey,
    timeoutMs = 15000
  } = options;
  
  const results: T[] = [];
  const chunkSizesUsed: number[] = [];
  let totalAttempts = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];
    let currentChunkSize = initialChunkSize;
    let attempt = 0;
    let success = false;
    
    while (attempt <= maxRetries && !success) {
      totalAttempts++;
      
      try {
        // Trim chunk if needed
        if (chunk.length > currentChunkSize && attempt > 0) {
          chunk = chunk.substring(0, currentChunkSize);
          console.log(`[llm-retry] Retry ${attempt}/${maxRetries} with reduced chunk: ${currentChunkSize} chars`);
        }
        
        // Execute with timeout
        const responsePromise = executor(chunk, i);
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('LLM call timeout')), timeoutMs)
        );
        
        const response = await Promise.race([responsePromise, timeoutPromise]);
        
        // Validate response
        if (!response || response.trim().length === 0) {
          throw new Error('Empty response from LLM');
        }
        
        // Parse JSON
        let parsed: any;
        try {
          parsed = JSON.parse(response);
        } catch (jsonError) {
          // Try to extract JSON from markdown or other wrappers
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
            console.log(`[llm-retry] Recovered JSON from wrapped response`);
          } else {
            throw new Error(`JSON parse failed: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
          }
        }
        
        // Validate required key if specified
        if (requireJsonKey && !(requireJsonKey in parsed)) {
          throw new Error(`Missing required key "${requireJsonKey}" in response`);
        }
        
        // Extract data
        const data = requireJsonKey ? parsed[requireJsonKey] : parsed;
        
        // Validate data is not empty
        if (Array.isArray(data)) {
          if (data.length === 0) {
            console.log(`[llm-retry] Chunk ${i + 1} returned empty array, continuing...`);
          } else {
            results.push(...data);
          }
        } else if (data && typeof data === 'object') {
          results.push(data);
        }
        
        chunkSizesUsed.push(chunk.length);
        success = true;
        
      } catch (error) {
        console.warn(`[llm-retry] Chunk ${i + 1} attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);
        
        // On last attempt, log but continue to next chunk
        if (attempt >= maxRetries) {
          console.error(`[llm-retry] Chunk ${i + 1} FAILED after ${maxRetries + 1} attempts`);
          chunkSizesUsed.push(chunk.length);
          break; // Move to next chunk
        }
        
        // Reduce chunk size for retry
        currentChunkSize = Math.floor(currentChunkSize * chunkReductionFactor);
        attempt++;
      }
    }
  }
  
  return {
    success: results.length > 0,
    data: results.length > 0 ? results : null,
    attempts: totalAttempts,
    chunkSizesUsed,
    error: results.length === 0 ? 'All chunks failed or returned empty' : undefined
  };
}

/**
 * Create strict speaker extraction prompt
 */
export function createSpeakerPrompt(content: string, chunkIndex: number, totalChunks: number): string {
  return `Extract ONLY PEOPLE (actual speakers/presenters) from this event content.

REQUIRED: Return JSON with "speakers" array. Each entry must be a REAL PERSON.

Schema:
{
  "speakers": [
    {
      "name": "Full Name (required)",
      "title": "Job title or null",
      "org": "Organization or null",
      "profile_url": "Profile URL or null"
    }
  ]
}

DO NOT EXTRACT:
✗ Event names: "Privacy Summit", "Risk Forum"
✗ Session titles: "Keynote Address", "Panel Discussion"
✗ Organization names: "ABC Corporation"
✗ UI/CTA elements: "Reserve Seat", "Register Now", "Learn More"
✗ Buttons/Links: "Sign Up", "Download", "Contact"
✗ Generic roles without names: "Moderator", "Organizer"
✗ Organizational terms: "Committee", "Advisory Board"

ONLY EXTRACT:
✓ Full person names: "Dr. Sarah Johnson", "Michael Schmidt"
✓ With context: job title, company, bio if available

If NO PEOPLE found, return {"speakers": []}.

Content chunk ${chunkIndex + 1}/${totalChunks}:
${content}`;
}

/**
 * Create strict metadata extraction prompt
 */
export function createMetadataPrompt(content: string, chunkIndex: number, totalChunks: number): string {
  return `Extract factual event metadata from this content chunk.

REQUIRED: Return JSON with "event" object.

Schema:
{
  "event": {
    "name": "Event name (string)",
    "start_date": "YYYY-MM-DD or null",
    "end_date": "YYYY-MM-DD or null",
    "city": "City name or null",
    "country_code": "DE|AT|CH or null",
    "venue": "Venue name or null",
    "url": "Event URL (string)"
  }
}

Date Guidelines:
- Look for formats: "12.11.2025", "November 12, 2025", "2025-11-12"
- Return as ISO: "YYYY-MM-DD"
- If range found: use start_date and end_date
- If no date: return null (DO NOT fabricate)

Location Guidelines:
- Extract city name from venue/address
- Determine country_code: DE (Germany), AT (Austria), CH (Switzerland)
- If uncertain: return null

If no clear event found, return {"event": null}.

Content chunk ${chunkIndex + 1}/${totalChunks}:
${content}`;
}

/**
 * Validate speaker object
 */
export function isValidSpeaker(speaker: any): boolean {
  if (!speaker || typeof speaker !== 'object') return false;
  
  // Must have name
  if (!speaker.name || typeof speaker.name !== 'string') return false;
  
  const name = speaker.name.trim();
  
  // Basic validations
  if (name.length < 3 || name.length > 100) return false;
  
  // Must have at least 2 words (first and last name)
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  
  // Check for obvious non-names
  const invalidPatterns = [
    /^(speaker|presenter|moderator|organizer|committee)/i,
    /^(register|reserve|book|ticket|sign\s*up|learn\s*more)/i,
    /(summit|forum|conference|workshop|seminar)/i
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(name)) return false;
  }
  
  return true;
}

/**
 * Validate and clean speaker array
 */
export function cleanSpeakers(speakers: any[]): any[] {
  if (!Array.isArray(speakers)) return [];
  
  return speakers
    .filter(isValidSpeaker)
    .map(speaker => ({
      name: speaker.name.trim(),
      title: speaker.title?.trim() || null,
      org: speaker.org?.trim() || speaker.company?.trim() || null,
      profile_url: speaker.profile_url?.trim() || null
    }));
}

