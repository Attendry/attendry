/**
 * Safe JSON Parsing Utilities
 * 
 * Prevents speaker-extraction JSON parse crashes
 */

export function safeJsonParse<T>(s: string, fallback: T): T {
  try { 
    return JSON.parse(s) as T; 
  } catch { 
    return fallback; 
  }
}

// Specialized for speaker extraction
export function parseSpeakerExtraction(rawModelText: string): { speakers: string[] } {
  return safeJsonParse<{ speakers: string[] }>(rawModelText, { speakers: [] });
}
