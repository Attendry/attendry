/**
 * Event Predictions API
 * 
 * This endpoint provides event predictions using historical data
 * and trends to forecast future events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { OptimizedAIService } from '@/lib/services/optimized-ai-service';

/**
 * Prediction interface
 */
interface EventPrediction {
  id: string;
  title: string;
  predictedDate: string;
  confidence: number;
  location: string;
  industry: string;
  reasoning: string;
  historicalData: {
    similarEvents: number;
    averageFrequency: number;
    lastOccurrence: string;
  };
}

/**
 * Predictions response
 */
interface PredictionsResponse {
  predictions: EventPrediction[];
  total: number;
}

/**
 * GET /api/events/predictions
 */
export async function GET(): Promise<NextResponse<PredictionsResponse>> {
  try {
    const supabase = supabaseAdmin();

    // Get historical events for analysis
    const { data: historicalEvents } = await supabase
      .from('collected_events')
      .select('*')
      .order('collected_at', { ascending: false })
      .limit(1000);

    if (!historicalEvents || historicalEvents.length === 0) {
      return NextResponse.json({
        predictions: [],
        total: 0,
      });
    }

    // Generate predictions based on historical data
    const predictions = await generateEventPredictions(historicalEvents);

    return NextResponse.json({
      predictions,
      total: predictions.length,
    });

  } catch (error) {
    console.error('Event predictions error:', error);
    return NextResponse.json(
      { predictions: [], total: 0 },
      { status: 500 }
    );
  }
}

/**
 * Generate event predictions based on historical data
 */
async function generateEventPredictions(historicalEvents: any[]): Promise<EventPrediction[]> {
  const predictions: EventPrediction[] = [];

  try {
    // Analyze event patterns
    const eventPatterns = analyzeEventPatterns(historicalEvents);

    // Generate predictions for each pattern
    for (const pattern of eventPatterns) {
      const prediction = await generatePredictionForPattern(pattern, historicalEvents);
      if (prediction) {
        predictions.push(prediction);
      }
    }

    // Sort by confidence and limit results
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20);

  } catch (error) {
    console.error('Error generating event predictions:', error);
    return [];
  }
}

/**
 * Analyze event patterns from historical data
 */
function analyzeEventPatterns(events: any[]): any[] {
  const patterns: any[] = [];

  // Group events by industry and location
  const groupedEvents: Record<string, any[]> = {};

  events.forEach(event => {
    const industry = extractIndustry(event);
    const location = extractLocation(event);
    const key = `${industry}-${location}`;

    if (!groupedEvents[key]) {
      groupedEvents[key] = [];
    }
    groupedEvents[key].push(event);
  });

  // Analyze each group for patterns
  Object.entries(groupedEvents).forEach(([key, groupEvents]) => {
    if (groupEvents.length >= 3) { // Need at least 3 events to identify a pattern
      const [industry, location] = key.split('-');
      
      // Calculate frequency
      const dates = groupEvents
        .map(e => new Date(e.starts_at || e.collected_at))
        .sort((a, b) => a.getTime() - b.getTime());

      if (dates.length >= 2) {
        const timeDiff = dates[dates.length - 1].getTime() - dates[0].getTime();
        const averageFrequency = timeDiff / (dates.length - 1) / (1000 * 60 * 60 * 24 * 30); // months

        patterns.push({
          industry,
          location,
          events: groupEvents,
          averageFrequency,
          lastOccurrence: dates[dates.length - 1],
          eventCount: groupEvents.length,
        });
      }
    }
  });

  return patterns;
}

/**
 * Generate prediction for a specific pattern
 */
async function generatePredictionForPattern(pattern: any, allEvents: any[]): Promise<EventPrediction | null> {
  try {
    // Calculate next predicted date
    const lastDate = new Date(pattern.lastOccurrence);
    const predictedDate = new Date(lastDate.getTime() + (pattern.averageFrequency * 30 * 24 * 60 * 60 * 1000));

    // Skip if prediction is too far in the future (more than 2 years)
    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
    
    if (predictedDate > twoYearsFromNow) {
      return null;
    }

    // Generate event title using AI
    const eventTitle = await generateEventTitle(pattern.industry, pattern.location, predictedDate);

    // Calculate confidence based on pattern strength
    const confidence = calculateConfidence(pattern);

    // Generate reasoning
    const reasoning = generateReasoning(pattern, predictedDate);

    return {
      id: `prediction-${pattern.industry}-${pattern.location}-${predictedDate.getTime()}`,
      title: eventTitle,
      predictedDate: predictedDate.toISOString(),
      confidence,
      location: pattern.location,
      industry: pattern.industry,
      reasoning,
      historicalData: {
        similarEvents: pattern.eventCount,
        averageFrequency: Math.round(pattern.averageFrequency * 10) / 10,
        lastOccurrence: pattern.lastOccurrence.toISOString(),
      },
    };

  } catch (error) {
    console.error('Error generating prediction for pattern:', error);
    return null;
  }
}

/**
 * Generate event title using AI
 */
async function generateEventTitle(industry: string, location: string, date: Date): Promise<string> {
  try {
    const aiResponse = await OptimizedAIService.processRequest<{
      title: string;
    }>(
      'enhance',
      `Generate a realistic event title for a ${industry} event in ${location} scheduled for ${date.toLocaleDateString()}.
      
      The title should be professional and follow common event naming conventions. Examples:
      - "Legal Tech Summit 2024"
      - "FinTech Innovation Conference"
      - "Healthcare Digital Transformation Forum"
      - "Cybersecurity Best Practices Workshop"
      
      Return only the title, no additional text.`,
      {
        context: 'event_title_generation',
        industry,
        location,
        scheduledDate: date.toISOString(),
      },
      {
        useCache: true,
        useBatching: false,
      }
    );

    return aiResponse.title || `${industry} Event in ${location}`;

  } catch (error) {
    console.error('Error generating event title:', error);
    return `${industry} Event in ${location}`;
  }
}

/**
 * Calculate confidence score
 */
function calculateConfidence(pattern: any): number {
  let confidence = 0.5; // Base confidence

  // Increase confidence based on number of historical events
  if (pattern.eventCount >= 10) {
    confidence += 0.3;
  } else if (pattern.eventCount >= 5) {
    confidence += 0.2;
  } else if (pattern.eventCount >= 3) {
    confidence += 0.1;
  }

  // Increase confidence if frequency is consistent
  if (pattern.averageFrequency > 0 && pattern.averageFrequency < 24) { // Between 0 and 24 months
    confidence += 0.1;
  }

  // Decrease confidence if last event was very recent (might be too soon)
  const daysSinceLastEvent = (Date.now() - pattern.lastOccurrence.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLastEvent < 30) {
    confidence -= 0.1;
  }

  return Math.max(0.1, Math.min(0.95, confidence));
}

/**
 * Generate reasoning for prediction
 */
function generateReasoning(pattern: any, predictedDate: Date): string {
  const monthsSinceLastEvent = Math.round((Date.now() - pattern.lastOccurrence.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const predictedMonthsFromNow = Math.round((predictedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));

  return `Based on ${pattern.eventCount} historical ${pattern.industry} events in ${pattern.location}, with an average frequency of ${Math.round(pattern.averageFrequency * 10) / 10} months between events. The last event occurred ${monthsSinceLastEvent} months ago, suggesting the next event is likely to occur in approximately ${predictedMonthsFromNow} months.`;
}

/**
 * Extract industry from event
 */
function extractIndustry(event: any): string {
  const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
  
  const industries = [
    'legal', 'fintech', 'healthcare', 'technology', 'finance', 'insurance', 
    'banking', 'compliance', 'cybersecurity', 'esg', 'governance', 'regulatory'
  ];

  for (const industry of industries) {
    if (text.includes(industry)) {
      return industry.charAt(0).toUpperCase() + industry.slice(1);
    }
  }

  return 'General';
}

/**
 * Extract location from event
 */
function extractLocation(event: any): string {
  if (event.city) {
    return event.city;
  }
  if (event.country) {
    return event.country;
  }
  return 'Unknown';
}
