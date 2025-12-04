import { GoogleGenAI } from "@google/genai";
import { SearchResult } from "../components/outreach/types";

// Initialize the client. 
// Note: In a Next.js server component we can use process.env directly. 
// If this is client-side, we need to be careful about exposing keys. 
// The prototype ran entirely client-side with a key in env. 
// For this "Augment" plan, we should ideally use a server action or proxy, 
// but to "Mirror" the prototype exactly as a starting point, I will assume 
// NEXT_PUBLIC_GEMINI_API_KEY or similar if running client side, 
// OR keep it as is if the user has configured the environment for it.
// However, standard practice is to not expose keys on client.
// Given the prototype was a Vite app with `process.env.API_KEY` (via define plugin), 
// and this is a Next.js app, I will try to use `process.env.NEXT_PUBLIC_GEMINI_API_KEY` 
// or just `process.env.GEMINI_API_KEY` if this code runs on server.
// 
// Since the prototype's `ContactModal` calls these functions directly, 
// and `ContactModal` is a UI component, these functions are running in the browser.
// THIS IS INSECURE, but matches the prototype.
// To make it secure in Next.js, these should be Server Actions.
//
// PLAN: I will convert these to Server Actions to be safe and "enhanced".

'use server';

const apiKey = process.env.GEMINI_API_KEY;

/**
 * Uses Gemini with Google Search grounding to find background info on a contact.
 */
export const researchContact = async (name: string, company: string): Promise<SearchResult> => {
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Upgraded to 2.0 as per best practice, or keep 2.5-flash if available
      contents: `Find recent professional news, key achievements, background information, and any recent public activity for ${name} who works at ${company}. 
      Focus on information relevant for professional outreach. 
      Limit the response to 3 concise paragraphs.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "No information found.";
    
    // Extract grounding chunks if available
    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const chunks = rawChunks
      .map((c: any) => {
        if (c.web) return { title: c.web.title, url: c.web.uri };
        return null;
      })
      .filter((c: any) => c !== null);

    return { text, chunks };
  } catch (error) {
    console.error("Error researching contact:", error);
    throw error;
  }
};

/**
 * Generates a professional bio for the contact.
 */
export const generateLinkedInBio = async (
  name: string,
  company: string,
  backgroundInfo: string,
  language: string = "English"
): Promise<string> => {
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const ai = new GoogleGenAI({ apiKey });

  try {
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

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text || "Could not generate bio.";
  } catch (error) {
    console.error("Error generating bio:", error);
    return "";
  }
};

/**
 * Generates an email draft based on background info with language and tone options.
 */
export const generateEmailDraft = async (
  name: string, 
  company: string, 
  backgroundInfo: string, 
  userNotes?: string,
  language: string = "English",
  tone: string = "Formal",
  type: string = "Email",
  myCompanyUrl?: string,
  specificGoal?: string
): Promise<string> => {
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const ai = new GoogleGenAI({ apiKey });

  try {
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

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text || "Could not generate draft.";
  } catch (error) {
    console.error("Error generating draft:", error);
    throw error;
  }
};

/**
 * Optimizes an existing draft for higher response rates.
 */
export const optimizeDraft = async (
  draft: string,
  backgroundInfo: string,
  myCompanyUrl?: string,
  specificGoal?: string
): Promise<string> => {
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const ai = new GoogleGenAI({ apiKey });

  try {
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
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text || draft;
  } catch (error) {
    console.error("Error optimizing draft:", error);
    throw error;
  }
};

/**
 * Checks if there are updates relevant to the contact since the last research.
 * This simulates a "monitoring" feature by performing a new search and comparing.
 */
export const checkForUpdates = async (name: string, company: string, existingInfo: string): Promise<string | null> => {
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const ai = new GoogleGenAI({ apiKey });

  try {
     // We need to call researchContact here, but since it is also a server action in this file, 
     // we can call it directly.
     const searchResult = await researchContact(name, company);
     const newInfo = searchResult.text;

     const comparePrompt = `
     I have this existing information about a contact:
     ${existingInfo}

     I just ran a new search and found this:
     ${newInfo}

     Is there any SIGNIFICANT new information (e.g., job change, new article, new project release) in the new search results that is not in the existing info?
     If yes, summarize ONLY the new information.
     If no, simply reply "NO_UPDATES".
     `;

     const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: comparePrompt,
     });

     const result = response.text?.trim();
     if (result && result.includes("NO_UPDATES")) {
         return null;
     }
     return result || null;
  } catch (error) {
    console.error("Error checking updates:", error);
    return null;
  }
}

