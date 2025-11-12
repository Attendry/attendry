/**
 * JSON schema validation and auto-repair for Gemini responses
 * Prevents crashes from malformed JSON and enforces strict schemas
 */

import { z } from 'zod';

/**
 * Speaker schema with strict validation
 */
export const SpeakerSchema = z.object({
  name: z.string().min(3),
  role: z.string().optional(),
  org: z.string().optional(),
  url: z.string().url().optional()
});

/**
 * Event schema with required fields and ISO date validation
 */
export const EventSchema = z.object({
  title: z.string().min(3),
  organizer: z.string().optional(),
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'ISO date required'),
  ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  tz: z.string().optional(),
  venue: z.string().optional(),
  city: z.string().optional(),
  country: z.string().length(2).optional(), // "DE" preferred
  url: z.string().url(),
  topics: z.array(z.string()).optional(),
  speakers: z.array(SpeakerSchema).optional()
});

export type EventDTO = z.infer<typeof EventSchema>;
export type SpeakerDTO = z.infer<typeof SpeakerSchema>;

/**
 * Safely parse events from JSON text with schema validation
 * Extracts JSON from text, validates against schema, returns valid items only
 * 
 * @param jsonText - Raw JSON text from LLM (may contain extra text)
 * @returns Parsed and validated events, or error details
 */
export function safeParseEvents(jsonText: string): { 
  ok: boolean; 
  data: EventDTO[]; 
  error?: any 
} {
  try {
    // Extract the largest {...} or [...] block if model leaked text
    const match = jsonText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const raw = match ? match[1] : jsonText;
    
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    
    const out: EventDTO[] = [];
    for (const item of arr) {
      const r = EventSchema.safeParse(item);
      if (r.success) {
        out.push(r.data);
      } else {
        console.warn('[json] Schema validation failed for item:', r.error.errors);
      }
    }
    
    return out.length 
      ? { ok: true, data: out } 
      : { ok: false, data: [], error: 'schema_validation_failed' };
      
  } catch (e) {
    return { ok: false, data: [], error: e };
  }
}

/**
 * Minimal JSON repair for common LLM mistakes
 * Fixes: trailing commas, unquoted keys, comments, markdown fences
 * 
 * @param text - Potentially malformed JSON text
 * @returns Repaired JSON text
 */
export function tryRepairJson(text: string): string {
  let t = text
    // Remove trailing commas before closing braces/brackets
    .replace(/,\s*([}\]])/g, '$1')
    // Quote unquoted keys (simple case)
    .replace(/(\w+)\s*:/g, '"$1":')
    // Remove line comments
    .replace(/\/\/.*$/gm, '')
    // Remove block comments
    .replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Extract from markdown fence if present
  const fenced = t.match(/```json([\s\S]*?)```/i);
  if (fenced) t = fenced[1].trim();
  
  return t.trim();
}

/**
 * Parse JSON with auto-repair fallback
 * Attempts: direct parse → repair → re-parse
 * 
 * @param text - JSON text from LLM
 * @returns Parsed events or error
 */
export function parseWithRepair(text: string): {
  ok: boolean;
  data: EventDTO[];
  error?: any;
  repaired?: boolean;
} {
  // Try direct parse first
  let result = safeParseEvents(text);
  
  if (result.ok) {
    return { ...result, repaired: false };
  }
  
  // Try repair
  console.log('[json] Initial parse failed, attempting repair...');
  const repaired = tryRepairJson(text);
  result = safeParseEvents(repaired);
  
  if (result.ok) {
    console.log('[json] Successfully repaired and parsed JSON');
    return { ...result, repaired: true };
  }
  
  console.error('[json] Repair failed, JSON remains invalid');
  return { ...result, repaired: true };
}

/**
 * Re-prompt Gemini to fix invalid JSON (last resort)
 * 
 * @param invalidText - The invalid JSON text
 * @param generateFn - Function to call Gemini (takes prompt, returns text)
 * @returns Repaired events or null
 */
export async function repromptForValidJson(
  invalidText: string,
  generateFn: (prompt: string) => Promise<string | null>
): Promise<EventDTO[] | null> {
  const prompt = `You produced invalid JSON. Convert the following content to valid JSON strictly matching this schema:

{
  "title": "string (min 3 chars)",
  "starts_at": "YYYY-MM-DD",
  "ends_at": "YYYY-MM-DD (optional)",
  "city": "string (optional)",
  "country": "2-letter code (optional)",
  "venue": "string (optional)",
  "url": "valid URL",
  "organizer": "string (optional)",
  "speakers": [{"name": "string", "role": "string", "org": "string"}]
}

Content to convert:
${invalidText.substring(0, 2000)}

Return ONLY valid JSON, no markdown, no explanation.`;

  try {
    const response = await Promise.race([
      generateFn(prompt),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Reprompt timeout')), 6000)
      )
    ]);
    
    if (!response) return null;
    
    const result = parseWithRepair(response);
    return result.ok ? result.data : null;
    
  } catch (error) {
    console.error('[json] Reprompt failed:', error);
    return null;
  }
}

