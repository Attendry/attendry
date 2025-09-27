/**
 * Robust JSON Parsing Utilities
 * 
 * This module provides safe JSON parsing with multiple fallback strategies
 * to handle malformed or partial JSON responses from AI models.
 */

import { parse as parseJson5 } from 'json5';

/**
 * Attempts to repair common JSON issues
 */
function repairJson(input: string): string {
  let repaired = input.trim();
  
  // Remove markdown code blocks
  repaired = repaired.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  repaired = repaired.replace(/^```\s*/, '').replace(/\s*```$/, '');
  
  // Fix common issues
  repaired = repaired
    // Fix trailing commas
    .replace(/,(\s*[}\]])/g, '$1')
    // Fix missing quotes around keys
    .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
    // Fix single quotes to double quotes
    .replace(/'/g, '"')
    // Fix unescaped quotes in strings
    .replace(/"([^"]*)"([^"]*)"([^"]*)"/g, '"$1\\"$2\\"$3"')
    // Remove comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  
  return repaired;
}

/**
 * Safely parses JSON with multiple fallback strategies
 */
export function safeParseJson<T = any>(input: string): T | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Strategy 1: Direct JSON.parse
  try {
    return JSON.parse(input);
  } catch (error) {
    // Continue to next strategy
  }

  // Strategy 2: Repair and parse
  try {
    const repaired = repairJson(input);
    return JSON.parse(repaired);
  } catch (error) {
    // Continue to next strategy
  }

  // Strategy 3: JSON5 parsing (more lenient)
  try {
    return parseJson5(input);
  } catch (error) {
    // Continue to next strategy
  }

  // Strategy 4: Extract JSON from mixed content
  try {
    const jsonMatch = input.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      return JSON.parse(jsonStr);
    }
  } catch (error) {
    // Final fallback
  }

  return null;
}

/**
 * Validates that parsed JSON matches expected schema
 */
export function validateSchema<T>(data: any, schema: (data: any) => data is T): T | null {
  if (schema(data)) {
    return data;
  }
  return null;
}

/**
 * Logs parsing attempts for debugging
 */
export function logParseAttempt(input: string, result: any, strategy: string): void {
  const inputPreview = input.length > 500 ? input.substring(0, 500) + '...' : input;
  console.log(`JSON Parse ${strategy}:`, {
    inputLength: input.length,
    inputPreview,
    success: result !== null,
    resultType: typeof result
  });
}
