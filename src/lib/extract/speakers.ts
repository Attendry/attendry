/**
 * Speaker extraction with deterministic person validation
 * Filters out non-person entities (events, organizations, UI elements)
 * Tuned for German and English conference pages
 */

export type RawSpeaker = { 
  name: string; 
  role?: string; 
  org?: string; 
  url?: string 
};

export type Speaker = RawSpeaker & { 
  is_person: boolean; 
  reasons?: string[] 
};

/** Academic/professional honorifics (DE/EN) */
const HONORIFICS = /\b(Dr\.?|Prof\.?|RA|Rechtsanwalt|Rechtsanwältin|LL\.M\.|LLM|MBA|PhD|Ph\.D\.|M\.Sc\.|B\.Sc\.)\b/i;

/** Event/session/org keywords that indicate non-person */
const NON_PERSON_TERMS = /\b(Summit|Forum|Panel|Track|Keynote|Workshop|Session|Privacy|Compliance|Risk|Week|Faculty|Operations|Practices?|User|National|Symposium|Lawyers?|Conference|Konferenz|Tagung|Seminar|Day|Resource|Center|Centre|Library|Portal|Hub|Network|Instructor|Trainer|Teacher|Committee|Board|Team|Group|Department|Association|Institute|Foundation|Council|Society|Partner|Discovery|eDiscovery|Litigation|Investigation|Audit|Governance|Regulation|Technology|Management|Solution|Service|Program|Project|Strategy|Initiative)\b/i;

/** Action verb phrases that indicate topics/sessions, not people */
const ACTION_VERBS = /^(Negotiating|Managing|Implementing|Understanding|Navigating|Leading|Building|Developing|Creating|Exploring|Establishing|Designing|Conducting|Planning|Organizing|Facilitating|Moderating|Presenting|Discussing|Analyzing|Reviewing|Examining|Assessing|Evaluating)\b/i;

/** Organization suffixes */
const ORG_SUFFIX = /\b(GmbH|AG|SE|KG|UG|Inc\.?|LLC|LLP|PLC|S\.?A\.?|S\.?p\.?A\.?|GmbH & Co\.? KG|e\.V\.|Corp\.?|Ltd\.?|Limited)\b/i;

/** CTA/UI elements that should never be speakers */
const UI_ELEMENTS = /\b(Reserve|Register|Book|Ticket|Sign\s*Up|Learn\s*More|Read\s*More|View\s*More|Click\s*Here|Download|Subscribe|Join|Enroll|Contact|Submit|Apply|Now|Today|Share|Save)\b/i;

/** Name shape: 2-4 capitalized tokens, allow hyphens, particles */
const NAME_PATTERN = /^(?:[A-ZÄÖÜ][a-zäöüß\-']+)(?:\s+(?:von|van|de|da|di|del|der|den|la|le|zu|zur))?(?:\s+[A-ZÄÖÜ][a-zäöüß\-']+){1,3}$/;

/** Common German and English given names (seed list, extend over time) */
const GIVEN_SEEDS = [
  // German
  'Anna', 'Anne', 'Anja', 'Andrea', 'Benjamin', 'Bernd', 'Christian', 'Christina', 
  'Christoph', 'Claudia', 'Daniel', 'David', 'Denis', 'Dirk', 'Elena', 'Elisabeth',
  'Felix', 'Frank', 'Hannah', 'Hans', 'Heike', 'Hendrik', 'Jan', 'Jana', 'Jens',
  'Jonas', 'Julia', 'Jürgen', 'Kai', 'Katja', 'Klaus', 'Lena', 'Lisa', 'Lukas',
  'Manfred', 'Maria', 'Marion', 'Markus', 'Martin', 'Matthias', 'Michael', 'Monika',
  'Nicole', 'Nina', 'Oliver', 'Patrick', 'Paul', 'Peter', 'Petra', 'Ralf', 'Robert',
  'Sabine', 'Sandra', 'Sarah', 'Sebastian', 'Silke', 'Stefan', 'Stefanie', 'Susanne',
  'Sven', 'Thomas', 'Thorsten', 'Tobias', 'Udo', 'Ulrich', 'Ulrike', 'Uwe', 'Werner',
  'Wolfgang',
  // English
  'Alexander', 'Alexandra', 'Alice', 'Andrew', 'Angela', 'Anthony', 'Barbara', 'Brian',
  'Carol', 'Charles', 'Christopher', 'Daniela', 'Deborah', 'Donald', 'Dorothy', 'Edward',
  'Elizabeth', 'Emily', 'Emma', 'Eric', 'George', 'Helen', 'James', 'Jason', 'Jennifer',
  'Jessica', 'John', 'Jonathan', 'Joseph', 'Joshua', 'Karen', 'Kathy', 'Kenneth', 'Kevin',
  'Laura', 'Linda', 'Margaret', 'Mark', 'Mary', 'Matthew', 'Melissa', 'Michelle', 'Nancy',
  'Patricia', 'Rachel', 'Rebecca', 'Richard', 'Ronald', 'Ruth', 'Samantha', 'Scott',
  'Sharon', 'Sophia', 'Stephen', 'Steven', 'Susan', 'Timothy', 'William'
];

/**
 * Deterministic person validation
 * Checks name shape, keywords, and signals from role/org fields
 * 
 * @param name - Speaker name to validate
 * @param role - Optional job title/role
 * @param org - Optional organization
 * @returns Validation result with reasons
 */
export function isLikelyPerson(
  name: string, 
  role?: string, 
  org?: string
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const n = (name || '').trim();
  
  // Empty or too short
  if (!n || n.length < 4) {
    return { ok: false, reasons: ['empty_or_short'] };
  }
  
  // Contains UI/CTA keywords
  if (UI_ELEMENTS.test(n)) {
    return { ok: false, reasons: ['ui_element'] };
  }
  
  // Starts with action verb (e.g., "Negotiating Discovery", "Managing Compliance")
  if (ACTION_VERBS.test(n)) {
    return { ok: false, reasons: ['action_verb_phrase'] };
  }
  
  // Contains non-person keywords (Summit, Forum, Discovery, etc.)
  if (NON_PERSON_TERMS.test(n)) {
    return { ok: false, reasons: ['non_person_keyword'] };
  }
  
  // Contains organization suffix in name itself
  if (ORG_SUFFIX.test(n)) {
    return { ok: false, reasons: ['org_suffix_in_name'] };
  }
  
  // Check name shape (capitalized, proper structure)
  const nameLike = NAME_PATTERN.test(n) || HONORIFICS.test(n);
  if (!nameLike) {
    reasons.push('fails_name_shape');
  }
  
  // Soft signal: contains common given name
  const hasGiven = GIVEN_SEEDS.some(g => 
    new RegExp(`\\b${g}\\b`, 'i').test(n)
  );
  if (!hasGiven && nameLike) {
    reasons.push('no_common_given_name');
  }
  
  // Check if name is too long (likely a sentence/title)
  const words = n.split(/\s+/);
  if (words.length > 4 || n.length > 50) {
    return { ok: false, reasons: ['name_too_long'] };
  }
  
  // Must have at least first + last name
  if (words.length < 2 && !HONORIFICS.test(n)) {
    return { ok: false, reasons: ['single_word_name'] };
  }
  
  // Org field validation (positive signal if present)
  if (org && ORG_SUFFIX.test(org)) {
    reasons.push('org_field_has_org_suffix'); // This is OK
  }
  
  // Decision: pass if name shape is good OR has common given name
  const ok = nameLike || hasGiven;
  
  return { 
    ok, 
    reasons: reasons.length ? reasons : ['passed'] 
  };
}

/**
 * Filter raw speakers to only include likely persons
 * Deduplicates by lowercase name and applies person validation
 * 
 * @param raw - Raw speaker list from extraction
 * @returns Filtered list with only validated persons
 */
export function filterSpeakers(raw: RawSpeaker[]): Speaker[] {
  const seen = new Set<string>();
  const out: Speaker[] = [];
  
  for (const s of raw) {
    const key = (s.name || '').toLowerCase().trim();
    
    // Skip empty or duplicate
    if (!key || seen.has(key)) continue;
    
    const { ok, reasons } = isLikelyPerson(s.name, s.role, s.org);
    
    if (ok) {
      out.push({ 
        ...s, 
        is_person: true, 
        reasons 
      });
      seen.add(key);
    } else {
      console.log(`[speaker-validation] Filtered out: "${s.name}" (${reasons.join(', ')})`);
    }
  }
  
  return out;
}

/**
 * Extract speaker section keywords for smart chunking
 * Returns regex patterns to identify speaker-rich sections
 */
export function getSpeakerSectionPatterns(): RegExp[] {
  return [
    /\b(speakers?|referenten?|sprecher|faculty|presenters?|panelists?|moderator|keynote)\b/i,
    /\b(about\s+(?:the\s+)?speakers?|über\s+(?:die\s+)?referenten?)\b/i,
    /\b(meet\s+(?:the\s+)?(?:speakers?|team)|lernen\s+sie\s+(?:die\s+)?referenten?\s+kennen)\b/i
  ];
}

/**
 * Check if a heading/section indicates speaker content
 * 
 * @param text - Section heading or title text
 * @returns True if likely contains speaker info
 */
export function isSpeakerSection(text: string): boolean {
  const patterns = getSpeakerSectionPatterns();
  return patterns.some(p => p.test(text));
}

