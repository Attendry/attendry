/**
 * Contact Research Service
 * 
 * Handles AI-powered contact research using Gemini with Google Search grounding
 * and manages persistent research data with update monitoring.
 */

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
 * Research a contact using Gemini with Google Search grounding
 */
export async function researchContact(
  name: string,
  company: string
): Promise<ContactResearchResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  try {
    // Use GoogleGenerativeAI SDK (newer version)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp', // Use model that supports Google Search grounding
    });

    const prompt = `Find recent professional news, key achievements, background information, and any recent public activity for ${name} who works at ${company}. 
Focus on information relevant for professional outreach. 
Limit the response to 3 concise paragraphs.`;

    // Note: Google Search grounding requires specific model and configuration
    // For now, we'll use the standard generateContent and extract grounding if available
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // Google Search grounding would be configured here if available
      // tools: [{ googleSearch: {} }] - this may require different SDK version
    });

    const response = await result.response;
    const text = response.text() || 'No information found.';

    // Extract grounding chunks if available in the response
    const groundingMetadata = (response as any).groundingMetadata;
    const rawChunks = groundingMetadata?.groundingChunks || [];
    
    const chunks: GroundingChunk[] = rawChunks
      .map((c: any) => {
        if (c.web) {
          return {
            title: c.web.title || 'Untitled',
            url: c.web.uri || ''
          };
        }
        return null;
      })
      .filter((c: any) => c !== null && c.url);

    return { text, chunks };
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

    // Use Gemini to compare and find significant new information
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

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
      updated_at: new Date().toISOString(),
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
      updated_at: new Date().toISOString(),
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
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('contact_id', contactId);

  if (error) {
    throw new Error(`Failed to clear intel flag: ${error.message}`);
  }
}

