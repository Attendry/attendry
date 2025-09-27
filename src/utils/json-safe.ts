/**
 * Defensive JSON parsing for speaker extraction (removes crash in log)
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try { 
    return JSON.parse(text) as T; 
  } catch { 
    return fallback; 
  }
}