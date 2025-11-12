/**
 * Page type classification to filter out non-event pages
 * Uses regex + lightweight heuristics
 */

export interface PageTypeResult {
  isEvent: boolean;
  confidence: number;
  reason: string;
  type: 'event' | 'static' | 'list' | 'legal' | 'blog' | 'unknown';
}

/**
 * Negative keywords that indicate non-event pages
 */
const NEGATIVE_KEYWORDS = [
  // Legal/Static
  'terms', 'bedingungen', 'agb', 'privacy', 'datenschutz', 'impressum',
  'cookie', 'legal', 'disclaimer', 'imprint', 'nutzungsbedingungen',
  
  // Content pages
  'jobs', 'careers', 'press', 'news', 'blog', 'article', 'post',
  'tag', 'category', 'archive', 'author',
  
  // Navigation
  'about', 'contact', 'kontakt', 'über-uns', 'about-us', 'team',
  
  // Aggregator list pages
  'all-events', 'event-list', 'event-calendar', 'upcoming-events',
  'past-events', 'archive', 'search-results'
];

/**
 * Positive hints that indicate event pages
 */
const POSITIVE_KEYWORDS = [
  // Event-specific
  'agenda', 'programm', 'programme', 'schedule', 'timetable', 'zeitplan',
  'ticket', 'tickets', 'register', 'registration', 'anmelden', 'anmeldung',
  'venue', 'location', 'veranstaltungsort', 'ort',
  
  // Event types
  'veranstaltung', 'konferenz', 'conference', 'summit', 'seminar', 
  'workshop', 'symposium', 'congress', 'kongress', 'tagung',
  
  // Speakers/Content
  'referenten', 'sprecher', 'speakers', 'presenters', 'faculty',
  'keynote', 'sessions', 'tracks', 'vorträge'
];

/**
 * Classify a page based on URL and content
 */
export function classifyPageType(
  url: string,
  title?: string | null,
  content?: string | null
): PageTypeResult {
  const urlLower = url.toLowerCase();
  const titleLower = title?.toLowerCase() || '';
  const contentLower = content?.toLowerCase().substring(0, 5000) || ''; // First 5KB only
  
  const combined = `${urlLower} ${titleLower} ${contentLower}`;
  
  let score = 0;
  const reasons: string[] = [];
  
  // Check for negative keywords (high weight)
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (urlLower.includes(keyword)) {
      score -= 10;
      reasons.push(`URL contains negative: ${keyword}`);
    } else if (titleLower.includes(keyword)) {
      score -= 7;
      reasons.push(`Title contains negative: ${keyword}`);
    } else if (contentLower.includes(keyword) && 
               contentLower.indexOf(keyword) < 1000) { // Near top of content
      score -= 3;
      reasons.push(`Content contains negative: ${keyword}`);
    }
  }
  
  // Early exit for clearly negative pages
  if (score <= -15) {
    const type = determinetype(urlLower, titleLower);
    return {
      isEvent: false,
      confidence: 0.9,
      reason: `Strong negative signals: ${reasons.slice(0, 2).join(', ')}`,
      type
    };
  }
  
  // Check for positive keywords
  for (const keyword of POSITIVE_KEYWORDS) {
    if (urlLower.includes(keyword)) {
      score += 8;
      reasons.push(`URL contains positive: ${keyword}`);
    } else if (titleLower.includes(keyword)) {
      score += 6;
      reasons.push(`Title contains positive: ${keyword}`);
    } else if (contentLower.includes(keyword)) {
      score += 2;
      reasons.push(`Content contains positive: ${keyword}`);
    }
  }
  
  // Check for structured data
  if (contentLower.includes('schema.org/event') || 
      contentLower.includes('"@type":"event"')) {
    score += 15;
    reasons.push('Has schema.org/Event markup');
  }
  
  // Check for date patterns (strong indicator)
  const hasDatePattern = /\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}/.test(combined) ||
                         /\d{4}-\d{2}-\d{2}/.test(combined) ||
                         /(january|february|march|april|may|june|july|august|september|october|november|december|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+\d{1,2}/i.test(combined);
  
  if (hasDatePattern) {
    score += 5;
    reasons.push('Contains date patterns');
  }
  
  // Check if it's a list/directory page (lower confidence)
  const isListPage = /\/(events?|veranstaltungen|calendar|kalender)(\/|$)/.test(urlLower) &&
                     !/(\/\d+\/|\/[a-z]+-\d+)/.test(urlLower); // Not a specific event ID
  
  if (isListPage) {
    score -= 5;
    reasons.push('Appears to be a list page');
  }
  
  // Determine result
  const isEvent = score > 5;
  const confidence = Math.min(Math.abs(score) / 20, 0.95);
  const type = determinetype(urlLower, titleLower);
  
  return {
    isEvent,
    confidence,
    reason: reasons.slice(0, 3).join('; ') || 'No clear signals',
    type: isEvent ? 'event' : type
  };
}

/**
 * Determine specific page type
 */
function determineType(url: string, title: string): 'static' | 'list' | 'legal' | 'blog' | 'unknown' {
  const combined = `${url} ${title}`;
  
  if (/(terms|privacy|legal|impressum|agb|datenschutz|cookie)/.test(combined)) {
    return 'legal';
  }
  
  if (/(blog|news|article|post)/.test(combined)) {
    return 'blog';
  }
  
  if (/(event-list|all-events|calendar|upcoming)/.test(combined)) {
    return 'list';
  }
  
  if (/(about|contact|team|jobs|careers)/.test(combined)) {
    return 'static';
  }
  
  return 'unknown';
}

/**
 * Quick check if URL is obviously non-event
 */
export function isObviouslyNonEvent(url: string): boolean {
  const urlLower = url.toLowerCase();
  
  const obviousNegative = [
    '/terms', '/privacy', '/legal', '/impressum', '/agb',
    '/datenschutz', '/cookie', '/disclaimer',
    '/jobs', '/careers', '/press', '/blog', '/news',
    '/about', '/contact', '/team'
  ];
  
  return obviousNegative.some(pattern => urlLower.includes(pattern));
}

