import { BaseAgent } from './base-agent';
import { 
  AgentTask, 
  DraftOutreachTaskInput, 
  DraftOutreachTaskOutput,
  OutreachAgentConfig,
  OutreachChannel
} from '@/lib/types/agents';
import { SavedSpeakerProfile } from '@/lib/types/database';
import { LLMService } from '@/lib/services/llm-service';

/**
 * Outreach Agent
 * Handles drafting personalized outreach messages for contacts
 */
export class OutreachAgent extends BaseAgent {
  private llmService: LLMService;
  private config: OutreachAgentConfig;

  constructor(agentId: string) {
    super(agentId);
    this.llmService = new LLMService();
  }

  async initialize(): Promise<void> {
    await super.initialize();
    this.config = this.config as OutreachAgentConfig;
    
    // Set defaults if config is incomplete
    if (!this.config.autoApprove !== undefined) {
      this.config.autoApprove = false;
    }
    if (!this.config.maxDailyOutreach) {
      this.config.maxDailyOutreach = 10;
    }
    if (!this.config.messageTone) {
      this.config.messageTone = 'professional';
    }
    if (this.config.includeEventContext === undefined) {
      this.config.includeEventContext = true;
    }
    if (this.config.includeAccountIntelligence === undefined) {
      this.config.includeAccountIntelligence = true;
    }
    if (this.config.notifyFollowupAgent === undefined) {
      this.config.notifyFollowupAgent = true;
    }
    if (!this.config.defaultFollowupDelayDays) {
      this.config.defaultFollowupDelayDays = 3;
    }
  }

  async processTask(task: AgentTask): Promise<{
    success: boolean;
    output?: DraftOutreachTaskOutput;
    requiresApproval?: boolean;
    error?: string;
  }> {
    if (task.task_type !== 'draft_outreach') {
      return {
        success: false,
        error: `Unsupported task type: ${task.task_type}`
      };
    }

    try {
      const input = task.input_data as DraftOutreachTaskInput;
      const draft = await this.draftOutreachMessage(input, task.id);
      
      return {
        success: true,
        output: {
          draftId: draft.id,
          subject: draft.subject || null,
          messageBody: draft.message_body,
          personalizationContext: draft.personalization_context || {}
        },
        requiresApproval: !this.config.autoApprove
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Draft an outreach message using LLM
   */
  private async draftOutreachMessage(
    input: DraftOutreachTaskInput,
    taskId: string
  ): Promise<any> {
    // Gather context
    const contact = await this.getContact(input.contactId);
    const opportunity = input.opportunityId 
      ? await this.getOpportunity(input.opportunityId)
      : null;
    const accountIntel = contact.speaker_data.org 
      ? await this.getAccountIntelligence(contact.speaker_data.org)
      : null;
    const historicalOutreach = await this.getHistoricalOutreach(input.contactId);

    // Fetch contact research if available
    const contactResearch = await this.getContactResearch(input.contactId);

    // Use preferences from contact or input context
    const preferredLanguage = input.context?.preferredLanguage || contact.preferred_language || 'English';
    const preferredTone = input.context?.preferredTone || contact.preferred_tone || this.config.messageTone;
    const preferredChannel = input.channel || (contact.preferred_channel as OutreachChannel) || 'email';

    // Build LLM prompt
    const prompt = this.buildOutreachPrompt({
      contact,
      opportunity,
      accountIntel,
      historicalOutreach,
      contactResearch,
      channel: preferredChannel,
      tone: preferredTone,
      language: preferredLanguage
    });

    // Call LLM
    const llmResponse = await this.llmService.generateOutreachMessage(prompt);
    
    // Parse response
    const { subject, messageBody, reasoning } = this.parseLLMResponse(
      llmResponse.content, 
      preferredChannel
    );

    // Store draft
    const { data: draft, error } = await this.supabase
      .from('agent_outreach_drafts')
      .insert({
        agent_id: this.agentId,
        task_id: taskId,
        contact_id: input.contactId,
        opportunity_id: input.opportunityId || null,
        channel: preferredChannel,
        subject: preferredChannel === 'email' ? subject : null,
        message_body: messageBody,
        personalization_context: {
          reasoning,
          keyPoints: this.extractKeyPoints(contact, opportunity, accountIntel),
          tone: preferredTone,
          channel: preferredChannel,
          language: preferredLanguage,
          usedResearch: !!contactResearch
        },
        status: this.config.autoApprove ? 'approved' : 'pending_approval'
      })
      .select()
      .single();

    if (error || !draft) {
      throw new Error(`Failed to create draft: ${error?.message}`);
    }

    await this.logActivity(
      'draft_created',
      `Created outreach draft for ${contact.speaker_data.name}`,
      taskId,
      { draftId: draft.id, channel: input.channel }
    );

    // Update metrics (count as message sent when approved/sent)
    // We'll update this when the draft is actually sent

    return draft;
  }

  /**
   * Build LLM prompt for outreach message
   */
  private buildOutreachPrompt(context: {
    contact: SavedSpeakerProfile;
    opportunity: any | null;
    accountIntel: any | null;
    historicalOutreach: any[];
    contactResearch: any | null;
    channel: OutreachChannel;
    tone: string;
    language: string;
  }): string {
    const { contact, opportunity, accountIntel, historicalOutreach, contactResearch, channel, tone, language } = context;
    
    let prompt = `Draft a personalized ${channel} outreach message for ${contact.speaker_data.name}.\n\n`;
    
    // Language instruction
    if (language === 'German') {
      prompt += `IMPORTANT: Write the entire message in German.\n\n`;
    } else {
      prompt += `IMPORTANT: Write the entire message in English.\n\n`;
    }

    // Contact information
    prompt += `CONTACT INFORMATION:\n`;
    prompt += `- Name: ${contact.speaker_data.name}\n`;
    if (contact.enhanced_data?.title) {
      prompt += `- Title: ${contact.enhanced_data.title}\n`;
    } else if (contact.speaker_data?.title) {
      prompt += `- Title: ${contact.speaker_data.title}\n`;
    }
    if (contact.speaker_data?.org) {
      prompt += `- Organization: ${contact.speaker_data.org}\n`;
    } else if (contact.enhanced_data?.organization) {
      prompt += `- Organization: ${contact.enhanced_data.organization}\n`;
    }
    if (contact.enhanced_data?.bio) {
      const bio = typeof contact.enhanced_data.bio === 'string' 
        ? contact.enhanced_data.bio.substring(0, 200) 
        : '';
      if (bio) {
        prompt += `- Bio: ${bio}...\n`;
      }
    }
    prompt += `\n`;

    // Contact research (background intel)
    if (contactResearch?.background_info) {
      prompt += `CONTACT RESEARCH & BACKGROUND:\n`;
      prompt += `${contactResearch.background_info}\n`;
      if (contactResearch.grounding_links && Array.isArray(contactResearch.grounding_links) && contactResearch.grounding_links.length > 0) {
        prompt += `\nSources:\n`;
        contactResearch.grounding_links.slice(0, 3).forEach((link: any, idx: number) => {
          if (link.title && link.url) {
            prompt += `${idx + 1}. ${link.title} (${link.url})\n`;
          }
        });
      }
      prompt += `\n`;
    }

    // Opportunity context
    if (opportunity && this.config.includeEventContext) {
      prompt += `EVENT CONTEXT:\n`;
      const event = opportunity.event || opportunity;
      prompt += `- Event: ${event.title || 'Unknown'}\n`;
      if (event.starts_at) {
        prompt += `- Date: ${new Date(event.starts_at).toLocaleDateString()}\n`;
      }
      if (event.location || (event.city && event.country)) {
        const location = event.location || `${event.city || ''}, ${event.country || ''}`.trim();
        if (location) {
          prompt += `- Location: ${location}\n`;
        }
      }
      if (event.description) {
        const desc = typeof event.description === 'string' 
          ? event.description.substring(0, 150) 
          : '';
        if (desc) {
          prompt += `- Description: ${desc}...\n`;
        }
      }
      prompt += `\n`;
    }

    // Account intelligence
    if (accountIntel && this.config.includeAccountIntelligence) {
      prompt += `ACCOUNT CONTEXT:\n`;
      if (accountIntel.industry) {
        prompt += `- Industry: ${accountIntel.industry}\n`;
      }
      if (accountIntel.recentActivity) {
        prompt += `- Recent activity: ${accountIntel.recentActivity}\n`;
      }
      prompt += `\n`;
    }

    // Historical outreach
    if (historicalOutreach.length > 0) {
      prompt += `PREVIOUS OUTREACH:\n`;
      historicalOutreach.slice(0, 3).forEach((outreach, idx) => {
        const date = new Date(outreach.created_at).toLocaleDateString();
        prompt += `${idx + 1}. ${outreach.channel} - ${outreach.status} on ${date}\n`;
      });
      prompt += `\n`;
    }

    // Requirements
    prompt += `REQUIREMENTS:\n`;
    prompt += `- Tone: ${tone} (${tone === 'Formal' ? 'use formal language, titles, and professional structure' : 'use friendly, conversational language while remaining professional'})\n`;
    prompt += `- Channel: ${channel}\n`;
    if (channel === 'email') {
      prompt += `- Include a clear, compelling subject line\n`;
    } else if (channel === 'linkedin') {
      prompt += `- Format as a LinkedIn message (no subject line needed)\n`;
      prompt += `- Keep it shorter and more casual than email\n`;
    }
    if (contactResearch?.background_info) {
      prompt += `- Reference specific details from the contact research above\n`;
    }
    prompt += `- Reference specific context (event, role, company, recent achievements)\n`;
    prompt += `- Include clear value proposition\n`;
    prompt += `- Call-to-action for next step\n`;
    prompt += `- Keep message concise (2-3 paragraphs max)\n`;
    prompt += `- Professional but warm\n`;
    prompt += `\n`;

    prompt += `Generate the ${channel === 'email' ? 'subject line and ' : ''}message body. Format as JSON:\n`;
    prompt += `{\n`;
    if (channel === 'email') {
      prompt += `  "subject": "Subject line here",\n`;
    }
    prompt += `  "messageBody": "Message body here",\n`;
    prompt += `  "reasoning": "Brief explanation of personalization approach"\n`;
    prompt += `}\n`;

    return prompt;
  }

  /**
   * Parse LLM response
   */
  private parseLLMResponse(response: string, channel: OutreachChannel): {
    subject: string | null;
    messageBody: string;
    reasoning: string;
  } {
    try {
      const parsed = this.llmService.parseJSONResponse<{
        subject?: string;
        messageBody: string;
        reasoning: string;
      }>(response);
      
      return {
        subject: channel === 'email' ? (parsed.subject || null) : null,
        messageBody: parsed.messageBody || response,
        reasoning: parsed.reasoning || 'Generated based on contact and event context'
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        subject: channel === 'email' ? 'Following up on event opportunity' : null,
        messageBody: response,
        reasoning: 'Generated based on contact and event context'
      };
    }
  }

  /**
   * Extract key points for personalization context
   */
  private extractKeyPoints(contact: SavedSpeakerProfile, opportunity: any | null, accountIntel: any | null): string[] {
    const points: string[] = [];
    
    if (contact.enhanced_data?.title || contact.speaker_data?.title) {
      points.push(`Role: ${contact.enhanced_data?.title || contact.speaker_data?.title}`);
    }
    if (opportunity?.event?.title) {
      points.push(`Event: ${opportunity.event.title}`);
    } else if (opportunity?.title) {
      points.push(`Event: ${opportunity.title}`);
    }
    if (accountIntel?.industry) {
      points.push(`Industry: ${accountIntel.industry}`);
    }
    
    return points;
  }

  /**
   * Helper methods to fetch data
   */
  private async getContact(contactId: string): Promise<SavedSpeakerProfile> {
    const { data, error } = await this.supabase
      .from('saved_speaker_profiles')
      .select('*')
      .eq('id', contactId)
      .single();

    if (error || !data) {
      throw new Error(`Contact not found: ${error?.message}`);
    }

    return data as SavedSpeakerProfile;
  }

  private async getOpportunity(opportunityId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('user_opportunities')
      .select(`
        *,
        event:collected_events(*)
      `)
      .eq('id', opportunityId)
      .single();

    if (error || !data) {
      throw new Error(`Opportunity not found: ${error?.message}`);
    }

    return data;
  }

  private async getAccountIntelligence(orgName: string): Promise<any | null> {
    // This would integrate with account intelligence system
    // For Phase 1, return null or basic data
    // Future: Query account_intelligence table if it exists
    return null;
  }

  private async getHistoricalOutreach(contactId: string): Promise<any[]> {
    const { data } = await this.supabase
      .from('agent_outreach_drafts')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(5);

    return data || [];
  }

  /**
   * Get contact research data if available
   */
  private async getContactResearch(contactId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('contact_research')
      .select('*')
      .eq('contact_id', contactId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }
}


