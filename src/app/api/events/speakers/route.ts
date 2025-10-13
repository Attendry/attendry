// src/app/api/events/speakers/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  SpeakerExtractionRequest, 
  SpeakerExtractionResponse, 
  ErrorResponse 
} from "@/lib/types/api";
import { SpeakerData } from "@/lib/types/core";

// ---------- Config
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari";
const MAX_CANDIDATES = 20;        // increased for better coverage
const FIRECRAWL_WAIT_MS = 3000;   // increased wait time for dynamic content
const LLM_MODEL = "gemini-1.5-pro"; // you can swap to flash for cheaper/faster
const MAX_DEPTH = 2;              // maximum crawl depth for speaker pages

// Enhanced speaker profile interface (extends base SpeakerData)
interface EnhancedSpeaker extends SpeakerData {
  // Enhanced fields
  location?: string;
  education?: string[];
  publications?: string[];
  career_history?: string[];
  social_links?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  expertise_areas?: string[];
  speaking_history?: string[];
  achievements?: string[];
  industry_connections?: string[];
  recent_news?: string[];
}

// Load speaker extraction prompt from search configuration
async function getSpeakerExtractionPrompt() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'}/api/config/search`);
    const data = await res.json();
    return data.config?.speakerPrompts?.extraction || 
      `Extract ALL speakers, presenters, panelists, and keynotes from the page(s). For each person, return:
- name: Full name (first and last name)
- org: Organization/company they work for
- title: Job title or role (if mentioned)
- speech_title: Title of their presentation/speech (if mentioned)
- session: Session name or track (if mentioned)
- bio: Brief professional bio or summary (if available)
- profile_url: LinkedIn or personal profile URL (if linked)

Look for sections with these labels in multiple languages:
English: Speakers, Presenters, Panelists, Keynotes, Moderators, Hosts, Faculty, Instructors
German: Referenten, Referent:innen, Sprecher, Vortragende, Mitwirkende, Moderatoren, Gastgeber
French: Conférenciers, Présentateurs, Panélistes, Intervenants, Modérateurs
Spanish: Ponentes, Presentadores, Panelistas, Oradores, Moderadores
Italian: Relatori, Presentatori, Panelisti, Ospiti, Moderatori
Dutch: Sprekers, Presentatoren, Panelleden, Gasten, Moderators

Also check: Agenda, Program, Schedule, Programme, Fachprogramm, Programme détaillé

IMPORTANT: 
- Only extract people who are clearly identified as speakers/presenters
- Do not invent names or information
- Skip generic entries like "TBA", "To be announced", "Speaker TBD"
- Focus on real people with actual names and organizations
- If a person appears multiple times, include them only once with the most complete information`;
  } catch (error) {
    console.warn('Failed to load speaker extraction prompt, using default:', error);
    return `Extract ALL speakers, presenters, panelists, and keynotes from the page(s). For each person, return:
- name: Full name (first and last name)
- org: Organization/company they work for
- title: Job title or role (if mentioned)
- profile_url: LinkedIn or personal profile URL (if linked)

Look for sections with these labels in multiple languages:
English: Speakers, Presenters, Panelists, Keynotes, Moderators, Hosts, Faculty, Instructors
German: Referenten, Referent:innen, Sprecher, Vortragende, Mitwirkende, Moderatoren, Gastgeber
French: Conférenciers, Présentateurs, Panélistes, Intervenants, Modérateurs
Spanish: Ponentes, Presentadores, Panelistas, Oradores, Moderadores
Italian: Relatori, Presentatori, Panelisti, Ospiti, Moderatori
Dutch: Sprekers, Presentatoren, Panelleden, Gasten, Moderators

Also check: Agenda, Program, Schedule, Programme, Fachprogramm, Programme détaillé

IMPORTANT: 
- Only extract people who are clearly identified as speakers/presenters
- Do not invent names or information
- Skip generic entries like "TBA", "To be announced", "Speaker TBD"
- Focus on real people with actual names and organizations
- If a person appears multiple times, include them only once with the most complete information`;
  }
}

// Load speaker normalization prompt from search configuration
async function getSpeakerNormalizationPrompt() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'}/api/config/search`);
    const data = await res.json();
    return data.config?.speakerPrompts?.normalization || 
      `You are an expert data normalizer specializing in speaker deduplication and quality assessment. Your task is to merge duplicate speakers and clean the data.

For each speaker, return a JSON object with these fields:
- name: Cleaned, properly formatted full name (Title Case)
- org: Organization/company name (cleaned and standardized)
- title: Job title or role (if available)
- profile_url: Best available profile URL (LinkedIn preferred)
- source_url: One representative source URL
- confidence: Quality score from 0.0 to 1.0 based on data completeness and reliability

Deduplication rules:
1. Merge speakers with similar names (account for nicknames, middle names, initials)
2. Combine information from multiple sources to create the most complete profile
3. Prefer more complete information (with org, title, profile_url)
4. Handle name variations (e.g., "Dr. John Smith" = "John Smith" = "J. Smith")

Quality scoring:
- 0.9-1.0: Complete profile with name, org, title, and profile_url
- 0.7-0.8: Good profile with name, org, and either title or profile_url
- 0.5-0.6: Basic profile with name and org
- 0.3-0.4: Minimal profile with just name
- 0.0-0.2: Invalid or incomplete data

Filter out:
- Generic entries (TBA, TBD, "Speaker", "To be announced")
- Names shorter than 2 characters
- Obviously fake or placeholder names
- Duplicate entries after normalization

Return only valid, real people who are likely to be actual event speakers.`;
  } catch (error) {
    console.warn('Failed to load speaker normalization prompt, using default:', error);
    return `You are an expert data normalizer specializing in speaker deduplication and quality assessment. Your task is to merge duplicate speakers and clean the data.

For each speaker, return a JSON object with these fields:
- name: Cleaned, properly formatted full name (Title Case)
- org: Organization/company name (cleaned and standardized)
- title: Job title or role (if available)
- profile_url: Best available profile URL (LinkedIn preferred)
- source_url: One representative source URL
- confidence: Quality score from 0.0 to 1.0 based on data completeness and reliability

Deduplication rules:
1. Merge speakers with similar names (account for nicknames, middle names, initials)
2. Combine information from multiple sources to create the most complete profile
3. Prefer more complete information (with org, title, profile_url)
4. Handle name variations (e.g., "Dr. John Smith" = "John Smith" = "J. Smith")

Quality scoring:
- 0.9-1.0: Complete profile with name, org, title, and profile_url
- 0.7-0.8: Good profile with name, org, and either title or profile_url
- 0.5-0.6: Basic profile with name and org
- 0.3-0.4: Minimal profile with just name
- 0.0-0.2: Invalid or incomplete data

Filter out:
- Generic entries (TBA, TBD, "Speaker", "To be announced")
- Names shorter than 2 characters
- Obviously fake or placeholder names
- Duplicate entries after normalization

Return only valid, real people who are likely to be actual event speakers.`;
  }
}

// ---------- Utilities
function uniq<T>(arr: T[]) { return Array.from(new Set(arr)); }
function sameHost(a: string, b: string) { try { return new URL(a).host === new URL(b).host; } catch { return false; } }
function abs(base: string, href: string) { try { return new URL(href, base).toString(); } catch { return null; } }
function stripHash(u: string) { try { const x = new URL(u); x.hash=""; return x.toString(); } catch { return u; } }
function hostname(u: string) { try { return new URL(u).hostname; } catch { return ""; } }
function clamp(s?: string | null) { return (s ?? "").replace(/\s+/g," ").trim() || null; }
function normKey(name: string, org?: string | null) { return (name.toLowerCase()+"|"+(org?.toLowerCase()||"")).normalize("NFKD"); }

function asCleanString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return null;
}

function normalizeOrg(candidate: any): string | null {
  if (!candidate) return null;
  const fields = [
    candidate.org,
    candidate.organization,
    candidate.company,
    candidate.employer,
    candidate.affiliation,
    candidate.firm,
    candidate.institution,
    candidate.organization_name,
    candidate.org_name
  ];
  for (const value of fields) {
    const str = asCleanString(value);
    if (!str) continue;
    const cleaned = clamp(str);
    if (cleaned) return cleaned;
  }
  return null;
}

function normalizeTitle(candidate: any): string | null {
  if (!candidate) return null;
  const fields = [
    candidate.title,
    candidate.job_title,
    candidate.position,
    candidate.role,
    candidate.job,
    candidate.profession,
    candidate.designation,
    candidate.heading
  ];
  for (const value of fields) {
    const str = asCleanString(value);
    if (!str) continue;
    const cleaned = clamp(str);
    if (cleaned) return cleaned;
  }
  return null;
}

function buildRawFallbackMap(raw: any[]) {
  const map = new Map<string, any[]>();
  for (const candidate of raw) {
    const name = clamp(candidate?.name);
    if (!name) continue;
    const key = normKey(name, normalizeOrg(candidate));
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(candidate);
  }
  return map;
}

// Keywords (EN/DE/FR/IT basic coverage)
const K_SPEAKER = /(speaker|speakers|referent(?:in|en|innen|:innen)?|sprecher(?:in|innen)?|vortragend|vortragende|mitwirkend|panelist|orateur|intervenant|relatori|relatore)/i;
const K_AGENDA  = /(agenda|program|programme|programm|fachprogramm|ablauf|zeitplan|schedule|programme)/i;
const K_REG     = /(register|anmeldung|anmelden|tickets?)/i;
const YEAR = /\b(20(1[7-9]|2[0-9]|3[0-5]))\b/;

// Enhanced speaker-related keywords for better discovery
const K_SPEAKER_ENHANCED = /(speakers?|referenten?|referent:innen?|sprecher?|vortragende?|presenters?|panelists?|keynotes?|moderators?|hosts?|faculty|instructors?|experts?|leaders?|guests?|lineup|line-up|roster|team|staff|bios?|profiles?|biographies?)/i;
const K_AGENDA_ENHANCED = /(agenda|programm?|fachprogramm?|schedule|timetable|programme|sessions?|workshops?|tracks?|streams?|conference|summit|meeting|event|day|morning|afternoon|evening)/i;
const K_SPEAKER_PAGES = /(speaker|presenter|panelist|keynote|moderator|host|expert|leader|guest|bio|profile|biography|about|team|staff)/i;

// Enhanced link discovery with better patterns and deeper crawling
function rankLinks(html: string, baseUrl: string, includePast: boolean) {
  const speakers: string[] = [];
  const agenda: string[] = [];
  const reg: string[] = [];
  const past: string[] = [];
  const speakerPages: string[] = [];
  
  const re = /<a\b([^>]+)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const text = m[2].replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
    const href = (attrs.match(/\bhref=["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    
    const u = abs(baseUrl, href);
    if (!u) continue;
    if (new URL(u).hash) continue;    // ignore #fragments
    if (!sameHost(u, baseUrl)) continue;
    
    const hay = (text + " " + href).toLowerCase();
    
    // Enhanced speaker detection
    if (K_SPEAKER_ENHANCED.test(hay)) { 
      speakers.push(u); 
      continue; 
    }
    
    // Enhanced agenda detection
    if (K_AGENDA_ENHANCED.test(hay)) { 
      agenda.push(u); 
      continue; 
    }
    
    // Registration pages
    if (K_REG.test(hay)) { 
      reg.push(u); 
      continue; 
    }
    
    // Individual speaker pages
    if (K_SPEAKER_PAGES.test(hay)) {
      speakerPages.push(u);
      continue;
    }
    
    // Past events
    if (includePast && YEAR.test(hay) && (K_SPEAKER_ENHANCED.test(hay) || K_AGENDA_ENHANCED.test(hay))) {
      past.push(u);
    }
  }
  
  // Prioritize speaker-related pages
  return uniq([...speakers, ...speakerPages, ...agenda, ...reg, ...past]);
}

// New function to discover speaker pages from speaker lists
async function discoverSpeakerPages(speakerListUrl: string): Promise<string[]> {
  try {
    const res = await fetch(speakerListUrl, { 
      headers: { "User-Agent": UA }, 
      cache: "no-store" 
    });
    if (!res.ok) return [];
    
    const html = await res.text();
    const speakerPages: string[] = [];
    
    // Look for links to individual speaker pages
    const re = /<a\b([^>]+)>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    
    while ((m = re.exec(html))) {
      const attrs = m[1];
      const text = m[2].replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
      const href = (attrs.match(/\bhref=["']([^"']+)["']/i) || [])[1];
      if (!href) continue;
      
      const u = abs(speakerListUrl, href);
      if (!u) continue;
      if (new URL(u).hash) continue;
      if (!sameHost(u, speakerListUrl)) continue;
      
      const hay = (text + " " + href).toLowerCase();
      
      // Look for individual speaker profile links
      if (K_SPEAKER_PAGES.test(hay) && text.length > 0 && text.length < 100) {
        speakerPages.push(u);
      }
    }
    
    return uniq(speakerPages);
  } catch (error) {
    console.warn('Failed to discover speaker pages:', error);
    return [];
  }
}

// Enhanced Google CSE: site:<host> queries to find off-nav speaker pages
async function cseSiteHunt(baseUrl: string, titleHint?: string | null) {
  const key = process.env.GOOGLE_CSE_KEY;
  if (!key) return [];
  
  const host = hostname(baseUrl);
  const allResults: string[] = [];
  
  // Multiple search queries for comprehensive coverage
  const searchQueries = [
    // Primary speaker searches
    `site:${host} (speakers OR speaker OR referenten OR referent:innen OR sprecher OR vortragende OR presenters OR panelists)`,
    // Agenda and program searches
    `site:${host} (agenda OR programm OR fachprogramm OR lineup OR line-up OR schedule OR programme)`,
    // Bio and profile searches
    `site:${host} (bios OR profiles OR biographies OR team OR staff OR experts OR faculty)`,
    // Event-specific searches
    `site:${host} (keynotes OR moderators OR hosts OR guests OR instructors)`
  ];
  
  // Add title hint to first query if available
  if (titleHint) {
    const titleTerms = titleHint.split(/\s+/).slice(0, 4).join(" ");
    searchQueries[0] += ` (${titleTerms})`;
  }
  
  // Execute all search queries
  for (const query of searchQueries) {
    try {
      const url = `https://customsearch.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&num=8`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      
      const j = await r.json();
      const items = Array.isArray(j.items) ? j.items.map((it: any) => it.link).filter(Boolean) : [];
      
      // Filter to same host and add to results
      const filteredItems = items
        .filter((u: string) => sameHost(u, baseUrl))
        .map(stripHash);
      
      allResults.push(...filteredItems);
    } catch (error) {
      console.warn('CSE search failed for query:', query, error);
      continue;
    }
  }
  
  return uniq(allResults);
}

// Enhanced Firecrawl v2 extract with better scraping options
async function firecrawlExtract(urls: string[]) {
  const key = process.env.FIRECRAWL_KEY;
  if (!key || urls.length === 0) return { speakers: [], sources: [] as string[], note: key ? undefined : "no FIRECRAWL_KEY" };
  
  // console.log(`[FIRECRAWL] Starting extraction for ${urls.length} URLs:`, urls.slice(0, 3));

  const extractionPrompt = `Extract all speakers, presenters, moderators, or panelists listed on these pages.

For every person, return:
- name: Full name of the person (required)
- organization: Current company/employer/firm/affiliation (required when mentioned anywhere nearby)
- title: Current job title or role (required when mentioned anywhere nearby)
- role: Role text if it differs from title (optional)
- company: Company text if it differs from organization (optional)
- affiliation: Department/practice group/association reference (optional)
- context: Quote the sentence/bullet that mentions them (optional)

Use surrounding headings, bios, captions, footers, or speaker lists to capture organization and title strings exactly as written. If multiple variations exist, choose the most complete form. Do not leave organization/title empty when the page implies or states them ("Partner, DLA Piper" → organization "DLA Piper", title "Partner").

Return an array of speaker objects.`;

  const requestBody = {
    urls,
    schema: {
      type: "object",
      properties: {
        speakers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              organization: { type: "string" },
              title: { type: "string" },
              role: { type: "string" },
              company: { type: "string" },
              affiliation: { type: "string" },
              org: { type: "string" },
              job_title: { type: "string" },
              position: { type: "string" },
              context: { type: "string" }
            },
            required: ["name"],
            additionalProperties: true
          }
        }
      },
      required: ["speakers"]
    },
    prompt: extractionPrompt,
    showSources: true,
    scrapeOptions: {
      formats: ["html", "markdown"],
      onlyMainContent: false,
      waitFor: 2500,
      blockAds: true,
      removeBase64Images: true
    },
    ignoreInvalidURLs: true
  };

  // console.log(`[FIRECRAWL] Request body prepared, sending to Firecrawl API...`);
  
  const kicked = await fetch("https://api.firecrawl.dev/v2/extract", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  }).then(r => r.json()).catch(() => ({} as any));

  const id = kicked?.id;
  if (!id) return { speakers: [], sources: [], note: "no job id" };

  // poll
  const base = "https://api.firecrawl.dev/v2/extract";
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const start = Date.now(); const timeout = 30000; const step = 1000;
  const sources: string[] = [];
  let speakers: any[] = [];

  while (Date.now() - start < timeout) {
    const j = await fetch(`${base}/${id}`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => null);
    if (!j) break;
    
    if (j.status === "completed") {
      // Handle both old format (results array) and new format (direct data)
      let allSpeakers: any[] = [];
      let allSources: string[] = [];
      
      if (j.data?.results && Array.isArray(j.data.results)) {
        // Old format: results array
        for (const r of j.data.results) {
          const arr = Array.isArray(r?.data?.speakers) ? r.data.speakers : [];
          
          for (const s of arr) {
            const name = clamp(s?.name);
            if (!name) continue;
          const orgCandidates = [
            s?.org,
            s?.organization,
            s?.company,
            s?.employer,
            s?.affiliation,
            s?.firm,
            s?.institution,
            s?.organization_name
          ];
          const titleCandidates = [
            s?.title,
            s?.job_title,
            s?.position,
            s?.role,
            s?.job,
            s?.profession,
            s?.designation
          ];
          allSpeakers.push({
            name,
            org: clamp(orgCandidates.find((x: any) => clamp(x))) || null,
            title: clamp(titleCandidates.find((x: any) => clamp(x))) || null,
            profile_url: s?.profile_url || s?.url || null,
            source_url: r?.url || null,
            extraction_context: clamp(s?.context || s?.snippet || s?.summary) || null
          });
          }
          if (r?.url) allSources.push(r.url);
        }
      } else if (j.data?.speakers && Array.isArray(j.data.speakers)) {
        // New format: direct speakers array
        
        for (const s of j.data.speakers) {
          const name = clamp(s?.name);
          if (!name) continue;
          const orgCandidates = [
            s?.org,
            s?.organization,
            s?.company,
            s?.employer,
            s?.affiliation,
            s?.firm,
            s?.institution,
            s?.organization_name
          ];
          const titleCandidates = [
            s?.title,
            s?.job_title,
            s?.position,
            s?.role,
            s?.job,
            s?.profession,
            s?.designation
          ];
          allSpeakers.push({
            name,
            org: clamp(orgCandidates.find((x: any) => clamp(x))) || null,
            title: clamp(titleCandidates.find((x: any) => clamp(x))) || null,
            profile_url: s?.profile_url || s?.url || null,
            source_url: urls[0] || null, // Use first URL as source
            extraction_context: clamp(s?.context || s?.snippet || s?.summary) || null
          });
        }
        
        // Extract sources from the sources object if available
        if (j.sources) {
          for (const [key, sourceUrls] of Object.entries(j.sources)) {
            if (Array.isArray(sourceUrls)) {
              allSources.push(...sourceUrls);
            }
          }
        }
      }
      
      speakers = allSpeakers;
      sources.push(...allSources);
      break;
    }
    if (j.status === "failed" || j.status === "cancelled") break;
    await new Promise(res => setTimeout(res, step));
  }

  
  return { speakers, sources: uniq(sources) };
}

// Enhanced speaker validation and scoring
function calculateSpeakerConfidence(speaker: any): number {
  let confidence = 0.5; // base confidence
  
  // Name quality scoring
  const name = speaker.name || "";
  if (name.length >= 3) confidence += 0.1;
  if (name.length >= 5) confidence += 0.1;
  if (/^[A-Za-z\s\-'\.]+$/.test(name)) confidence += 0.1; // valid name characters
  if (name.split(' ').length >= 2) confidence += 0.1; // has first and last name
  
  // Organization presence
  if (speaker.org && speaker.org.trim().length > 0) confidence += 0.1;
  
  // Title/role presence
  if (speaker.title && speaker.title.trim().length > 0) confidence += 0.1;
  
  // Profile URL presence
  if (speaker.profile_url && speaker.profile_url.trim().length > 0) confidence += 0.1;
  
  // Additional fields boost confidence
  if (speaker.bio && speaker.bio.trim().length > 0) confidence += 0.05;
  if (speaker.expertise && speaker.expertise.trim().length > 0) confidence += 0.05;
  if (speaker.linkedin && speaker.linkedin.trim().length > 0) confidence += 0.05;
  if (speaker.twitter && speaker.twitter.trim().length > 0) confidence += 0.05;
  
  // Penalize obviously invalid names
  if (name.toLowerCase().includes('speaker') || 
      name.toLowerCase().includes('tba') || 
      name.toLowerCase().includes('tbd') ||
      name.toLowerCase().includes('to be announced') ||
      name.toLowerCase().includes('coming soon') ||
      name.length < 2) {
    confidence = 0.1;
  }
  
  return Math.min(confidence, 1.0);
}

// Enhanced speaker enrichment using Gemini API
async function enrichSpeakersWithGemini(speakers: any[]): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || speakers.length === 0) return speakers;
  
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genai = new GoogleGenerativeAI(apiKey);
    
    const enrichmentPrompt = `You are an expert at enriching speaker profiles with additional information. For each speaker, analyze their name, organization, and title to infer additional details.

For each speaker, return a JSON object with these fields:
- name: Cleaned and properly formatted name
- org: Organization/company name (cleaned)
- title: Job title or role (cleaned)
- bio: Brief professional biography (2-3 sentences, inferred from context)
- expertise: Key areas of expertise (comma-separated)
- linkedin: LinkedIn profile URL if mentioned or can be inferred
- twitter: Twitter handle if mentioned
- profile_url: Best available profile URL
- confidence: Quality score from 0.0 to 1.0

Guidelines:
- Only infer information that is reasonable based on the provided data
- Don't make up specific details
- Focus on professional context and industry relevance
- Keep bios concise and professional
- Extract expertise areas from titles and organizations
- Return only valid, real people

Return a JSON array of enriched speaker objects.`;

    const input = { speakers: speakers.slice(0, 50) }; // Limit for API efficiency
    
    const model = genai.getGenerativeModel({ model: LLM_MODEL });
    const resp = await model.generateContent(`${enrichmentPrompt}\n\nGiven:\n${JSON.stringify(input)}\n\nReturn JSON array only.`);
    
    const response = await resp.response;
    const text = response.text() || "";
    if (!text) return speakers;
    
    // Clean the response text
    let cleanText = text.trim();
    
    // Remove markdown code blocks if present
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Remove any leading/trailing text that's not JSON
    const jsonStart = cleanText.indexOf('[');
    const jsonEnd = cleanText.lastIndexOf(']') + 1;
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleanText = cleanText.substring(jsonStart, jsonEnd);
    }
    
    const enriched = JSON.parse(cleanText);
    if (!Array.isArray(enriched)) return speakers;
    
    // Merge enriched data with original speakers
    return enriched.map((enrichedSpeaker: any, index: number) => {
      const original = speakers[index] || {};
      return {
        ...original,
        ...enrichedSpeaker,
        confidence: Math.max(
          calculateSpeakerConfidence(enrichedSpeaker),
          original.confidence || 0.5
        )
      };
    });
    
  } catch (error) {
    console.warn('Speaker enrichment failed:', error);
    return speakers;
  }
}

// Enhanced deduplication with fuzzy matching
function fuzzyMatchNames(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const n2 = name2.toLowerCase().replace(/[^\w\s]/g, '').trim();
  
  // Exact match
  if (n1 === n2) return true;
  
  // Check if one name contains the other (for partial matches)
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Check for common name variations
  const variations1 = n1.split(' ');
  const variations2 = n2.split(' ');
  
  // If both have at least 2 parts, check if they share significant parts
  if (variations1.length >= 2 && variations2.length >= 2) {
    const commonParts = variations1.filter(part => 
      variations2.some(part2 => part.length > 2 && part2.length > 2 && 
        (part.includes(part2) || part2.includes(part)))
    );
    return commonParts.length >= 1;
  }
  
  return false;
}

// ---------- Enhanced LLM normalization (merge duplicates, clean casing, confidence)
async function normalizeWithLLM(raw: any[]) {
  if (!raw.length) return [];
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fallback: basic normalization without LLM
    return raw.map(speaker => ({
      ...speaker,
      confidence: calculateSpeakerConfidence(speaker)
    }));
  }
  
  const genai = new GoogleGenerativeAI(apiKey);
  const system = await getSpeakerNormalizationPrompt();

  const input = {
    speakers: raw.slice(0, 100) // cap to keep the prompt lean
  };

  try {
    const model = genai.getGenerativeModel({ model: LLM_MODEL });
    const resp = await model.generateContent(`${system}\n\nGiven:\n${JSON.stringify(input) }\n\nReturn JSON array in 'application/json' only.`);
    const response = await resp.response;
    const text = response.text() || "";
    if (!text) return raw;
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) return raw;
    
    const rawFallbacks = buildRawFallbackMap(raw);

    // Enhanced processing with confidence scoring and fuzzy deduplication
    const seen = new Set<string>();
    const out: any[] = [];
    
    for (const s of arr) {
      const name = clamp(s?.name); 
      if (!name) continue;
      
      const normalizedOrg = normalizeOrg(s);
      const normalizedTitle = normalizeTitle(s);

      const fallbackKey = normKey(name, normalizedOrg);
      const rawCandidates = [
        ...(rawFallbacks.get(fallbackKey) || []),
        ...(rawFallbacks.get(normKey(name, null)) || [])
      ];

      const fallback = rawCandidates.find(candidate => {
        const candidateName = clamp(candidate?.name);
        if (!candidateName) return false;
        if (!fuzzyMatchNames(name, candidateName)) return false;
        const candidateOrg = normalizeOrg(candidate);
        if (normalizedOrg && candidateOrg) {
          return normalizedOrg.toLowerCase() === candidateOrg.toLowerCase();
        }
        return true;
      }) || rawCandidates.find(candidate => {
        const candidateName = clamp(candidate?.name);
        if (!candidateName) return false;
        return fuzzyMatchNames(name, candidateName);
      });

      const org = normalizedOrg || (fallback ? normalizeOrg(fallback) : null);
      const title = normalizedTitle || (fallback ? normalizeTitle(fallback) : null);
      const profileUrl =
        (typeof s?.profile_url === "string" ? s.profile_url.trim() : null) ||
        (fallback?.profile_url ? String(fallback.profile_url).trim() : null) ||
        (fallback?.url ? String(fallback.url).trim() : null);
      const sourceUrl =
        (typeof s?.source_url === "string" ? s.source_url.trim() : null) ||
        (fallback?.source_url ? String(fallback.source_url).trim() : null);
      
      // Calculate confidence score
      const confidence = calculateSpeakerConfidence({ name, org, title, profile_url: profileUrl });
      
      // Skip low-confidence speakers
      if (confidence < 0.3) continue;
      
      // Enhanced deduplication with fuzzy matching
      const key = normKey(name, org);
      const isDuplicate = Array.from(seen).some(existingKey => {
        const [existingName, existingOrg] = existingKey.split('|');
        return fuzzyMatchNames(name, existingName) && 
               (!org || !existingOrg || org.toLowerCase() === existingOrg.toLowerCase());
      });
      
      if (isDuplicate) continue;
      seen.add(key);
      
      out.push({
        name,
        org,
        title,
        profile_url: profileUrl,
        source_url: sourceUrl,
        confidence: Math.max(confidence, typeof s?.confidence === "number" ? s.confidence : 0.5)
      });
    }
    
    // Sort by confidence score (highest first)
    return out.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  } catch {
    // Fallback: basic normalization without LLM
    return raw.map(speaker => ({
      ...speaker,
      confidence: calculateSpeakerConfidence(speaker)
    })).sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  }
}

// Comprehensive speaker research and enrichment
async function researchSpeakerProfile(speaker: any): Promise<EnhancedSpeaker> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const googleKey = process.env.GOOGLE_CSE_KEY;
  const googleCx = process.env.GOOGLE_CSE_CX;
  
  if (!geminiKey || !googleKey || !googleCx) {
    // Missing API keys for speaker research, returning basic profile
    return {
      ...speaker,
      confidence: 0.5
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: LLM_MODEL });

    // Search for additional information about the speaker
    const searchQuery = `"${speaker.name}" "${speaker.org}" ${speaker.title || ""} linkedin profile bio`;
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&q=${encodeURIComponent(searchQuery)}&num=5`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    const searchResults = searchData.items || [];

    // Create comprehensive research prompt
    const researchPrompt = `You are an expert executive intelligence researcher with access to professional databases, LinkedIn, company websites, and industry publications. Conduct a thorough investigation of this professional and provide comprehensive intelligence.

TARGET PROFILE:
Name: ${speaker.name}
Current Organization: ${speaker.org}
Current Title: ${speaker.title || "Not specified"}
Speaking Topic: ${speaker.speech_title || "Not specified"}

SEARCH RESULTS TO ANALYZE:
${searchResults.map((result: any, index: number) => 
  `${index + 1}. ${result.title} - ${result.snippet} - ${result.link}`
).join('\n')}

CONDUCT COMPREHENSIVE RESEARCH AND PROVIDE:

{
  "name": "Full professional name",
  "org": "Current organization",
  "title": "Current job title",
  "speech_title": "Title of their presentation/speech",
  "session": "Session name or track",
  "bio": "Detailed professional biography (3-4 sentences covering career highlights, expertise, and achievements)",
  "location": "Current city, Country",
  "education": [
    "MBA, Harvard Business School (2015)",
    "Bachelor of Law, University of Frankfurt (2010)"
  ],
  "publications": [
    "AI Compliance in Banking: A Practical Guide (2024)",
    "RegTech Trends and Implementation Strategies (2023)",
    "The Future of Financial Regulation (2022)"
  ],
  "career_history": [
    "Chief Compliance Officer, Deutsche Bank (2020-present)",
    "Senior Compliance Manager, Commerzbank (2018-2020)",
    "Compliance Analyst, BaFin (2015-2018)"
  ],
  "social_links": {
    "linkedin": "https://linkedin.com/in/...",
    "twitter": "@handle",
    "website": "https://personal-website.com"
  },
  "expertise_areas": [
    "Financial Compliance",
    "RegTech Implementation",
    "Risk Management",
    "AI in Banking"
  ],
  "speaking_history": [
    "Keynote: AI Compliance Summit 2024",
    "Panel: RegTech Conference 2023",
    "Workshop: Banking Innovation Forum 2022"
  ],
  "achievements": [
    "Led compliance transformation at Deutsche Bank",
    "Published 15+ articles on financial regulation",
    "Recognized as Top 40 Under 40 in Compliance"
  ],
  "industry_connections": [
    "Member of German Banking Association",
    "Board Member, Compliance Institute",
    "Advisor to FinTech startups"
  ],
  "recent_news": [
    "Featured in Handelsblatt for AI compliance insights",
    "Quoted in Financial Times on regulatory changes"
  ],
  "confidence": 0.9
}

RESEARCH GUIDELINES:
- Conduct deep professional research using all available sources
- Extract specific details: exact job titles, company names, dates, locations
- Find recent publications, speaking engagements, and media mentions
- Identify professional achievements, awards, and recognition
- Map industry connections and professional networks
- Include recent news mentions and thought leadership
- Be thorough but accurate - only include verifiable information
- Use specific dates, institutions, and company names
- Confidence score should reflect data quality and completeness
- If information is unavailable, use null or empty arrays

Return ONLY the JSON object, no additional text or explanations.`;

    const result = await model.generateContent(researchPrompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean and parse the response
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const jsonStart = cleanText.indexOf('{');
    const jsonEnd = cleanText.lastIndexOf('}') + 1;
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleanText = cleanText.substring(jsonStart, jsonEnd);
    }
    
    const enrichedProfile = JSON.parse(cleanText);
    
    // Merge with original speaker data
    return {
      ...speaker,
      ...enrichedProfile,
      confidence: enrichedProfile.confidence || 0.7
    };
    
  } catch (error) {
    // Failed to research speaker, returning basic profile
    return {
      ...speaker,
      confidence: 0.3
    };
  }
}

// ---------- Main handler
export async function POST(req: NextRequest): Promise<NextResponse<SpeakerExtractionResponse | ErrorResponse>> {
  try {
    const requestData: SpeakerExtractionRequest = await req.json();
    const { url, includePast = false } = requestData;
    if (!url) return NextResponse.json({ 
      error: "url required", 
      timestamp: new Date().toISOString() 
    } as ErrorResponse, { status: 400 });

    // 1) Load main HTML (for title + link discovery)
    let html = "";
    let title = "";
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store", redirect: "follow" });
      if (res.ok) {
        html = await res.text();
        const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        title = m ? m[1].replace(/\s+/g," ").trim() : "";
      }
    } catch { /* ignore */ }

    // 2) Enhanced link discovery
    const ranked = html ? rankLinks(html, url, includePast) : [];
    const gse = await cseSiteHunt(url, title);
    
    // 3) Discover individual speaker pages from speaker list pages
    const speakerListPages = ranked.filter(u => 
      K_SPEAKER_ENHANCED.test(u.toLowerCase()) || 
      K_SPEAKER_PAGES.test(u.toLowerCase())
    );
    
    const individualSpeakerPages: string[] = [];
    for (const speakerListUrl of speakerListPages.slice(0, 5)) { // Limit to avoid too many requests
      try {
        const pages = await discoverSpeakerPages(speakerListUrl);
        individualSpeakerPages.push(...pages);
      } catch (error) {
        console.warn('Failed to discover speaker pages from:', speakerListUrl, error);
      }
    }
    
    // 4) Combine all candidates with prioritization
    const allCandidates = uniq([
      stripHash(url), // Original page first
      ...individualSpeakerPages, // Individual speaker pages next
      ...ranked, // Then ranked links
      ...gse // Finally CSE results
    ]).slice(0, 10); // Limit to 10 URLs for better coverage

    // 5) Firecrawl extract over the enhanced candidate set
    const { speakers: raw, sources } = await firecrawlExtract(allCandidates);

    // 6) Enhanced LLM normalization/merge
    const speakers = await normalizeWithLLM(raw);

    // 7) Comprehensive speaker research and enrichment
    const enrichedSpeakers = await Promise.all(
      speakers.slice(0, 10).map(speaker => researchSpeakerProfile(speaker))
    );

    // 8) Final dedupe & clean with quality filtering
    const seen = new Set<string>();
    const final = [];
    const allSpeakers = enrichedSpeakers.length ? enrichedSpeakers : (speakers.length ? speakers : raw);
    
    for (const s of allSpeakers) {
      const name = clamp(s?.name); 
      if (!name) continue;
      
      const org = clamp(s?.org);
      const title = clamp(s?.title);
      const confidence = s?.confidence || calculateSpeakerConfidence({ name, org, title, profile_url: s?.profile_url });
      
      // Skip low-confidence speakers
      if (confidence < 0.4) continue;
      
      const key = normKey(name, org);
      if (seen.has(key)) continue;
      seen.add(key);
      
      final.push({
        name,
        org,
        title,
        profile_url: s?.profile_url || null,
        source_url: s?.source_url || null,
        confidence,
        bio: s?.bio || null,
        expertise: s?.expertise || null,
        linkedin: s?.linkedin || null,
        twitter: s?.twitter || null,
        // Enhanced enrichment fields
        speech_title: s?.speech_title || null,
        session: s?.session || null,
        location: s?.location || null,
        education: s?.education || null,
        publications: s?.publications || null,
        career_history: s?.career_history || null,
        social_links: s?.social_links || null,
        expertise_areas: s?.expertise_areas || null,
        speaking_history: s?.speaking_history || null,
        achievements: s?.achievements || null,
        industry_connections: s?.industry_connections || null,
        recent_news: s?.recent_news || null
      });
    }

    // Sort by confidence score (highest first)
    final.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    // Calculate comprehensive quality statistics
    const qualityStats = {
      totalExtracted: raw.length,
      normalizedCount: speakers.length,
      enrichedCount: enrichedSpeakers.length,
      finalCount: final.length,
      highQualityCount: final.filter(s => (s.confidence || 0) >= 0.7).length,
      averageConfidence: final.length > 0 ? 
        final.reduce((sum, s) => sum + (s.confidence || 0), 0) / final.length : 0,
      discoveryStats: {
        rankedLinks: ranked.length,
        cseResults: gse.length,
        individualSpeakerPages: individualSpeakerPages.length,
        totalCandidates: allCandidates.length
      },
      enrichmentStats: {
        speakersWithBio: final.filter(s => s.bio && s.bio.trim().length > 0).length,
        speakersWithExpertise: final.filter(s => s.expertise && s.expertise.trim().length > 0).length,
        speakersWithLinkedIn: final.filter(s => s.linkedin && s.linkedin.trim().length > 0).length,
        speakersWithTwitter: final.filter(s => s.twitter && s.twitter.trim().length > 0).length
      }
    };

    return NextResponse.json({
      source: url,
      followed: ranked,                    // from in-page links (debug)
      gse: gse,                           // from Google site: search (debug)
      individualSpeakerPages,             // discovered individual speaker pages (debug)
      used: allCandidates,                // all URLs we attempted
      from: sources,                      // sources Firecrawl used in results
      count: final.length,
      speakers: final,
      qualityStats,
      version: "speakers_v3"
    } as SpeakerExtractionResponse);
  } catch (e: any) {
    return NextResponse.json({ 
      error: e?.message || "failed", 
      timestamp: new Date().toISOString() 
    } as ErrorResponse, { status: 500 });
  }
}
