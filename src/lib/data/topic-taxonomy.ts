/**
 * PHASE 2 OPTIMIZATION: Topic Taxonomy & Normalization
 * 
 * Defines a canonical taxonomy of 20 core topics for event classification.
 * This enables consistent trend analysis and reduces topic fragmentation.
 * 
 * Version: 1.0
 * Last Updated: 2025-01-13
 */

export interface TopicDefinition {
  id: string;
  aliases: string[];
  parent: string | null;
  description?: string;
}

/**
 * Core topic taxonomy for event classification
 * Each topic has:
 * - id: Canonical topic identifier
 * - aliases: Common variations and synonyms
 * - parent: Parent topic (null for top-level)
 * - description: Human-readable description
 */
export const TOPIC_TAXONOMY: Record<string, TopicDefinition> = {
  // Legal & Compliance
  'legal-compliance': {
    id: 'legal-compliance',
    aliases: ['legal', 'compliance', 'regulation', 'governance', 'regulatory', 'regulatory compliance', 'legal compliance', 'compliance law'],
    parent: null,
    description: 'Legal and regulatory compliance topics'
  },
  'data-privacy-gdpr': {
    id: 'data-privacy-gdpr',
    aliases: ['gdpr', 'data privacy', 'privacy', 'data protection', 'dsgvo', 'datenschutz', 'privacy law', 'data privacy law', 'privacy regulation', 'data protection regulation'],
    parent: 'legal-compliance',
    description: 'Data privacy and GDPR compliance'
  },
  'cybersecurity': {
    id: 'cybersecurity',
    aliases: ['cybersecurity', 'cyber security', 'information security', 'infosec', 'security', 'it security', 'network security', 'data security'],
    parent: null,
    description: 'Cybersecurity and information security'
  },
  
  // Technology & AI
  'technology-ai': {
    id: 'technology-ai',
    aliases: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'technology', 'tech', 'artificial intelligence', 'ai technology', 'ml technology'],
    parent: null,
    description: 'Artificial intelligence and machine learning'
  },
  'digital-transformation': {
    id: 'digital-transformation',
    aliases: ['digital transformation', 'digitalization', 'digitization', 'digital innovation', 'digital strategy', 'digital business'],
    parent: 'technology-ai',
    description: 'Digital transformation initiatives'
  },
  'cloud-computing': {
    id: 'cloud-computing',
    aliases: ['cloud', 'cloud computing', 'aws', 'azure', 'gcp', 'google cloud', 'amazon web services', 'cloud services', 'cloud infrastructure'],
    parent: 'technology-ai',
    description: 'Cloud computing and infrastructure'
  },
  
  // Business & Strategy
  'business-strategy': {
    id: 'business-strategy',
    aliases: ['strategy', 'business strategy', 'corporate strategy', 'strategic planning', 'business planning', 'corporate planning'],
    parent: null,
    description: 'Business and corporate strategy'
  },
  'innovation': {
    id: 'innovation',
    aliases: ['innovation', 'innovation management', 'product innovation', 'business innovation', 'corporate innovation', 'innovation strategy'],
    parent: 'business-strategy',
    description: 'Innovation and product development'
  },
  'leadership': {
    id: 'leadership',
    aliases: ['leadership', 'executive leadership', 'management', 'executive management', 'c-suite', 'leadership development'],
    parent: 'business-strategy',
    description: 'Leadership and executive management'
  },
  
  // Industry-Specific
  'healthcare': {
    id: 'healthcare',
    aliases: ['healthcare', 'health care', 'medical', 'health', 'pharma', 'pharmaceutical', 'healthcare industry', 'medical industry'],
    parent: null,
    description: 'Healthcare and pharmaceutical industry'
  },
  'finance-banking': {
    id: 'finance-banking',
    aliases: ['finance', 'banking', 'financial services', 'fintech', 'financial technology', 'banking industry', 'financial industry'],
    parent: null,
    description: 'Finance, banking, and financial services'
  },
  'retail-commerce': {
    id: 'retail-commerce',
    aliases: ['retail', 'commerce', 'e-commerce', 'ecommerce', 'online retail', 'retail industry', 'commerce industry'],
    parent: null,
    description: 'Retail and e-commerce'
  },
  
  // Operations & Process
  'operations': {
    id: 'operations',
    aliases: ['operations', 'operational excellence', 'process improvement', 'operations management', 'business operations'],
    parent: null,
    description: 'Business operations and process improvement'
  },
  'supply-chain': {
    id: 'supply-chain',
    aliases: ['supply chain', 'supplychain', 'logistics', 'procurement', 'supply chain management', 'logistics management'],
    parent: 'operations',
    description: 'Supply chain and logistics'
  },
  'quality-assurance': {
    id: 'quality-assurance',
    aliases: ['quality', 'quality assurance', 'qa', 'quality management', 'quality control', 'quality improvement'],
    parent: 'operations',
    description: 'Quality assurance and quality management'
  },
  
  // Marketing & Sales
  'marketing': {
    id: 'marketing',
    aliases: ['marketing', 'digital marketing', 'marketing strategy', 'brand marketing', 'content marketing', 'marketing communications'],
    parent: null,
    description: 'Marketing and brand communications'
  },
  'sales': {
    id: 'sales',
    aliases: ['sales', 'sales strategy', 'sales management', 'revenue', 'revenue growth', 'sales enablement'],
    parent: 'marketing',
    description: 'Sales and revenue growth'
  },
  
  // Human Resources
  'human-resources': {
    id: 'human-resources',
    aliases: ['hr', 'human resources', 'talent management', 'people management', 'workforce', 'employee engagement', 'talent acquisition'],
    parent: null,
    description: 'Human resources and talent management'
  },
  
  // Sustainability & ESG
  'sustainability-esg': {
    id: 'sustainability-esg',
    aliases: ['sustainability', 'esg', 'environmental', 'social', 'governance', 'corporate responsibility', 'csr', 'sustainable business'],
    parent: null,
    description: 'Sustainability and ESG (Environmental, Social, Governance)'
  },
};

/**
 * Current taxonomy version
 */
export const TAXONOMY_VERSION = '1.0';

/**
 * Get all topic IDs (canonical names)
 */
export function getAllTopicIds(): string[] {
  return Object.keys(TOPIC_TAXONOMY);
}

/**
 * Get topic definition by ID
 */
export function getTopicById(id: string): TopicDefinition | undefined {
  return TOPIC_TAXONOMY[id];
}

/**
 * Get all aliases for a topic
 */
export function getTopicAliases(topicId: string): string[] {
  const topic = TOPIC_TAXONOMY[topicId];
  return topic ? [topic.id, ...topic.aliases] : [];
}

/**
 * Get parent topic for a given topic
 */
export function getParentTopic(topicId: string): TopicDefinition | null {
  const topic = TOPIC_TAXONOMY[topicId];
  if (!topic || !topic.parent) return null;
  return TOPIC_TAXONOMY[topic.parent] || null;
}

/**
 * Get topic hierarchy (all ancestors)
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
 * Check if a topic is a top-level topic (no parent)
 */
export function isTopLevelTopic(topicId: string): boolean {
  const topic = TOPIC_TAXONOMY[topicId];
  return topic ? topic.parent === null : false;
}

