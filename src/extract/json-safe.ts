/**
 * Safe JSON Parsing with Repair and Fallback
 */

export function parseJsonSafe(s: string): any | null {
  try { return JSON.parse(s); } catch {}
  try { 
    // Try jsonrepair if available
    const { jsonrepair } = require('jsonrepair');
    return JSON.parse(jsonrepair(s)); 
  } catch {}
  return null;
}
