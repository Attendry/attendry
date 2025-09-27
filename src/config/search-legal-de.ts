/**
 * German Legal Events Search Configuration
 * 
 * This file contains search terms, domains, and filters specifically
 * optimized for finding legal and compliance events in Germany.
 */

export const COUNTRY = 'Germany';
export const COUNTRY_CODE = 'DE';
export const LANGS = ['de', 'en']; // prefer German

export const LEGAL_EVENT_TERMS = [
  '"Rechtskonferenz"', 'Rechtskonferenz', 'Rechtskongress', 'Rechtsforum',
  'Compliance Konferenz', 'Compliance Konferenz', 'Compliance-Tagung',
  'juristische Tagung', 'juristische Fortbildung', 'Fachkonferenz',
  'Legal Operations', 'eDiscovery', '"E-Discovery"', 'Interne Untersuchung',
  'Geldwäsche', 'Forensik', 'Datenschutz', 'GDPR', 'DSGVO', 'Whistleblowing',
  'Wirtschaftsstrafrecht', 'Corporate Investigations'
];

export const EVENT_TERMS = [
  'Konferenz', 'Kongress', 'Tagung', 'Seminar', 'Workshop', 'Forum', 'Summit',
  'Fachtag', 'Fachveranstaltung', 'Fortbildung', 'Weiterbildung', 'Symposium',
  'Event', 'Veranstaltung'
];

export const EXCLUDES = [
  'football', 'music', 'festival', 'party', 'tourism', 'nerja', 'student news',
  'lottery', 'giveaway', 'sports', 'entertainment'
];

export const DOMAIN_ALLOWLIST = [
  'beck-akademie.de', 'beck-community.de', 'hugendubel.de/veranstaltungen',
  'dav.de', 'anwaltverein.de', 'uni-koeln.de', 'uni-muenchen.de',
  'uni-frankfurt.de', 'bdr-legal.de', 'forum-institut.de', 'euroforum.de',
  'handelsblatt.com/veranstaltungen', 'nwjv.de', 'dfk-verein.de',
  'hugo-mueller.de/veranstaltungen', 'juraforum.de', 'juve.de/termine',
  'zfbf.de', 'ComplianceNetzwerk.de', 'bitkom.org/Veranstaltungen',
  'dai.de/veranstaltungen', 'dgpuk.de/veranstaltungen'
];

export const CITY_LIST_DE = [
  'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf',
  'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg',
  'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster', 'Karlsruhe',
  'Mannheim', 'Augsburg', 'Wiesbaden', 'Gelsenkirchen', 'Mönchengladbach',
  'Braunschweig', 'Chemnitz', 'Kiel', 'Aachen', 'Halle', 'Magdeburg', 'Freiburg',
  'Krefeld', 'Lübeck', 'Oberhausen', 'Erfurt', 'Mainz', 'Rostock', 'Kassel',
  'Hagen', 'Hamm', 'Saarbrücken', 'Mülheim', 'Potsdam', 'Ludwigshafen', 'Oldenburg',
  'Leverkusen', 'Osnabrück', 'Solingen', 'Heidelberg', 'Herne', 'Neuss', 'Darmstadt',
  'Paderborn', 'Regensburg', 'Ingolstadt', 'Würzburg', 'Fürth', 'Wolfsburg',
  'Offenbach', 'Ulm', 'Heilbronn', 'Pforzheim', 'Göttingen', 'Bottrop', 'Trier',
  'Recklinghausen', 'Reutlingen', 'Bremerhaven', 'Koblenz', 'Bergisch Gladbach',
  'Jena', 'Remscheid', 'Erlangen', 'Moers', 'Siegen', 'Hildesheim', 'Salzgitter'
];

export const PREFERRED_URL_PATHS = [
  '/event/', '/veranstaltung/', '/termine/', '/tagung/', '/konferenz/',
  '/seminar/', '/workshop/', '/fortbildung/', '/kongress/', '/forum/',
  '/summit/', '/symposium/', '/fachtag/', '/fachveranstaltung/'
];

export const NOISE_URL_PATHS = [
  '/tag/nerja/', '/blog/', '/news/', '/article/', '/press/', '/media/',
  '/gallery/', '/photos/', '/videos/', '/about/', '/contact/', '/imprint/',
  '/privacy/', '/terms/', '/sitemap/', '/search/', '/category/'
];

// Search thresholds
export const SEARCH_THRESHOLDS = {
  MIN_RESULTS_TIER_A: 10,
  MIN_RESULTS_TIER_B: 5,
  MIN_FINAL_RESULTS: 5,
  MAX_QUERY_LENGTH: 256,
  MAX_BATCH_SIZE: 5,
  MAX_POLL_MS: 25000,
  MAX_CONTENT_SIZE_MB: 1.5,
  MAX_LINKS_PER_PAGE: 200,
  MIN_EVENT_CONFIDENCE: 0.6,
  MIN_LEGAL_CONFIDENCE: 0.5
};

// Date patterns for German events
export const DATE_PATTERNS = [
  // dd.mm.yyyy
  /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
  // dd. MMMM yyyy
  /(\d{1,2})\.\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/gi,
  // dd. MMMM yyyy (without spaces)
  /(\d{1,2})\.(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)(\d{4})/gi,
  // dd–dd MMM yyyy
  /(\d{1,2})–(\d{1,2})\s+(Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\s+(\d{4})/gi,
  // ISO format
  /(\d{4})-(\d{2})-(\d{2})/g
];

export const GERMAN_MONTHS = {
  'Januar': '01', 'Februar': '02', 'März': '03', 'April': '04',
  'Mai': '05', 'Juni': '06', 'Juli': '07', 'August': '08',
  'September': '09', 'Oktober': '10', 'November': '11', 'Dezember': '12',
  'Jan': '01', 'Feb': '02', 'Mär': '03', 'Apr': '04',
  'Mai': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
  'Sep': '09', 'Okt': '10', 'Nov': '11', 'Dez': '12'
};
