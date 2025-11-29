/**
 * PHASE 1: Temporal Intelligence Engine (V2 - Gap 1)
 * 
 * Calculates optimal action timing for opportunities, telling users WHEN to act.
 * Provides urgency levels, action windows, and recommended actions based on
 * days until event.
 */

export interface ActionTiming {
  urgency: 'critical' | 'high' | 'medium' | 'low';
  optimal_outreach_date: string; // ISO date string
  days_until_event: number;
  action_window_status: 'open' | 'closing_soon' | 'closed';
  recommended_actions: string[];
}

export class TemporalIntelligenceEngine {
  /**
   * Calculate action timing for an opportunity based on event date
   * 
   * @param eventDate Event start date (ISO string or Date)
   * @param currentDate Optional current date (defaults to now)
   * @returns Action timing information
   */
  static calculateActionTiming(
    eventDate: string | Date | null,
    currentDate: Date = new Date()
  ): ActionTiming | null {
    if (!eventDate) {
      return null;
    }

    const event = typeof eventDate === 'string' ? new Date(eventDate) : eventDate;
    const now = currentDate;

    // Calculate days until event
    const daysUntil = Math.ceil((event.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Optimal outreach window: 2 weeks before event
    const optimalOutreachDays = 14;
    const optimalOutreachDate = new Date(event);
    optimalOutreachDate.setDate(optimalOutreachDate.getDate() - optimalOutreachDays);

    // Determine urgency level
    let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (daysUntil <= 7) {
      urgency = 'critical';
    } else if (daysUntil <= 14) {
      urgency = 'high';
    } else if (daysUntil <= 30) {
      urgency = 'medium';
    } else {
      urgency = 'low';
    }

    // Determine action window status
    let action_window_status: 'open' | 'closing_soon' | 'closed' = 'open';
    if (daysUntil < 0) {
      action_window_status = 'closed';
    } else if (daysUntil <= 7) {
      action_window_status = 'closing_soon';
    } else {
      action_window_status = 'open';
    }

    // Generate recommended actions based on urgency
    const recommended_actions: string[] = [];
    
    if (urgency === 'critical') {
      recommended_actions.push(
        'Send immediate connection request',
        'Request urgent meeting',
        'Reach out via email today'
      );
    } else if (urgency === 'high') {
      recommended_actions.push(
        'Connect on LinkedIn this week',
        'Send personalized outreach',
        'Schedule a call before the event'
      );
    } else if (urgency === 'medium') {
      recommended_actions.push(
        'Add to calendar',
        'Research speakers and topics',
        'Plan outreach strategy'
      );
    } else {
      recommended_actions.push(
        'Monitor for updates',
        'Plan ahead',
        'Set reminder for optimal outreach date'
      );
    }

    return {
      urgency,
      optimal_outreach_date: optimalOutreachDate.toISOString(),
      days_until_event: daysUntil,
      action_window_status,
      recommended_actions
    };
  }

  /**
   * Calculate urgency badge color for UI
   */
  static getUrgencyColor(urgency: 'critical' | 'high' | 'medium' | 'low'): string {
    switch (urgency) {
      case 'critical':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'gray';
      default:
        return 'gray';
    }
  }

  /**
   * Get urgency label for UI
   */
  static getUrgencyLabel(urgency: 'critical' | 'high' | 'medium' | 'low'): string {
    switch (urgency) {
      case 'critical':
        return 'Act now';
      case 'high':
        return 'This week';
      case 'medium':
        return 'This month';
      case 'low':
        return 'Monitor';
      default:
        return 'Monitor';
    }
  }

  /**
   * Format days until event for display
   */
  static formatDaysUntil(days: number): string {
    if (days < 0) {
      return 'Event passed';
    } else if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Tomorrow';
    } else if (days < 7) {
      return `${days} days`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    } else {
      const months = Math.floor(days / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    }
  }
}

