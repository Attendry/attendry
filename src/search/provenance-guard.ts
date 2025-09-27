/**
 * Provenance Guard
 * 
 * Prevents blocked augmentation terms from sneaking into queries.
 */

const BLOCKLIST = new Set([
  'regtech','ESG','"trade show"','industry event','governance','risk management','privacy',
  'legal technology','legal tech','regulatory','audit','whistleblowing','data protection',
  'cybersecurity','regtech','esg','trade show','industry event','governance','risk management',
  'privacy','legal technology','legal tech','regulatory','audit','whistleblowing','data protection',
  'cybersecurity','gdpr','dsgvo','rechtsberatung','anwaltskanzlei','gericht','justiz'
]);

export function assertNoBlockedAugmentation(tokens: {text: string, source: string}[]): void {
  const offenders = tokens.filter(t => 
    t.source !== 'user_config' && 
    BLOCKLIST.has(t.text.toLowerCase())
  );
  
  if (offenders.length > 0) {
    throw new Error(`Blocked augmentation detected: ${offenders.map(o => o.text).join(', ')}`);
  }
}

/**
 * Check if augmentation is properly controlled
 */
export function validateQueryProvenance(tokens: {text: string, source: string}[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check for blocked terms in augmented tokens
  const offenders = tokens.filter(t => 
    t.source !== 'user_config' && 
    BLOCKLIST.has(t.text.toLowerCase())
  );
  
  if (offenders.length > 0) {
    errors.push(`Blocked augmentation detected: ${offenders.map(o => o.text).join(', ')}`);
  }
  
  // Check if augmentation is used when disabled
  const hasAugmented = tokens.some(t => t.source === 'augmented');
  const augmentationEnabled = process.env.ENABLE_QUERY_AUGMENTATION === '1';
  
  if (hasAugmented && !augmentationEnabled) {
    errors.push('Augmentation is disabled. Found unexpected augmented tokens.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
