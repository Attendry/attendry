/**
 * Recommendation Engine Service
 * 
 * Converts insights into specific, actionable recommendations with:
 * - Clear "what, why, when, how" for each recommendation
 * - Ranking by priority and impact
 * - Multiple recommendation types (immediate, strategic, research)
 * 
 * Phase 2A Implementation: Recommendations Engine
 */

import { EventData, UserProfile } from '@/lib/types/core';
import { EventIntelligence } from './event-intelligence-service';
import { OpportunityScore, UrgencyIndicators } from './opportunity-scoring-service';
import { LLMService } from './llm-service';
import crypto from 'crypto';

/**
 * Recommendation types
 */
export type RecommendationType = 'immediate' | 'strategic' | 'research';

/**
 * Insight type that generated the recommendation
 */
export type InsightType = 'event' | 'trend' | 'account' | 'competitive';

/**
 * Recommendation data structure
 */
export interface Recommendation {
  id: string;
  type: RecommendationType;
  insightType: InsightType;
  title: string;
  description: string;
  why: string; // Why it matters
  when: string; // When to act (urgency)
  how: string | null; // How to execute (if applicable)
  expectedOutcome: string;
  priority: number; // 0-1
  confidence: number; // 0-1
  relatedInsightId: string;
  relatedEventId?: string;
  relatedTrendId?: string;
  metadata?: {
    roiEstimate?: string;
    estimatedCost?: string;
    timeToExecute?: string;
    requiredResources?: string[];
  };
}

/**
 * Recommendation generation context
 */
export interface RecommendationContext {
  event?: EventData;
  eventIntelligence?: EventIntelligence;
  opportunityScore?: OpportunityScore;
  urgencyIndicators?: UrgencyIndicators;
  userProfile?: UserProfile;
  trendData?: {
    category: string;
    growthRate: number;
    momentum: number;
  };
  competitiveData?: {
    competitors: string[];
    competitorActivity: string[];
    gaps: string[];
  };
}

/**
 * Ranking factors for recommendations
 */
interface RankingFactors {
  urgency: number; // 0-1, from urgency indicators - 30%
  impact: number; // 0-1, from opportunity score - 30%
  feasibility: number; // 0-1, data quality + actionability - 20%
  relevance: number; // 0-1, user profile match - 20%
}

/**
 * Generate recommendations for an event
 */
export async function generateEventRecommendations(
  event: EventData,
  eventIntelligence: EventIntelligence,
  userProfile?: UserProfile
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];
  
  // Extract context
  const context: RecommendationContext = {
    event,
    eventIntelligence,
    opportunityScore: eventIntelligence.opportunityScore,
    urgencyIndicators: eventIntelligence.urgencyIndicators,
    userProfile
  };

  // Generate event-based recommendations
  const eventRecommendations = await generateEventBasedRecommendations(context);
  recommendations.push(...eventRecommendations);

  // Rank all recommendations
  const rankedRecommendations = rankRecommendations(recommendations, context);

  return rankedRecommendations;
}

/**
 * Generate event-based recommendations
 */
async function generateEventBasedRecommendations(
  context: RecommendationContext
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];
  const { event, eventIntelligence, opportunityScore, urgencyIndicators, userProfile } = context;

  if (!event || !eventIntelligence) {
    return recommendations;
  }

  // 1. Sponsor event recommendation
  if (opportunityScore && opportunityScore.overallScore > 0.6) {
    const sponsorRec = await generateSponsorRecommendation(context);
    if (sponsorRec) recommendations.push(sponsorRec);
  }

  // 2. Speak at event recommendation
  if (eventIntelligence.discussions?.themes && eventIntelligence.discussions.themes.length > 0) {
    const speakRec = await generateSpeakRecommendation(context);
    if (speakRec) recommendations.push(speakRec);
  }

  // 3. Attend event recommendation
  if (opportunityScore && opportunityScore.icpMatchScore > 0.5) {
    const attendRec = await generateAttendRecommendation(context);
    if (attendRec) recommendations.push(attendRec);
  }

  // 4. Research event recommendation (if data incomplete)
  if (event.data_completeness && event.data_completeness < 0.6) {
    const researchRec = await generateResearchRecommendation(context);
    if (researchRec) recommendations.push(researchRec);
  }

  return recommendations;
}

/**
 * Generate sponsor event recommendation
 */
async function generateSponsorRecommendation(
  context: RecommendationContext
): Promise<Recommendation | null> {
  const { event, eventIntelligence, opportunityScore, userProfile } = context;
  if (!event || !opportunityScore) return null;

  const insightId = `event_${event.id || event.source_url}`;
  const recommendationId = `rec_${crypto.createHash('sha256').update(`${insightId}_sponsor`).digest('hex').substring(0, 16)}`;

  // Use LLM to generate contextual recommendation
  const prompt = `You are a strategic business advisor analyzing event sponsorship opportunities.

Event: ${event.title}
${event.description ? `Description: ${event.description.substring(0, 500)}` : ''}
${event.city ? `Location: ${event.city}, ${event.country || ''}` : ''}
${event.starts_at ? `Date: ${event.starts_at}` : ''}
${eventIntelligence?.sponsors ? `Current Sponsors: ${JSON.stringify(eventIntelligence.sponsors.tiers)}` : ''}
${opportunityScore ? `Opportunity Score: ${opportunityScore.overallScore.toFixed(2)}` : ''}
${opportunityScore?.roiEstimate ? `ROI Estimate: ${opportunityScore.roiEstimate}` : ''}
${userProfile?.company ? `Company: ${userProfile.company}` : ''}
${userProfile?.industry_terms ? `Industry: ${userProfile.industry_terms.join(', ')}` : ''}

Generate a sponsorship recommendation with:
1. A compelling title (max 60 chars)
2. A clear description of why sponsoring makes sense (2-3 sentences)
3. Why it matters - business rationale (2-3 sentences)
4. When to act - urgency and timing (1-2 sentences)
5. How to execute - actionable steps (3-4 bullet points)
6. Expected outcome - what success looks like (1-2 sentences)
7. ROI estimate if available
8. Estimated cost range if known
9. Time to execute (e.g., "2-4 weeks")
10. Required resources (e.g., ["Marketing budget", "Sales team", "Event materials"])

Return ONLY valid JSON in this exact format:
{
  "title": "...",
  "description": "...",
  "why": "...",
  "when": "...",
  "how": "...",
  "expectedOutcome": "...",
  "roiEstimate": "...",
  "estimatedCost": "...",
  "timeToExecute": "...",
  "requiredResources": ["...", "..."]
}`;

  try {
    const response = await LLMService.generateIntelligence(prompt, {}, {
      temperature: 0.3,
      responseFormat: 'json'
    });

    const data = typeof response.content === 'string' ? JSON.parse(response.content) : response.content;

    const recommendation: Recommendation = {
      id: recommendationId,
      type: opportunityScore.urgencyScore > 0.7 ? 'immediate' : 'strategic',
      insightType: 'event',
      title: data.title || `Sponsor ${event.title}`,
      description: data.description || 'High-value sponsorship opportunity',
      why: data.why || 'Strong alignment with target audience and business objectives',
      when: data.when || 'Act within 2-4 weeks',
      how: data.how || null,
      expectedOutcome: data.expectedOutcome || 'Increased brand visibility and lead generation',
      priority: calculatePriority(context, 'sponsor'),
      confidence: opportunityScore.confidence || 0.7,
      relatedInsightId: insightId,
      relatedEventId: event.id,
      metadata: {
        roiEstimate: data.roiEstimate,
        estimatedCost: data.estimatedCost,
        timeToExecute: data.timeToExecute,
        requiredResources: data.requiredResources
      }
    };

    return recommendation;
  } catch (error) {
    console.error('[RecommendationEngine] Error generating sponsor recommendation:', error);
    // Return a basic recommendation if LLM fails
    return {
      id: recommendationId,
      type: 'strategic',
      insightType: 'event',
      title: `Sponsor ${event.title}`,
      description: `High-value sponsorship opportunity with strong ICP match (${(opportunityScore.icpMatchScore * 100).toFixed(0)}%)`,
      why: `This event aligns with your target audience and offers significant brand visibility and lead generation potential.`,
      when: urgencyIndicators?.daysUntilEvent ? `Act within ${Math.max(1, Math.floor(urgencyIndicators.daysUntilEvent / 7))} weeks` : 'Act within 2-4 weeks',
      how: `1. Contact event organizer to discuss sponsorship packages\n2. Review available sponsorship tiers and benefits\n3. Prepare marketing materials and booth setup\n4. Coordinate with sales team for lead follow-up`,
      expectedOutcome: `Increased brand awareness, qualified leads, and potential partnerships with attendees.`,
      priority: calculatePriority(context, 'sponsor'),
      confidence: opportunityScore.confidence || 0.7,
      relatedInsightId: insightId,
      relatedEventId: event.id,
      metadata: {
        roiEstimate: opportunityScore.roiEstimate,
        timeToExecute: '2-4 weeks'
      }
    };
  }
}

/**
 * Generate speak at event recommendation
 */
async function generateSpeakRecommendation(
  context: RecommendationContext
): Promise<Recommendation | null> {
  const { event, eventIntelligence, userProfile } = context;
  if (!event || !eventIntelligence?.discussions) return null;

  const insightId = `event_${event.id || event.source_url}`;
  const recommendationId = `rec_${crypto.createHash('sha256').update(`${insightId}_speak`).digest('hex').substring(0, 16)}`;

  const prompt = `You are a strategic business advisor analyzing speaking opportunities at events.

Event: ${event.title}
${event.description ? `Description: ${event.description.substring(0, 500)}` : ''}
Key Themes: ${eventIntelligence.discussions.themes.join(', ')}
${eventIntelligence.discussions.keyTopics ? `Key Topics: ${JSON.stringify(eventIntelligence.discussions.keyTopics)}` : ''}
${userProfile?.company ? `Company: ${userProfile.company}` : ''}
${userProfile?.industry_terms ? `Industry: ${userProfile.industry_terms.join(', ')}` : ''}

Generate a speaking opportunity recommendation with:
1. A compelling title (max 60 chars)
2. A clear description (2-3 sentences)
3. Why it matters - positioning rationale (2-3 sentences)
4. When to act - urgency (1-2 sentences)
5. How to execute - actionable steps (3-4 bullet points)
6. Expected outcome (1-2 sentences)
7. Time to execute
8. Required resources

Return ONLY valid JSON in this exact format:
{
  "title": "...",
  "description": "...",
  "why": "...",
  "when": "...",
  "how": "...",
  "expectedOutcome": "...",
  "timeToExecute": "...",
  "requiredResources": ["...", "..."]
}`;

  try {
    const response = await LLMService.generateIntelligence(prompt, {}, {
      temperature: 0.3,
      responseFormat: 'json'
    });

    const data = typeof response.content === 'string' ? JSON.parse(response.content) : response.content;

    return {
      id: recommendationId,
      type: context.urgencyIndicators?.urgencyLevel === 'critical' ? 'immediate' : 'strategic',
      insightType: 'event',
      title: data.title || `Speak at ${event.title}`,
      description: data.description || 'Position yourself as a thought leader',
      why: data.why || 'Establish authority and connect with target audience',
      when: data.when || 'Submit proposal within 2-3 weeks',
      how: data.how || null,
      expectedOutcome: data.expectedOutcome || 'Increased visibility and credibility',
      priority: calculatePriority(context, 'speak'),
      confidence: eventIntelligence.confidence || 0.7,
      relatedInsightId: insightId,
      relatedEventId: event.id,
      metadata: {
        timeToExecute: data.timeToExecute || '2-3 weeks',
        requiredResources: data.requiredResources
      }
    };
  } catch (error) {
    console.error('[RecommendationEngine] Error generating speak recommendation:', error);
    return {
      id: recommendationId,
      type: 'strategic',
      insightType: 'event',
      title: `Speak at ${event.title}`,
      description: `Position yourself as a thought leader on topics: ${eventIntelligence.discussions.themes.slice(0, 3).join(', ')}`,
      why: `Speaking at this event establishes your authority and connects you directly with your target audience.`,
      when: 'Submit speaking proposal within 2-3 weeks',
      how: `1. Review event themes and identify your expertise areas\n2. Prepare a compelling speaking proposal\n3. Contact event organizer with your proposal\n4. Prepare presentation materials if accepted`,
      expectedOutcome: `Increased brand visibility, thought leadership positioning, and networking opportunities.`,
      priority: calculatePriority(context, 'speak'),
      confidence: eventIntelligence.confidence || 0.7,
      relatedInsightId: insightId,
      relatedEventId: event.id
    };
  }
}

/**
 * Generate attend event recommendation
 */
async function generateAttendRecommendation(
  context: RecommendationContext
): Promise<Recommendation | null> {
  const { event, eventIntelligence, opportunityScore, userProfile } = context;
  if (!event || !opportunityScore) return null;

  const insightId = `event_${event.id || event.source_url}`;
  const recommendationId = `rec_${crypto.createHash('sha256').update(`${insightId}_attend`).digest('hex').substring(0, 16)}`;

  const prompt = `You are a strategic business advisor analyzing event attendance opportunities.

Event: ${event.title}
${event.description ? `Description: ${event.description.substring(0, 500)}` : ''}
${eventIntelligence?.discussions ? `Key Themes: ${eventIntelligence.discussions.themes.join(', ')}` : ''}
${eventIntelligence?.sponsors ? `Sponsors: ${eventIntelligence.sponsors.industries.join(', ')}` : ''}
ICP Match: ${(opportunityScore.icpMatchScore * 100).toFixed(0)}%
${userProfile?.company ? `Company: ${userProfile.company}` : ''}

Generate an attendance recommendation with:
1. A compelling title (max 60 chars)
2. A clear description (2-3 sentences)
3. Why it matters - networking and learning rationale (2-3 sentences)
4. When to act - registration urgency (1-2 sentences)
5. How to execute - actionable steps (3-4 bullet points)
6. Expected outcome (1-2 sentences)
7. Time to execute
8. Required resources

Return ONLY valid JSON in this exact format:
{
  "title": "...",
  "description": "...",
  "why": "...",
  "when": "...",
  "how": "...",
  "expectedOutcome": "...",
  "timeToExecute": "...",
  "requiredResources": ["...", "..."]
}`;

  try {
    const response = await LLMService.generateIntelligence(prompt, {}, {
      temperature: 0.3,
      responseFormat: 'json'
    });

    const data = typeof response.content === 'string' ? JSON.parse(response.content) : response.content;

    return {
      id: recommendationId,
      type: context.urgencyIndicators?.urgencyLevel === 'critical' || context.urgencyIndicators?.urgencyLevel === 'high' ? 'immediate' : 'strategic',
      insightType: 'event',
      title: data.title || `Attend ${event.title}`,
      description: data.description || 'High-value networking and learning opportunity',
      why: data.why || 'Connect with target audience and stay current with industry trends',
      when: data.when || context.urgencyIndicators?.recommendedAction || 'Register soon',
      how: data.how || null,
      expectedOutcome: data.expectedOutcome || 'Valuable connections and industry insights',
      priority: calculatePriority(context, 'attend'),
      confidence: opportunityScore.confidence || 0.7,
      relatedInsightId: insightId,
      relatedEventId: event.id,
      metadata: {
        timeToExecute: data.timeToExecute || '1-2 weeks',
        requiredResources: data.requiredResources
      }
    };
  } catch (error) {
    console.error('[RecommendationEngine] Error generating attend recommendation:', error);
    return {
      id: recommendationId,
      type: 'strategic',
      insightType: 'event',
      title: `Attend ${event.title}`,
      description: `High-value networking opportunity with ${(opportunityScore.icpMatchScore * 100).toFixed(0)}% ICP match`,
      why: `This event offers excellent opportunities to connect with your target audience and learn about industry trends.`,
      when: context.urgencyIndicators?.recommendedAction || 'Register soon to secure your spot',
      how: `1. Review event agenda and identify key sessions\n2. Register for the event\n3. Prepare networking materials (business cards, elevator pitch)\n4. Identify key attendees to connect with`,
      expectedOutcome: `Valuable business connections, industry insights, and potential partnerships.`,
      priority: calculatePriority(context, 'attend'),
      confidence: opportunityScore.confidence || 0.7,
      relatedInsightId: insightId,
      relatedEventId: event.id
    };
  }
}

/**
 * Generate research event recommendation
 */
async function generateResearchRecommendation(
  context: RecommendationContext
): Promise<Recommendation | null> {
  const { event } = context;
  if (!event) return null;

  const insightId = `event_${event.id || event.source_url}`;
  const recommendationId = `rec_${crypto.createHash('sha256').update(`${insightId}_research`).digest('hex').substring(0, 16)}`;

  return {
    id: recommendationId,
    type: 'research',
    insightType: 'event',
    title: `Research ${event.title}`,
    description: `Gather more information about this event to make an informed decision`,
    why: `Limited data available (${((event.data_completeness || 0) * 100).toFixed(0)}% complete). More research needed to assess opportunity.`,
    when: 'Before making any commitment',
    how: `1. Visit event website for detailed information\n2. Contact event organizer directly\n3. Research past event reviews and attendee feedback\n4. Check speaker and sponsor lists for relevance`,
    expectedOutcome: `Complete picture of event value and alignment with business objectives`,
    priority: 0.3, // Lower priority for research actions
    confidence: 0.5,
    relatedInsightId: insightId,
    relatedEventId: event.id,
    metadata: {
      timeToExecute: '1-2 days',
      requiredResources: ['Research time']
    }
  };
}

/**
 * Generate trend-based recommendations
 */
export async function generateTrendRecommendations(
  trendData: {
    category: string;
    growthRate: number;
    momentum: number;
    events: EventData[];
  },
  userProfile?: UserProfile
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];
  const insightId = `trend_${crypto.createHash('sha256').update(trendData.category).digest('hex').substring(0, 16)}`;

  // Capitalize on trending category
  if (trendData.growthRate > 0.3 && trendData.momentum > 0.5) {
    const capitalizeRec = await generateCapitalizeTrendRecommendation(trendData, userProfile, insightId);
    if (capitalizeRec) recommendations.push(capitalizeRec);
  }

  // Monitor emerging trend
  if (trendData.growthRate > 0.1 && trendData.momentum > 0.3) {
    const monitorRec = await generateMonitorTrendRecommendation(trendData, userProfile, insightId);
    if (monitorRec) recommendations.push(monitorRec);
  }

  // Research trend deeper
  if (trendData.events.length < 5) {
    const researchRec = generateResearchTrendRecommendation(trendData, userProfile, insightId);
    recommendations.push(researchRec);
  }

  return recommendations;
}

/**
 * Generate capitalize on trend recommendation
 */
async function generateCapitalizeTrendRecommendation(
  trendData: { category: string; growthRate: number; momentum: number; events: EventData[] },
  userProfile: UserProfile | undefined,
  insightId: string
): Promise<Recommendation | null> {
  const recommendationId = `rec_${crypto.createHash('sha256').update(`${insightId}_capitalize`).digest('hex').substring(0, 16)}`;

  return {
    id: recommendationId,
    type: 'strategic',
    insightType: 'trend',
    title: `Capitalize on ${trendData.category} Trend`,
    description: `Strong growth trend (${(trendData.growthRate * 100).toFixed(0)}% growth) with high momentum - opportunity to lead`,
    why: `This trend is rapidly growing and presents an opportunity to establish thought leadership and capture market share early.`,
    when: 'Act within 1-2 months to maximize impact',
    how: `1. Identify relevant events in this category\n2. Develop content and positioning around this trend\n3. Engage with events and communities in this space\n4. Monitor competitor activity`,
    expectedOutcome: `Early market positioning and thought leadership in a growing trend`,
    priority: 0.7,
    confidence: 0.8,
    relatedInsightId: insightId,
    relatedTrendId: trendData.category,
    metadata: {
      timeToExecute: '1-2 months',
      requiredResources: ['Content strategy', 'Event participation']
    }
  };
}

/**
 * Generate monitor trend recommendation
 */
async function generateMonitorTrendRecommendation(
  trendData: { category: string; growthRate: number; momentum: number; events: EventData[] },
  userProfile: UserProfile | undefined,
  insightId: string
): Promise<Recommendation | null> {
  const recommendationId = `rec_${crypto.createHash('sha256').update(`${insightId}_monitor`).digest('hex').substring(0, 16)}`;

  return {
    id: recommendationId,
    type: 'research',
    insightType: 'trend',
    title: `Monitor ${trendData.category} Trend`,
    description: `Emerging trend worth tracking for future opportunities`,
    why: `This trend shows early growth signals and may become significant. Monitoring helps identify the right time to engage.`,
    when: 'Ongoing monitoring',
    how: `1. Set up alerts for events in this category\n2. Track growth metrics monthly\n3. Research key players and events\n4. Assess relevance to business objectives`,
    expectedOutcome: `Early awareness of trend evolution and optimal timing for engagement`,
    priority: 0.4,
    confidence: 0.6,
    relatedInsightId: insightId,
    relatedTrendId: trendData.category
  };
}

/**
 * Generate research trend recommendation
 */
function generateResearchTrendRecommendation(
  trendData: { category: string; growthRate: number; momentum: number; events: EventData[] },
  userProfile: UserProfile | undefined,
  insightId: string
): Recommendation {
  const recommendationId = `rec_${crypto.createHash('sha256').update(`${insightId}_research`).digest('hex').substring(0, 16)}`;

  return {
    id: recommendationId,
    type: 'research',
    insightType: 'trend',
    title: `Research ${trendData.category} Trend`,
    description: `Limited data available - more research needed to assess trend significance`,
    why: `Insufficient event data (${trendData.events.length} events) to fully assess this trend. More research needed.`,
    when: 'Before making strategic decisions',
    how: `1. Search for additional events in this category\n2. Analyze industry reports and market research\n3. Interview industry experts\n4. Assess competitive landscape`,
    expectedOutcome: `Complete understanding of trend significance and opportunities`,
    priority: 0.3,
    confidence: 0.5,
    relatedInsightId: insightId,
    relatedTrendId: trendData.category
  };
}

/**
 * Generate competitive recommendations
 */
export async function generateCompetitiveRecommendations(
  competitiveData: {
    competitors: string[];
    competitorActivity: string[];
    gaps: string[];
  },
  event?: EventData,
  userProfile?: UserProfile
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];
  const insightId = event ? `event_${event.id || event.source_url}` : `competitive_${crypto.createHash('sha256').update(competitiveData.competitors.join(',')).digest('hex').substring(0, 16)}`;

  // Match competitor activity
  if (competitiveData.competitorActivity.length > 0) {
    const matchRec = generateMatchCompetitorRecommendation(competitiveData, event, userProfile, insightId);
    recommendations.push(matchRec);
  }

  // Identify competitive gaps
  if (competitiveData.gaps.length > 0) {
    const gapRec = generateCompetitiveGapRecommendation(competitiveData, event, userProfile, insightId);
    recommendations.push(gapRec);
  }

  return recommendations;
}

/**
 * Generate match competitor activity recommendation
 */
function generateMatchCompetitorRecommendation(
  competitiveData: { competitors: string[]; competitorActivity: string[]; gaps: string[] },
  event: EventData | undefined,
  userProfile: UserProfile | undefined,
  insightId: string
): Recommendation {
  const recommendationId = `rec_${crypto.createHash('sha256').update(`${insightId}_match`).digest('hex').substring(0, 16)}`;

  return {
    id: recommendationId,
    type: 'immediate',
    insightType: 'competitive',
    title: `Match Competitor Activity: ${competitiveData.competitors.slice(0, 2).join(', ')}`,
    description: `Competitors are active in this space - consider matching their engagement`,
    why: `Your competitors (${competitiveData.competitors.slice(0, 3).join(', ')}) are actively participating, indicating this is a valuable market. Matching their activity prevents competitive disadvantage.`,
    when: 'Act within 2-4 weeks',
    how: `1. Analyze competitor's approach and positioning\n2. Identify similar events where you can engage\n3. Develop differentiated value proposition\n4. Execute engagement strategy`,
    expectedOutcome: `Maintain competitive parity and prevent market share loss`,
    priority: 0.8,
    confidence: 0.7,
    relatedInsightId: insightId,
    relatedEventId: event?.id,
    metadata: {
      timeToExecute: '2-4 weeks',
      requiredResources: ['Competitive analysis', 'Event participation']
    }
  };
}

/**
 * Generate competitive gap recommendation
 */
function generateCompetitiveGapRecommendation(
  competitiveData: { competitors: string[]; competitorActivity: string[]; gaps: string[] },
  event: EventData | undefined,
  userProfile: UserProfile | undefined,
  insightId: string
): Recommendation {
  const recommendationId = `rec_${crypto.createHash('sha256').update(`${insightId}_gap`).digest('hex').substring(0, 16)}`;

  return {
    id: recommendationId,
    type: 'strategic',
    insightType: 'competitive',
    title: `Exploit Competitive Gap: ${competitiveData.gaps.slice(0, 2).join(', ')}`,
    description: `Opportunity to gain competitive advantage in areas competitors are not active`,
    why: `Competitors are not engaging in these areas (${competitiveData.gaps.slice(0, 3).join(', ')}), presenting an opportunity to establish first-mover advantage.`,
    when: 'Act within 1-2 months',
    how: `1. Assess opportunity value in gap areas\n2. Develop engagement strategy\n3. Execute before competitors enter\n4. Establish market presence`,
    expectedOutcome: `First-mover advantage and competitive differentiation`,
    priority: 0.7,
    confidence: 0.6,
    relatedInsightId: insightId,
    relatedEventId: event?.id
  };
}

/**
 * Calculate priority score for a recommendation
 */
function calculatePriority(
  context: RecommendationContext,
  actionType: 'sponsor' | 'speak' | 'attend' | 'research'
): number {
  const factors: RankingFactors = {
    urgency: context.urgencyIndicators?.urgencyScore || 0.5,
    impact: context.opportunityScore?.overallScore || 0.5,
    feasibility: calculateFeasibility(context),
    relevance: context.opportunityScore?.icpMatchScore || 0.5
  };

  // Weighted priority: urgency 30%, impact 30%, feasibility 20%, relevance 20%
  const priority = (
    factors.urgency * 0.3 +
    factors.impact * 0.3 +
    factors.feasibility * 0.2 +
    factors.relevance * 0.2
  );

  // Adjust based on action type
  if (actionType === 'research') {
    return priority * 0.5; // Research actions have lower priority
  }

  return Math.min(1, Math.max(0, priority));
}

/**
 * Calculate feasibility score (data quality + actionability)
 */
function calculateFeasibility(context: RecommendationContext): number {
  let score = 0.5; // Base score

  // Data completeness
  if (context.event?.data_completeness) {
    score += context.event.data_completeness * 0.3;
  }

  // Intelligence confidence
  if (context.eventIntelligence?.confidence) {
    score += context.eventIntelligence.confidence * 0.2;
  }

  // Actionability (has organizer, has contact info, etc.)
  if (context.event?.organizer) {
    score += 0.1;
  }
  if (context.event?.source_url) {
    score += 0.1;
  }

  return Math.min(1, score);
}

/**
 * Rank recommendations by priority
 */
function rankRecommendations(
  recommendations: Recommendation[],
  context: RecommendationContext
): Recommendation[] {
  // Sort by priority (descending), then by confidence (descending)
  return recommendations.sort((a, b) => {
    if (Math.abs(a.priority - b.priority) > 0.01) {
      return b.priority - a.priority;
    }
    return b.confidence - a.confidence;
  });
}

