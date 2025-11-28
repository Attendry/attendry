# Outreach Agent Draft Integration - Complete

**Date:** 2025-02-26  
**Feature:** Email Draft Generation Integration with Outreach Agent

## Overview

Successfully integrated the Outreach Agent system with the new `/contacts` page, enabling AI-powered draft generation that uses contact research data and user preferences.

## What Was Implemented

### 1. New API Endpoint ✅
**File:** `src/app/api/contacts/[contactId]/draft/route.ts`

- **POST** `/api/contacts/[contactId]/draft`
- Automatically gets or creates an Outreach Agent for the user
- Generates personalized drafts using the Outreach Agent
- Accepts `language`, `tone`, and `channel` parameters
- Returns draft with subject and message body

**Request Body:**
```json
{
  "language": "English" | "German",
  "tone": "Formal" | "Informal",
  "channel": "email" | "linkedin" | "other",
  "opportunityId": "optional-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "draft": {
    "id": "draft-uuid",
    "subject": "Email subject line",
    "messageBody": "Message content",
    "channel": "email",
    "personalizationContext": { ... }
  }
}
```

### 2. Enhanced Outreach Agent ✅
**File:** `src/lib/agents/outreach-agent.ts`

**New Features:**
- **Contact Research Integration**: Fetches and uses `contact_research` data when available
- **Preference Support**: Uses contact's `preferred_language`, `preferred_tone`, and `preferred_channel`
- **Language Support**: Generates drafts in English or German based on preference
- **Research-Enhanced Prompts**: Includes background intel and grounding links in prompt

**Enhanced `buildOutreachPrompt()`:**
- Adds language instruction (English/German)
- Includes contact research background info
- Lists grounding source links
- Uses preferred tone (Formal/Informal) with specific guidance
- Adapts format for email vs LinkedIn

**New Method:**
- `getContactResearch()`: Fetches research data from `contact_research` table

### 3. Updated ContactModal ✅
**File:** `src/components/contacts/ContactModal.tsx`

**Changes:**
- Removed research requirement check (drafts can be generated without prior research, but are better with it)
- Integrated with new draft API endpoint
- Displays generated draft in textarea
- Includes subject line for email drafts
- Shows success/error toasts

**Flow:**
1. User selects language, tone, and channel
2. Clicks "Generate Draft"
3. API call to `/api/contacts/[contactId]/draft`
4. Draft appears in textarea
5. User can copy or edit draft

### 4. Type Updates ✅
**File:** `src/lib/types/agents.ts`

- Updated `DraftOutreachTaskInput` to include:
  - `preferredLanguage` in context
  - `preferredTone` in context

## How It Works

### Draft Generation Flow

```
User clicks "Generate Draft" in ContactModal
  ↓
POST /api/contacts/[contactId]/draft
  ↓
Get or create Outreach Agent for user
  ↓
Fetch contact data + research (if available)
  ↓
Create task for Outreach Agent
  ↓
OutreachAgent.draftOutreachMessage()
  ├─ Gather context (contact, opportunity, account intel, research)
  ├─ Build prompt with preferences and research
  ├─ Call LLM (Gemini via LLMService)
  ├─ Parse response (subject + message body)
  └─ Store draft in agent_outreach_drafts
  ↓
Return draft to frontend
  ↓
Display in ContactModal textarea
```

### Prompt Enhancement

The Outreach Agent now builds prompts that include:

1. **Language Instruction**: "Write the entire message in German/English"
2. **Contact Research**: Background info from Google Search grounding
3. **Source Links**: References to grounding sources
4. **Tone Guidance**: Specific instructions for Formal vs Informal
5. **Channel Adaptation**: Different format for email vs LinkedIn

### Example Prompt Structure

```
Draft a personalized email outreach message for John Doe.

IMPORTANT: Write the entire message in English.

CONTACT INFORMATION:
- Name: John Doe
- Title: CTO
- Organization: TechCorp

CONTACT RESEARCH & BACKGROUND:
[Background info from research]
Sources:
1. Article Title (https://source.com)
2. ...

EVENT CONTEXT:
- Event: Tech Conference 2025
- Date: 3/15/2025
...

REQUIREMENTS:
- Tone: Formal (use formal language, titles, and professional structure)
- Channel: email
- Include a clear, compelling subject line
- Reference specific details from the contact research above
- Reference specific context (event, role, company, recent achievements)
- Include clear value proposition
- Call-to-action for next step
- Keep message concise (2-3 paragraphs max)
- Professional but warm
```

## Integration Points

### With Contact Research
- If research exists, it's automatically included in the prompt
- Grounding links are listed as sources
- Research enhances personalization

### With Contact Preferences
- Language preference determines output language
- Tone preference adjusts formality
- Channel preference sets format

### With Outreach Agent System
- Drafts stored in `agent_outreach_drafts` table
- Tasks logged in `agent_tasks` table
- Activity logged in `agent_activity_log` table
- Can be approved/rejected through existing approval system

## Benefits

1. **Personalization**: Uses research data for context-aware drafts
2. **Preference Respect**: Honors user's language, tone, and channel choices
3. **Consistency**: Integrates with existing Outreach Agent infrastructure
4. **Flexibility**: Works with or without research (better with research)
5. **Multi-language**: Supports English and German
6. **Multi-channel**: Supports email, LinkedIn, and other channels

## Testing Checklist

- [ ] Generate draft without research (should work)
- [ ] Generate draft with research (should include research in prompt)
- [ ] Generate draft in German
- [ ] Generate draft in English
- [ ] Generate draft with Formal tone
- [ ] Generate draft with Informal tone
- [ ] Generate email draft (should include subject)
- [ ] Generate LinkedIn draft (no subject)
- [ ] Verify draft is stored in database
- [ ] Verify draft appears in approval queue (if autoApprove is false)

## Future Enhancements

1. **Draft History**: Show previous drafts for a contact
2. **Draft Comparison**: Compare multiple drafts side-by-side
3. **Draft Templates**: Save and reuse draft templates
4. **Batch Drafting**: Generate drafts for multiple contacts
5. **A/B Testing**: Generate multiple variations of drafts
6. **Sentiment Analysis**: Analyze draft tone before sending

## Notes

- The Outreach Agent is automatically created if the user doesn't have one
- Drafts are stored with `pending_approval` status by default (unless autoApprove is enabled)
- Research is optional but highly recommended for better personalization
- The system gracefully handles missing research data

