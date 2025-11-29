import { BaseAgent } from './base-agent';
import { 
  AgentTask, 
  FollowupAgentConfig,
  TaskStatus
} from '@/lib/types/agents';
import { SavedSpeakerProfile } from '@/lib/types/database';
import { LLMService } from '@/lib/services/llm-service';
import { supabaseServer } from '@/lib/supabase-server';
import { sendOutreachEmail } from '@/lib/services/email-service';

/**
 * Follow-up Agent
 * Handles scheduling and executing follow-up messages for contacts
 */
export class FollowupAgent extends BaseAgent {
  private llmService: LLMService;

  constructor(agentId: string) {
    super(agentId);
    this.llmService = new LLMService();
  }

  async initialize(): Promise<void> {
    await super.initialize();
    const baseConfig = this.config as FollowupAgentConfig;
    
    // Set defaults if config is incomplete
    if (!baseConfig.defaultFollowupDelayDays) {
      baseConfig.defaultFollowupDelayDays = 3;
    }
    if (!baseConfig.maxFollowups) {
      baseConfig.maxFollowups = 3;
    }
    if (!baseConfig.escalationAfterAttempts) {
      baseConfig.escalationAfterAttempts = 2;
    }
    if (!baseConfig.followupTypes || baseConfig.followupTypes.length === 0) {
      baseConfig.followupTypes = ['reminder', 'value_add', 'escalation'];
    }
    this.config = baseConfig;
  }

  async processTask(task: AgentTask): Promise<{
    success: boolean;
    output?: Record<string, any>;
    requiresApproval?: boolean;
    error?: string;
  }> {
    if (task.task_type === 'schedule_followup') {
      return await this.scheduleFollowup(task);
    } else if (task.task_type === 'execute_followup') {
      return await this.executeFollowup(task);
    } else {
      return {
        success: false,
        error: `Unsupported task type: ${task.task_type}`
      };
    }
  }

  /**
   * Schedule a follow-up for a contact
   */
  private async scheduleFollowup(task: AgentTask): Promise<{
    success: boolean;
    output?: Record<string, any>;
    requiresApproval?: boolean;
    error?: string;
  }> {
    try {
      const input = task.input_data as {
        contactId: string;
        originalOutreachId?: string;
        opportunityId?: string;
        followupType?: 'reminder' | 'value_add' | 'escalation' | 'check_in';
        delayDays?: number;
      };

      const contact = await this.getContact(input.contactId);
      const config = this.config as FollowupAgentConfig;

      // Calculate follow-up date
      const delayDays = input.delayDays || config.defaultFollowupDelayDays;
      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() + delayDays);

      // Determine follow-up type
      const followupType = input.followupType || this.determineFollowupType(contact, input.originalOutreachId);

      // Check if we've exceeded max follow-ups
      const followupCount = await this.getFollowupCount(input.contactId, input.originalOutreachId);
      if (followupCount >= config.maxFollowups) {
        // Escalate to user instead
        await this.escalateToUser(input.contactId, input.originalOutreachId, followupCount);
        return {
          success: true,
          output: {
            escalated: true,
            reason: `Maximum follow-ups (${config.maxFollowups}) reached`
          }
        };
      }

      // Store scheduled follow-up
      if (!this.supabase) {
        this.supabase = await supabaseServer();
      }

      const { data: scheduledFollowup, error } = await this.supabase
        .from('agent_followup_schedule')
        .insert({
          agent_id: this.agentId,
          contact_id: input.contactId,
          original_outreach_id: input.originalOutreachId || null,
          scheduled_for: scheduledFor.toISOString(),
          followup_type: followupType,
          status: 'scheduled'
        })
        .select()
        .single();

      if (error || !scheduledFollowup) {
        throw new Error(`Failed to schedule follow-up: ${error?.message}`);
      }

      await this.logActivity(
        'followup_scheduled',
        `Scheduled ${followupType} follow-up for ${contact.speaker_data.name} on ${scheduledFor.toLocaleDateString()}`,
        task.id,
        { followupId: scheduledFollowup.id, scheduledFor: scheduledFor.toISOString() }
      );

      return {
        success: true,
        output: {
          followupId: scheduledFollowup.id,
          scheduledFor: scheduledFor.toISOString(),
          followupType
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a scheduled follow-up
   */
  private async executeFollowup(task: AgentTask): Promise<{
    success: boolean;
    output?: Record<string, any>;
    requiresApproval?: boolean;
    error?: string;
  }> {
    try {
      const input = task.input_data as {
        followupId: string;
        contactId: string;
        opportunityId?: string;
      };

      if (!this.supabase) {
        this.supabase = await supabaseServer();
      }

      // Get scheduled follow-up
      const { data: followup, error: followupError } = await this.supabase
        .from('agent_followup_schedule')
        .select('*')
        .eq('id', input.followupId)
        .single();

      if (followupError || !followup) {
        throw new Error(`Follow-up not found: ${followupError?.message}`);
      }

      if (followup.status !== 'scheduled') {
        throw new Error(`Follow-up is not scheduled (status: ${followup.status})`);
      }

      // Get contact and original outreach
      const contact = await this.getContact(input.contactId);
      const originalOutreach = followup.original_outreach_id
        ? await this.getOriginalOutreach(followup.original_outreach_id)
        : null;
      const opportunity = input.opportunityId
        ? await this.getOpportunity(input.opportunityId)
        : null;

      // Draft follow-up message
      const draft = await this.draftFollowupMessage({
        contact,
        originalOutreach,
        opportunity,
        followupType: followup.followup_type as 'reminder' | 'value_add' | 'escalation' | 'check_in'
      });

      // Update follow-up status to executed
      await this.supabase
        .from('agent_followup_schedule')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString(),
          message_draft: draft.messageBody
        })
        .eq('id', input.followupId);

      // Send message if contact has email
      // Check for email in speaker_data or enhanced_data
      const contactEmail = (contact.speaker_data as any)?.email || 
                          (contact.enhanced_data as any)?.email ||
                          (contact as any).email;
      
      let sentRecord = null;
      if (contactEmail) {
        const emailResult = await sendOutreachEmail(
          contactEmail,
          draft.subject || 'Following up',
          draft.messageBody
        );

        if (emailResult.success) {
          // Create sent record
          const { data: sentData } = await this.supabase
            .from('agent_outreach_sent')
            .insert({
              agent_id: this.agentId,
              contact_id: input.contactId,
              opportunity_id: input.opportunityId || null,
              channel: 'email',
              recipient_email: contactEmail,
              recipient_name: contact.speaker_data?.name || null,
              subject: draft.subject,
              message_body: draft.messageBody,
              sent_at: new Date().toISOString(),
              delivery_status: emailResult.blocked ? 'pending' : 'sent',
              metadata: {
                followupId: input.followupId,
                followupType: followup.followup_type,
                messageId: emailResult.messageId,
                blocked: emailResult.blocked || false,
              },
            })
            .select()
            .single();

          sentRecord = sentData;
        }
      }

      await this.logActivity(
        'followup_executed',
        `Executed ${followup.followup_type} follow-up for ${contact.speaker_data.name}`,
        task.id,
        { followupId: input.followupId, sent: !!sentRecord }
      );

      // Update metrics
      await this.updateMetrics('message_sent');

      return {
        success: true,
        output: {
          followupId: input.followupId,
          messageDrafted: true,
          messageSent: !!sentRecord,
          sentRecordId: sentRecord?.id
        },
        requiresApproval: false // Follow-ups are auto-sent (can be configured)
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Draft a follow-up message using LLM
   */
  private async draftFollowupMessage(context: {
    contact: SavedSpeakerProfile;
    originalOutreach: any | null;
    opportunity: any | null;
    followupType: 'reminder' | 'value_add' | 'escalation' | 'check_in';
  }): Promise<{ subject: string | null; messageBody: string }> {
    const { contact, originalOutreach, opportunity, followupType } = context;

    const prompt = this.buildFollowupPrompt({
      contact,
      originalOutreach,
      opportunity,
      followupType
    });

    const llmResponse = await this.llmService.generateOutreachMessage(prompt);
    const { subject, messageBody } = this.parseLLMResponse(llmResponse.content);

    return { subject, messageBody };
  }

  /**
   * Build LLM prompt for follow-up message
   */
  private buildFollowupPrompt(context: {
    contact: SavedSpeakerProfile;
    originalOutreach: any | null;
    opportunity: any | null;
    followupType: string;
  }): string {
    const { contact, originalOutreach, opportunity, followupType } = context;

    let prompt = `Draft a ${followupType} follow-up message for ${contact.speaker_data.name}.\n\n`;

    prompt += `CONTACT INFORMATION:\n`;
    prompt += `- Name: ${contact.speaker_data.name}\n`;
    if (contact.speaker_data?.title) {
      prompt += `- Title: ${contact.speaker_data.title}\n`;
    }
    if (contact.speaker_data?.org) {
      prompt += `- Organization: ${contact.speaker_data.org}\n`;
    }
    prompt += `\n`;

    if (originalOutreach) {
      prompt += `ORIGINAL OUTREACH:\n`;
      prompt += `- Sent: ${new Date(originalOutreach.sent_at || originalOutreach.created_at).toLocaleDateString()}\n`;
      if (originalOutreach.subject) {
        prompt += `- Subject: ${originalOutreach.subject}\n`;
      }
      prompt += `- Message: ${originalOutreach.message_body?.substring(0, 200)}...\n`;
      prompt += `\n`;
    }

    if (opportunity) {
      prompt += `EVENT CONTEXT:\n`;
      const event = opportunity.event || opportunity;
      prompt += `- Event: ${event.title || 'Unknown'}\n`;
      if (event.starts_at) {
        prompt += `- Date: ${new Date(event.starts_at).toLocaleDateString()}\n`;
      }
      prompt += `\n`;
    }

    prompt += `FOLLOW-UP TYPE: ${followupType}\n`;
    prompt += `\n`;

    if (followupType === 'reminder') {
      prompt += `This is a gentle reminder about the previous message. Be brief, friendly, and non-pushy.\n`;
    } else if (followupType === 'value_add') {
      prompt += `This follow-up should add value - share relevant information, insights, or resources that would be helpful.\n`;
    } else if (followupType === 'escalation') {
      prompt += `This is an escalation follow-up. Be more direct but still professional. Offer alternative ways to connect.\n`;
    } else if (followupType === 'check_in') {
      prompt += `This is a check-in to see how things are going. Be warm and conversational.\n`;
    }

    prompt += `\nREQUIREMENTS:\n`;
    prompt += `- Professional but warm tone\n`;
    prompt += `- Reference the previous outreach naturally\n`;
    prompt += `- Keep it concise (2-3 paragraphs max)\n`;
    prompt += `- Include clear call-to-action\n`;
    prompt += `- Don't be pushy or salesy\n`;
    prompt += `\n`;

    prompt += `Generate the subject line and message body. Format as JSON:\n`;
    prompt += `{\n`;
    prompt += `  "subject": "Subject line here",\n`;
    prompt += `  "messageBody": "Message body here"\n`;
    prompt += `}\n`;

    return prompt;
  }

  /**
   * Parse LLM response
   */
  private parseLLMResponse(response: string): { subject: string | null; messageBody: string } {
    try {
      const parsed = this.llmService.parseJSONResponse<{
        subject?: string;
        messageBody: string;
      }>(response);
      
      return {
        subject: parsed.subject || null,
        messageBody: parsed.messageBody || response
      };
    } catch {
      return {
        subject: 'Following up',
        messageBody: response
      };
    }
  }

  /**
   * Determine appropriate follow-up type based on context
   */
  private determineFollowupType(contact: SavedSpeakerProfile, originalOutreachId: string | undefined): 'reminder' | 'value_add' | 'escalation' | 'check_in' {
    // For now, default to reminder
    // Can be enhanced with logic based on:
    // - Number of previous follow-ups
    // - Time since original outreach
    // - Contact engagement level
    return 'reminder';
  }

  /**
   * Get count of follow-ups for a contact
   */
  private async getFollowupCount(contactId: string, originalOutreachId?: string): Promise<number> {
    if (!this.supabase) {
      this.supabase = await supabaseServer();
    }

    let query = this.supabase
      .from('agent_followup_schedule')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', contactId)
      .in('status', ['scheduled', 'executed']);

    if (originalOutreachId) {
      query = query.eq('original_outreach_id', originalOutreachId);
    }

    const { count } = await query;
    return count || 0;
  }

  /**
   * Escalate to user when max follow-ups reached
   */
  private async escalateToUser(contactId: string, originalOutreachId: string | undefined, followupCount: number): Promise<void> {
    await this.logActivity(
      'escalation',
      `Escalated contact after ${followupCount} follow-ups - requires manual attention`,
      undefined,
      { contactId, originalOutreachId, followupCount }
    );

    // Could also create a notification or alert here
  }

  /**
   * Helper methods
   */
  private async getContact(contactId: string): Promise<SavedSpeakerProfile> {
    if (!this.supabase) {
      this.supabase = await supabaseServer();
    }

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

  private async getOriginalOutreach(outreachId: string): Promise<any> {
    if (!this.supabase) {
      this.supabase = await supabaseServer();
    }

    const { data, error } = await this.supabase
      .from('agent_outreach_sent')
      .select('*')
      .eq('id', outreachId)
      .single();

    if (error || !data) {
      // Fallback to draft if sent record doesn't exist
      const { data: draft } = await this.supabase
        .from('agent_outreach_drafts')
        .select('*')
        .eq('id', outreachId)
        .single();

      return draft;
    }

    return data;
  }

  private async getOpportunity(opportunityId: string): Promise<any> {
    if (!this.supabase) {
      this.supabase = await supabaseServer();
    }

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

  /**
   * Update metrics (override to add follow-up specific metrics)
   */
  protected async updateMetrics(event: 'task_completed' | 'task_failed' | 'message_sent' | 'response_received'): Promise<void> {
    await super.updateMetrics(event);
    // Can add follow-up specific metrics here
  }
}

