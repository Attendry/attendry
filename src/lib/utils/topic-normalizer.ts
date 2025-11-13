/**
 * PHASE 2 OPTIMIZATION: Topic Normalizer
 * 
 * Normalizes topic strings to canonical taxonomy IDs.
 * Handles:
 * - Case-insensitive matching
 * - Alias resolution
 * - Versioning (v1.0, v1.1, etc.)
 * - Unknown topic handling
 */

import { TOPIC_TAXONOMY, TAXONOMY_VERSION, TopicDefinition, getAllTopicIds } from '@/lib/data/topic-taxonomy';

/**
 * Normalize a topic string to its canonical taxonomy ID
 * 
 * @param topic Raw topic string (e.g., "GDPR", "data privacy", "AI")
 * @param version Taxonomy version (default: current version)
 * @returns Canonical topic ID or "unknown" if not found
 */
export function normalizeTopicToTaxonomy(
  topic: string | null | undefined,
  version: string = TAXONOMY_VERSION
): string {
  if (!topic || typeof topic !== 'string') return 'unknown';
  
  const topicLower = topic.trim().toLowerCase();
  if (!topicLower) return 'unknown';
  
  // Direct ID match
  if (TOPIC_TAXONOMY[topicLower]) {
    return topicLower;
  }
  
  // Alias match (case-insensitive)
  for (const [topicId, definition] of Object.entries(TOPIC_TAXONOMY)) {
    // Check exact alias match
    if (definition.aliases.some(alias => alias.toLowerCase() === topicLower)) {
      return topicId;
    }
    
    // Check if topic contains alias or vice versa (fuzzy)
    if (definition.aliases.some(alias => {
      const aliasLower = alias.toLowerCase();
      return topicLower.includes(aliasLower) || aliasLower.includes(topicLower);
    })) {
      return topicId;
    }
  }
  
  // No match found
  return 'unknown';
}

/**
 * Find matching topic alias (fuzzy match)
 * Returns canonical topic ID if found, otherwise null
 */
export function findTopicAlias(topic: string | null | undefined): string | null {
  if (!topic || typeof topic !== 'string') return null;
  
  const normalized = normalizeTopicToTaxonomy(topic);
  return normalized !== 'unknown' ? normalized : null;
}

/**
 * Get topic hierarchy for a given topic
 * Returns array of topic IDs from root to leaf
 */
export function getTopicHierarchy(topicId: string): string[] {
  const hierarchy: string[] = [topicId];
  let current = TOPIC_TAXONOMY[topicId];
  
  while (current && current.parent) {
    hierarchy.unshift(current.parent);
    current = TOPIC_TAXONOMY[current.parent];
  }
  
  return hierarchy;
}

/**
 * Normalize an array of topics to canonical taxonomy IDs
 * 
 * @param topics Array of topic strings
 * @param version Taxonomy version (default: current version)
 * @returns Array of canonical topic IDs (duplicates removed, "unknown" filtered out)
 */
export function normalizeTopics(
  topics: (string | null | undefined)[],
  version: string = TAXONOMY_VERSION
): string[] {
  if (!Array.isArray(topics)) return [];
  
  const normalized = topics
    .map(topic => normalizeTopicToTaxonomy(topic, version))
    .filter(id => id !== 'unknown');
  
  // Remove duplicates
  return Array.from(new Set(normalized));
}

/**
 * Get taxonomy coverage percentage
 * Calculates what percentage of topics in a list were successfully mapped
 * 
 * @param topics Array of topic strings
 * @returns Coverage percentage (0-100)
 */
export function getTaxonomyCoverage(topics: (string | null | undefined)[]): number {
  if (!Array.isArray(topics) || topics.length === 0) return 0;
  
  const validTopics = topics.filter(t => t && typeof t === 'string' && t.trim().length > 0);
  if (validTopics.length === 0) return 0;
  
  const mapped = validTopics.filter(topic => {
    const normalized = normalizeTopicToTaxonomy(topic);
    return normalized !== 'unknown';
  });
  
  return Math.round((mapped.length / validTopics.length) * 100);
}

/**
 * Get all known aliases for a topic
 */
export function getTopicVariations(topicId: string): string[] {
  const topic = TOPIC_TAXONOMY[topicId];
  if (!topic) return [];
  
  return [topic.id, ...topic.aliases];
}

/**
 * Check if a topic is in the taxonomy
 */
export function isKnownTopic(topicId: string): boolean {
  return topicId in TOPIC_TAXONOMY;
}

/**
 * Get topic definition with all metadata
 */
export function getTopicDefinition(topicId: string): TopicDefinition | null {
  return TOPIC_TAXONOMY[topicId] || null;
}

/**
 * Get all top-level topics (no parent)
 */
export function getTopLevelTopics(): string[] {
  return Object.entries(TOPIC_TAXONOMY)
    .filter(([_, definition]) => definition.parent === null)
    .map(([id, _]) => id);
}

/**
 * Get all child topics for a parent topic
 */
export function getChildTopics(parentId: string): string[] {
  return Object.entries(TOPIC_TAXONOMY)
    .filter(([_, definition]) => definition.parent === parentId)
    .map(([id, _]) => id);
}

