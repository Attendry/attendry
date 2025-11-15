/**
 * Event Board Type Definitions
 * 
 * Types for the Event Kanban Board feature
 */

import { UserEventBoardItem } from './database';
import { EventData } from './core';

/**
 * Board item with full event data
 */
export interface BoardItemWithEvent extends UserEventBoardItem {
  event?: EventData | null;
}

/**
 * Column status type
 */
export type ColumnStatus = 'interested' | 'researching' | 'attending' | 'follow-up' | 'archived';

/**
 * Column configuration
 */
export interface BoardColumn {
  id: ColumnStatus;
  label: string;
  color: string;
  items: BoardItemWithEvent[];
}

/**
 * Add event to board request
 */
export interface AddEventToBoardRequest {
  eventId?: string;
  eventUrl: string;
  eventData?: EventData;
  columnStatus?: ColumnStatus;
}

/**
 * Update board item request
 */
export interface UpdateBoardItemRequest {
  id: string;
  columnStatus?: ColumnStatus;
  position?: number;
  notes?: string;
  tags?: string[];
}

/**
 * Attendee insight
 */
export interface AttendeeInsight {
  name: string;
  company?: string;
  role: 'speaker' | 'sponsor' | 'attendee' | 'organizer' | 'partner';
  title?: string;
  confidence: number;
}

/**
 * Trend insight
 */
export interface TrendInsight {
  type: 'industry' | 'event_type' | 'geographic' | 'temporal';
  label: string;
  value: number;
  change?: number; // Percentage change
  description?: string;
}

/**
 * Positioning recommendation
 */
export interface PositioningRecommendation {
  action: 'sponsor' | 'speak' | 'attend' | 'network';
  score: number;
  reasoning: string[];
  opportunity: 'high' | 'medium' | 'low';
}

/**
 * Recommendation insight (Phase 2A)
 */
export interface RecommendationInsight {
  id: string;
  type: 'immediate' | 'strategic' | 'research';
  title: string;
  description: string;
  why: string;
  when: string;
  how: string | null;
  expectedOutcome: string;
  priority: number;
  confidence: number;
  metadata?: {
    roiEstimate?: string;
    estimatedCost?: string;
    timeToExecute?: string;
    requiredResources?: string[];
  };
}

/**
 * Event insights response
 */
export interface EventInsightsResponse {
  attendees: AttendeeInsight[];
  trends: TrendInsight[];
  positioning: PositioningRecommendation[];
  recommendations?: RecommendationInsight[]; // Phase 2A: Recommendations
  insightScore?: any; // Phase 2B: Insight Score (using any to avoid circular dependency)
  competitiveContext?: any; // Phase 2C: Competitive Intelligence (using any to avoid circular dependency)
  competitiveAlerts?: any[]; // Phase 2C: Competitive Alerts
}

