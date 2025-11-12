/**
 * Search Pipeline Configuration
 * Controls quality gates, auto-expansion, and content filtering
 */

export const SearchCfg = {
  // Minimum solid hits before auto-expanding date window
  minSolidHits: Number(process.env.MIN_SOLID_HITS ?? 3),
  
  // Voyage rerank limits
  maxVoyageDocs: Number(process.env.RERANK_MAX_DOCS ?? 40),
  voyageTopK: Number(process.env.RERANK_TOP_K ?? 12),
  
  // Auto-expand date window if insufficient results
  allowAutoExpand: (process.env.AUTO_EXPAND ?? "true") === "true",
  
  // Quality score weights (must sum to ~1.0)
  w: {
    officialDomain: 0.15,    // Organizer site vs aggregator
    hasSpeakerPage: 0.20,    // Has dedicated speaker/referenten section
    deHostOrLang: 0.10,      // German targeting (TLD, city, venue)
    dateInRange: 0.25,       // Event date within search window
    hasVenueOrCity: 0.15,    // Physical location present
    speakersCount: 0.15      // Sufficient speakers identified
  },
  
  // Quality thresholds
  minQualityToExtract: Number(process.env.MIN_QUALITY_TO_EXTRACT ?? 0.55),
  minSpeakersForSolid: Number(process.env.MIN_SPEAKERS_FOR_SOLID ?? 2),
  
  // Aggregator domains to filter before LLM calls
  aggregators: [
    "vendelux.com",
    "internationalconferencealerts.com",
    "10times.com",
    "allevents.in",
    "eventbrite.com",
    "eventbrite.de",
    "eventbrite.co.uk",
    "meetup.com",
    "conferencealert.com",
    "conferencealerts.co.in",
    "allconferencealert.com",
    "freeconferencealerts.com",
    "linkedin.com",
    "facebook.com",
    "x.com",
    "twitter.com",
    "conference-service.com",
    "conference2go.com",
    "eventora.com",
    "eventsworld.com",
    "globalriskcommunity.com",
    "cvent.com",
    "conferenceineurope.net",
    "conferenceineurope.org",
    "researchbunny.com",
    "globalli.io"
  ],
  
  // Phrases indicating bad/irrelevant content
  badPhrases: [
    "page not found",
    "404",
    "general terms and conditions",
    "allgemeine geschäftsbedingungen",
    "agb",
    "impressum only",
    "read more",
    "privacy policy",
    "datenschutzerklärung",
    "cookie settings",
    "cookie policy",
    "cookies verwalten",
    "error occurred",
    "access denied",
    "permission denied",
    "unter construction",
    "coming soon",
    "bald verfügbar"
  ],
  
  // Voyage rerank micro-biases
  bias: {
    deTLD: 0.05,           // Boost for .de domains
    speakerPath: 0.05      // Boost for speaker/agenda paths
  },
  
  // Backstop: keep one aggregator if too few non-aggregators
  minNonAggregatorUrls: 6,
  maxBackstopAggregators: 1
} as const;

/**
 * Speaker section path patterns (case-insensitive)
 */
export const SPEAKER_PATH_PATTERNS = [
  /\/speakers?\b/i,
  /\/referenten?\b/i,
  /\/sprecher\b/i,
  /\/faculty\b/i,
  /\/presenters?\b/i,
  /\/programm\b/i,
  /\/program\b/i,
  /\/agenda\b/i,
  /\/schedule\b/i
];

/**
 * Official domain heuristics
 */
export const OFFICIAL_HINTS = /\b(impressum|kontakt|about us|über uns|veranstalter|organizer|anmeldung|registration)\b/i;
export const BLOG_HINTS = /\b(blog|news|press release|pressemitteilung|artikel)\b/i;
export const DE_HOST_PATTERN = /\.de$/i;
export const DE_CITY_PATTERN = /\b(berlin|münchen|munich|frankfurt|köln|cologne|hamburg|stuttgart|düsseldorf|leipzig|nürnberg|nuremberg|hannover|essen|dortmund|bonn|mannheim|karlsruhe|wiesbaden|augsburg|freiburg|mainz|erfurt|rostock|kiel|lübeck|halle|magdeburg|braunschweig|chemnitz|aachen|krefeld|mönchengladbach|gelsenkirchen|wuppertal|bielefeld|bochum|münster|heidelberg|darmstadt|regensburg|ingolstadt|würzburg|ulm|heilbronn|pforzheim|offenbach|reutlingen|bottrop|göttingen|recklinghausen|bremerhaven|erlangen|trier|jena|salzgitter|hildesheim|kaiserslautern|witten|iserlohn|gütersloh|marl|schwerin|lünen|esslingen|düren|solingen|ludwigshafen|ratingen|velbert|wilhelmshaven|cottbus|gladbeck|dormagen|konstanz|siegen|moers|bergisch|bamberg|gießen|fulda|koblenz|plauen|neubrandenburg|stralsund|zwickau|delmenhorst|minden|gera|bayreuth|landshut|brandenburg|ludwigsburg|wolfsburg|neuwied|celle|remscheid|kassel|weimar|potsdam|schwerin|dessau)\b/i;

