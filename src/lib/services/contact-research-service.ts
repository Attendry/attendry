/**
 * Contact Research Service
 * 
 * Handles AI-powered contact research using Gemini with Google Search grounding
 * and manages persistent research data with update monitoring.
 */

'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseServer } from '@/lib/supabase-server';

export interface GroundingChunk {
  title: string;
  url: string;
}

export interface ContactResearchResult {
  text: string;
  chunks: GroundingChunk[];
}

export interface ContactResearch {
  id: string;
  contact_id: string;
  user_id: string;
  background_info: string | null;
  grounding_links: GroundingChunk[];
  last_research_date: string | null;
  has_new_intel: boolean;
  new_intel_summary: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Research a contact using fact-grounded approach:
 * 1. First, perform actual web search using Google CSE
 * 2. Then, use Gemini to synthesize the search results into coherent research
 * 3. Ensure all facts are traceable to source links
 * 
 * @param name - Contact's name
 * @param company - Contact's company
 * @param options - Optional parameters for auto-saving research
 */
export async function researchContact(
  name: string,
  company: string,
  options?: {
    userId?: string;
    contactId?: string;
    autoSave?: boolean;
  }
): Promise<ContactResearchResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  try {
    // STEP 1: Perform web search using Google CSE to get URLs
    const searchQueries = [
      `${name} ${company}`,
      `"${name}" "${company}"`,
      `${name} ${company} recent news`,
    ];

    const sourceUrls: string[] = [];
    const sourceLinks: GroundingChunk[] = [];

    // Use Google Custom Search Engine if available
    const cseKey = process.env.GOOGLE_CSE_KEY;
    const cseCx = process.env.GOOGLE_CSE_CX;

    if (cseKey && cseCx) {
      for (const query of searchQueries.slice(0, 2)) { // Limit to 2 queries to avoid rate limits
        try {
          const params = new URLSearchParams({
            q: query,
            key: cseKey,
            cx: cseCx,
            num: '5', // Get top 5 results per query
            safe: 'off',
          });
          
          const searchResponse = await fetch(
            `https://www.googleapis.com/customsearch/v1?${params}`,
            { cache: 'no-store' }
          );
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const items = searchData.items || [];
            
            for (const item of items) {
              const url = item.link || item.displayLink || '';
              // Avoid duplicates and ensure valid URLs
              if (url && url.startsWith('http') && !sourceUrls.includes(url)) {
                sourceUrls.push(url);
                sourceLinks.push({
                  title: item.title || 'Untitled',
                  url: url,
                });
              }
            }
          }
        } catch (searchError) {
          console.warn(`[contact-research] Search query failed: ${query}`, searchError);
          // Continue with other queries
        }
      }
    }

    // STEP 2: Extract full content from URLs using Firecrawl
    let extractedContent: Array<{ url: string; title: string; content: string }> = [];
    const firecrawlKey = process.env.FIRECRAWL_KEY;

    if (sourceUrls.length > 0 && firecrawlKey) {
      // Extract content from top URLs (limit to 5 for performance)
      const urlsToExtract = sourceUrls.slice(0, 5);
      
      for (const url of urlsToExtract) {
        try {
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url,
              formats: ['markdown'],
              onlyMainContent: true,
              timeout: 15000,
            }),
          });

          if (scrapeResponse.ok) {
            const scrapeData = await scrapeResponse.json();
            if (scrapeData.data?.markdown) {
              const sourceLink = sourceLinks.find(link => link.url === url);
              extractedContent.push({
                url,
                title: sourceLink?.title || scrapeData.data.metadata?.title || 'Untitled',
                content: scrapeData.data.markdown,
              });
            }
          }
        } catch (extractError) {
          console.warn(`[contact-research] Failed to extract content from ${url}:`, extractError);
          // Continue with other URLs
        }
      }
    }

    // STEP 3: Use Gemini 2.5 to synthesize rich research from full content
    let text = '';
    let chunks: GroundingChunk[] = sourceLinks;

    if (extractedContent.length > 0) {
      // Use Gemini 2.5 for rich, contextual synthesis
      const genAI = new GoogleGenerativeAI(apiKey);
      // Try gemini-2.5-flash first, fallback to gemini-2.0-flash-exp if not available
      let model;
      try {
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      } catch (e) {
        // Fallback if model name needs adjustment
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      }

      // Build rich context from extracted content
      const richContext = extractedContent
        .map((source, idx) => {
          return `[Source ${idx + 1}: ${source.title}]
URL: ${source.url}
Full Content:
${source.content.substring(0, 3000)}${source.content.length > 3000 ? '...' : ''}`;
        })
        .join('\n\n---\n\n');

      const prompt = `You are a professional researcher and outreach specialist. Based on the following full content extracted from web sources, provide a comprehensive, well-written research summary about ${name} who works at ${company}.

IMPORTANT RULES:
1. Synthesize information from the full content provided - you have access to complete articles/pages, not just snippets
2. Provide rich context and insights that would be valuable for professional outreach
3. Focus on: recent professional news, key achievements, background, expertise areas, public speaking, publications, and any notable activities
4. Write in a natural, engaging style (3-4 paragraphs) that flows well
5. Only use information explicitly found in the sources - do not make up facts
6. If information is not available, acknowledge gaps rather than guessing
7. The URLs below are references - cite them naturally in your summary where relevant

Extracted Content from Sources:
${richContext}

Now provide a comprehensive research summary:`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const response = await result.response;
      text = response.text() || 'No information found in extracted content.';
    } else if (sourceUrls.length > 0) {
      // We have URLs but couldn't extract content (Firecrawl unavailable or failed)
      text = `Found ${sourceUrls.length} relevant sources for ${name} at ${company}, but content extraction is currently unavailable. Please check the source URLs directly for detailed information.`;
    } else {
      // No search results available
      text = `No recent public information found for ${name} at ${company} through web search. This may indicate:
- Limited online presence
- Private professional profile
- Recent role change

Consider reaching out directly or checking LinkedIn for more information.`;
      chunks = [];
    }

    const researchResult = { text, chunks };

    // Auto-save to database if requested
    if (options?.autoSave && options.userId && options.contactId) {
      try {
        await saveContactResearch(options.userId, options.contactId, researchResult);
      } catch (saveError: any) {
        // Log but don't fail the research call if save fails
        console.error('Failed to auto-save research:', saveError);
      }
    }

    return researchResult;
  } catch (error: any) {
    console.error('Error researching contact:', error);
    throw new Error(`Failed to research contact: ${error.message}`);
  }
}

/**
 * Check for updates on a contact by comparing new research with existing
 */
export async function checkForUpdates(
  name: string,
  company: string,
  existingInfo: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  try {
    // First, get new research
    const newResearch = await researchContact(name, company);
    const newInfo = newResearch.text;

    // Use Gemini 2.5 to compare and find significant new information
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' }); // Using 2.0 until 2.5 confirmed

    const comparePrompt = `
I have this existing information about a contact:
${existingInfo}

I just ran a new search and found this:
${newInfo}

Is there any SIGNIFICANT new information (e.g., job change, new article, new project release, award, speaking engagement) in the new search results that is not in the existing info?
If yes, summarize ONLY the new information in 2-3 sentences.
If no, simply reply "NO_UPDATES".
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: comparePrompt }] }],
    });

    const response = await result.response;
    const resultText = response.text()?.trim() || '';

    if (resultText.includes('NO_UPDATES') || resultText.length < 20) {
      return null;
    }

    return resultText;
  } catch (error: any) {
    console.error('Error checking updates:', error);
    return null;
  }
}

/**
 * Save or update contact research in database
 */
export async function saveContactResearch(
  userId: string,
  contactId: string,
  research: ContactResearchResult
): Promise<ContactResearch> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('contact_research')
    .upsert({
      contact_id: contactId,
      user_id: userId,
      background_info: research.text,
      grounding_links: research.chunks,
      last_research_date: new Date().toISOString(),
      has_new_intel: false,
      new_intel_summary: null,
      // updated_at is handled by database default and trigger
    }, {
      onConflict: 'contact_id',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to save research: ${error?.message || 'Unknown error'}`);
  }

  return {
    ...data,
    grounding_links: (data.grounding_links || []) as GroundingChunk[],
  } as ContactResearch;
}

/**
 * Get contact research from database
 */
export async function getContactResearch(
  userId: string,
  contactId: string
): Promise<ContactResearch | null> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('contact_research')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to get research: ${error.message}`);
  }

  return {
    ...data,
    grounding_links: (data.grounding_links || []) as GroundingChunk[],
  } as ContactResearch;
}

/**
 * Update contact research with new intel
 */
export async function updateContactResearchWithIntel(
  userId: string,
  contactId: string,
  newIntelSummary: string
): Promise<void> {
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from('contact_research')
    .update({
      has_new_intel: true,
      new_intel_summary: newIntelSummary,
      last_checked_at: new Date().toISOString(),
      // updated_at is handled by database trigger
    })
    .eq('user_id', userId)
    .eq('contact_id', contactId);

  if (error) {
    throw new Error(`Failed to update research: ${error.message}`);
  }
}

/**
 * Clear new intel flag after user has seen it
 */
export async function clearNewIntelFlag(
  userId: string,
  contactId: string
): Promise<void> {
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from('contact_research')
    .update({
      has_new_intel: false,
      new_intel_summary: null,
      // updated_at is handled by database trigger
    })
    .eq('user_id', userId)
    .eq('contact_id', contactId);

  if (error) {
    throw new Error(`Failed to clear intel flag: ${error.message}`);
  }
}

/**
 * Generates a professional bio for the contact.
 */
export async function generateLinkedInBio(
  name: string,
  company: string,
  backgroundInfo: string,
  language: string = "English"
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
    Role: Expert Professional Biographer and Profiler.
    Objective: Write a comprehensive professional bio for ${name} who works at ${company}.

    Intel/Research:
    ${backgroundInfo}

    Configuration:
    - Language: ${language}
    - Style: Third-person, executive summary style. Suitable for an intro or speaker bio.

    CRITICAL RULES:
    1. EXTREME BREVITY: Keep it under 200 words.
    2. NO BUZZWORDS: Avoid "visionary", "guru", "ninja", etc. Use grounded professional language.
    3. STRUCTURE: Start with name and current role. Summarize key background, achievements, and expertise.
    4. TONE: Professional, objective, impressive.

    Draft the bio now.
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    return response.text() || "Could not generate bio.";
  } catch (error: any) {
    console.error('Error generating bio:', error);
    return "";
  }
}

/**
 * Generates an email draft based on background info with language and tone options.
 */
export async function generateEmailDraft(
  name: string, 
  company: string, 
  backgroundInfo: string, 
  userNotes?: string,
  language: string = "English",
  tone: string = "Formal",
  type: string = "Email",
  myCompanyUrl?: string,
  specificGoal?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let typeInstruction = "";
    let structureInstruction = "";

    if (type === 'LinkedIn') {
      typeInstruction = "Format: LinkedIn Message. Style: Casual, direct, very concise (under 100 words). No Subject Line needed.";
      structureInstruction = "Structure:\n[The LinkedIn Message Body - No Subject Line]\n\n[Internal Context Section (If applicable)]";
    } else if (type === 'Follow-up') {
      typeInstruction = "Format: Follow-up Email. Context: I am following up on a previous attempt or circling back. Keep it short and polite.";
      structureInstruction = "Structure:\nSubject Line Options:\n1. [Option 1]\n2. [Option 2]\n3. [Option 3]\n\nEmail Body:\n[The Draft]\n\n[Internal Context Section (If applicable)]";
    } else {
      typeInstruction = "Format: Standard Outreach Email. Structure: Subject Line (keep it short/lowercase), Body, Sign-off.";
      structureInstruction = "Structure:\nSubject Line Options:\n1. [Option 1]\n2. [Option 2]\n3. [Option 3]\n\nEmail Body:\n[The Draft]\n\n[Internal Context Section (If applicable)]";
    }

    const prompt = `
    Role: Elite Sales Development Representative (SDR).
    Objective: Write a concise outreach message to ${name} at ${company}.

    Intel/Research:
    ${backgroundInfo}

    My Context:
    ${myCompanyUrl ? `My Company Website: ${myCompanyUrl} (Use this to subtly align value if relevant, but do not be salesy)` : ""}
    ${specificGoal ? `Specific Outreach Goal: ${specificGoal}` : ""}
    Additional Notes/Role Context: ${userNotes || "Connect regarding potential collaboration."}

    Configuration:
    - Language: ${language}
    - Tone: ${tone} (If German: Formal="Sie", Informal="Du")
    - Format: ${type} (${typeInstruction})

    CRITICAL RULES TO AVOID "AI SMELL":
    1. EXTREME BREVITY: Keep it under 100 words if possible. No fluff.
    2. NO AI BUZZWORDS: Do not use words like "Unlock", "Unleash", "Elevate", "Transform", "Synergy", "Game-changer", "Revolutionize", "Delve", "Foster".
    3. NO GENERIC OPENERS: Never say "I hope this finds you well" or "I am writing to you because". Start directly with the research hook.
    4. LOWERCASE SUBJECT LINES: If generating subject lines, provide 3 variations. Make them look like a human wrote them to a colleague.
    5. SOFT CTA: Do not ask for 15 minutes or a meeting time. Ask for *interest* (e.g., "Worth a chat?", "Open to ideas?", "Is this relevant to you?").
    6. CONTEXT SUMMARY: If you refer to a specific event (podcast, article, post), you MUST append a section at the very bottom labeled '--- INTERNAL CONTEXT (DELETE BEFORE SENDING) ---'. This must be a DETAILED EXECUTIVE SUMMARY of that specific content. Do not just write one paragraph. Provide a structured summary (approx. 200 words) covering:
       - The Core Thesis/Topic
       - Key Arguments or Points made by the contact
       - Why this is relevant right now
       This enables the user to have a conversation about this topic without reading the source.

    ${structureInstruction}

    Draft the message now.
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    return response.text() || "Could not generate draft.";
  } catch (error: any) {
    console.error('Error generating draft:', error);
    throw error;
  }
}

/**
 * Optimizes an existing draft for higher response rates.
 */
export async function optimizeDraft(
  draft: string,
  backgroundInfo: string,
  myCompanyUrl?: string,
  specificGoal?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
    Role: World-class Copywriter and Sales Expert.
    Task: Polish and optimize this outreach draft to maximize the probability of a reply.
    
    Current Draft:
    ${draft}
    
    Background Info on Contact:
    ${backgroundInfo}
    
    My Context:
    ${myCompanyUrl ? `My Company: ${myCompanyUrl}` : ""}
    ${specificGoal ? `Goal: ${specificGoal}` : ""}
    
    Optimization Rules:
    1. CUT THE FLUFF: If it doesn't add value, delete it.
    2. HUMAN TONE: Make it sound like a busy human wrote it to another busy human. Remove "marketing speak".
    3. SHARPEN THE HOOK: Ensure the first sentence grabs attention based on the background info.
    4. SOFT CTA: Ensure the ask is low friction (e.g., "Worth a chat?" instead of "Can we meet at 2pm?").
    5. KEEP STRUCTURE: If there are subject line options, keep them. If there is a context summary at the bottom, keep it.
    
    Return ONLY the improved text.
    `;
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    return response.text() || draft;
  } catch (error: any) {
    console.error('Error optimizing draft:', error);
    throw error;
  }
}

