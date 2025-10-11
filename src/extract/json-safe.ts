/**
 * Safe JSON Parsing with Repair and Fallback
 */

export async function parseJsonSafe(s: string) {
  try { return JSON.parse(s); } catch {}
  try { 
    // Try jsonrepair if available
    const { jsonrepair } = await import('jsonrepair');
    return JSON.parse(jsonrepair(s)); 
  } catch {}
  return null;
}
