/**
 * PHASE 1: Critical Alerts Service
 * 
 * Sends email/Slack notifications for high-confidence watchlist matches.
 * Alerts users when target accounts are found at events.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { Opportunity } from './discovery-engine';

export interface AlertPreferences {
  enable_email: boolean;
  enable_slack: boolean;
  email_address?: string;
  slack_webhook_url?: string;
}

export interface CriticalAlert {
  userId: string;
  opportunity: Opportunity;
  eventTitle: string;
  eventDate: string | null;
  matchedAccounts: Array<{
    account_name: string;
    confidence_score: number;
    speakers: Array<{ name: string; title: string }>;
  }>;
}

export class CriticalAlertsService {
  /**
   * Send critical alert for high-confidence watchlist match
   */
  static async sendCriticalAlert(alert: CriticalAlert): Promise<boolean> {
    try {
      // Get user's alert preferences
      const preferences = await this.getAlertPreferences(alert.userId);
      
      if (!preferences.enable_email && !preferences.enable_slack) {
        console.log('[critical-alerts] Alerts disabled for user:', alert.userId);
        return false;
      }

      const results = await Promise.allSettled([
        preferences.enable_email && preferences.email_address
          ? this.sendEmailAlert(alert, preferences.email_address)
          : Promise.resolve(false),
        preferences.enable_slack && preferences.slack_webhook_url
          ? this.sendSlackAlert(alert, preferences.slack_webhook_url)
          : Promise.resolve(false)
      ]);

      const success = results.some(r => r.status === 'fulfilled' && r.value === true);

      console.log(JSON.stringify({
        at: 'critical_alert_sent',
        userId: alert.userId,
        success,
        emailSent: preferences.enable_email,
        slackSent: preferences.enable_slack
      }));

      return success;
    } catch (error) {
      console.error('[critical-alerts] Error sending critical alert:', error);
      return false;
    }
  }

  /**
   * Get user's alert preferences
   */
  private static async getAlertPreferences(userId: string): Promise<AlertPreferences> {
    try {
      const supabase = await supabaseServer();

      // Get from discovery profile
      const { data: profile, error } = await supabase
        .from('user_discovery_profiles')
        .select('enable_critical_alerts')
        .eq('user_id', userId)
        .single();

      if (error || !profile || !profile.enable_critical_alerts) {
        return {
          enable_email: false,
          enable_slack: false
        };
      }

      // Get user email from auth
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);

      // TODO: In future, store Slack webhook in user preferences table
      return {
        enable_email: true,
        enable_slack: false, // TODO: Implement Slack webhook storage
        email_address: user?.email || undefined
      };
    } catch (error) {
      console.error('[critical-alerts] Error getting alert preferences:', error);
      return {
        enable_email: false,
        enable_slack: false
      };
    }
  }

  /**
   * Send email alert
   */
  private static async sendEmailAlert(
    alert: CriticalAlert,
    emailAddress: string
  ): Promise<boolean> {
    try {
      // TODO: Integrate with email service (SendGrid, Resend, etc.)
      // For Phase 1, we'll log the email content
      
      const emailContent = this.generateEmailContent(alert);

      console.log(JSON.stringify({
        at: 'critical_alert_email',
        to: emailAddress,
        subject: `🎯 Target Account Alert: ${alert.matchedAccounts.length} account(s) found at event`,
        content: emailContent
      }));

      // In production, send actual email:
      // await emailService.send({
      //   to: emailAddress,
      //   subject: `🎯 Target Account Alert: ${alert.matchedAccounts.length} account(s) found at event`,
      //   html: emailContent
      // });

      return true;
    } catch (error) {
      console.error('[critical-alerts] Error sending email:', error);
      return false;
    }
  }

  /**
   * Send Slack alert
   */
  private static async sendSlackAlert(
    alert: CriticalAlert,
    webhookUrl: string
  ): Promise<boolean> {
    try {
      const slackMessage = this.generateSlackMessage(alert);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(slackMessage)
      });

      return response.ok;
    } catch (error) {
      console.error('[critical-alerts] Error sending Slack alert:', error);
      return false;
    }
  }

  /**
   * Generate email content
   */
  private static generateEmailContent(alert: CriticalAlert): string {
    const accountsList = alert.matchedAccounts
      .map(acc => {
        const speakersList = acc.speakers
          .map(s => `  • ${s.name}${s.title ? ` (${s.title})` : ''}`)
          .join('\n');
        return `**${acc.account_name}** (${acc.confidence_score}% confidence)\n${speakersList}`;
      })
      .join('\n\n');

    return `
      <h2>🎯 Target Account Alert</h2>
      <p>We found ${alert.matchedAccounts.length} of your target accounts at an upcoming event!</p>
      
      <h3>Event Details</h3>
      <ul>
        <li><strong>Event:</strong> ${alert.eventTitle}</li>
        <li><strong>Date:</strong> ${alert.eventDate || 'TBD'}</li>
      </ul>
      
      <h3>Matched Accounts</h3>
      <pre>${accountsList}</pre>
      
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/opportunities/${alert.opportunity.id}">View Opportunity →</a></p>
      
      <p><small>You're receiving this because you have critical alerts enabled for watchlist matches.</small></p>
    `;
  }

  /**
   * Generate Slack message
   */
  private static generateSlackMessage(alert: CriticalAlert): any {
    const accountsBlocks = alert.matchedAccounts.map(acc => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${acc.account_name}* (${acc.confidence_score}% confidence)\n${acc.speakers.map(s => `• ${s.name}${s.title ? ` (${s.title})` : ''}`).join('\n')}`
      }
    }));

    return {
      text: `🎯 Target Account Alert: ${alert.matchedAccounts.length} account(s) found at event`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎯 Target Account Alert'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `We found *${alert.matchedAccounts.length}* of your target accounts at an upcoming event!`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Event:*\n${alert.eventTitle}`
            },
            {
              type: 'mrkdwn',
              text: `*Date:*\n${alert.eventDate || 'TBD'}`
            }
          ]
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Matched Accounts:*'
          }
        },
        ...accountsBlocks,
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Opportunity'
              },
              url: `${process.env.NEXT_PUBLIC_APP_URL}/opportunities/${alert.opportunity.id}`
            }
          ]
        }
      ]
    };
  }
}

