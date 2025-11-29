/**
 * PHASE 2 OPTIMIZATION: Levenshtein Distance Implementation
 * 
 * Calculates the edit distance between two strings for fuzzy matching.
 * Used for speaker name matching to handle variations like:
 * - "John Smith" vs "J. Smith"
 * - "Dr. John Smith" vs "John Smith"
 * - "Mary-Jane Watson" vs "Mary Jane Watson"
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into another
 * 
 * @param str1 First string
 * @param str2 Second string
 * @returns Levenshtein distance (0 = identical, higher = more different)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  if (!str1 || !str2) {
    return Math.max(str1?.length || 0, str2?.length || 0);
  }

  const len1 = str1.length;
  const len2 = str2.length;

  // Create a matrix to store distances
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 * 1.0 = identical, 0.0 = completely different
 * 
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity ratio between 0 and 1
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1.0;
  if (!str1 || !str2) return 0.0;
  
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  
  if (maxLength === 0) return 1.0;
  
  return 1 - (distance / maxLength);
}

/**
 * Check if two strings are similar within a threshold
 * 
 * @param str1 First string
 * @param str2 Second string
 * @param maxDistance Maximum allowed Levenshtein distance (default: 2)
 * @returns True if strings are similar within threshold
 */
export function isSimilar(str1: string, str2: string, maxDistance: number = 2): boolean {
  const distance = levenshteinDistance(str1, str2);
  return distance <= maxDistance;
}

/**
 * Check if two strings are similar based on similarity ratio
 * 
 * @param str1 First string
 * @param str2 Second string
 * @param minSimilarity Minimum similarity ratio (0-1, default: 0.8)
 * @returns True if similarity ratio >= minSimilarity
 */
export function isSimilarByRatio(str1: string, str2: string, minSimilarity: number = 0.8): boolean {
  const similarity = levenshteinSimilarity(str1, str2);
  return similarity >= minSimilarity;
}





