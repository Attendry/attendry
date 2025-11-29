import { NextRequest } from 'next/server';
import { toISO2Country, isValidISO2Country, getCountryContext, deriveLocale } from '@/lib/utils/country';
import { executeOptimizedSearch } from '@/lib/optimized-orchestrator';
import { processOptimizedResults } from '../run/route';
import { unifiedSearch } from '@/lib/search/unified-search-core';
import { SearchService } from '@/lib/services/search-service';
import { RelevanceService, type UserProfile, type RelevanceScore } from '@/lib/services/relevance-service';
import type { EventsSearchResponseEvent } from '@/lib/search/client';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProgressiveSearchUpdate {
  stage: 'database' | 'cse' | 'firecrawl' | 'complete' | 'error';
  events: EventsSearchResponseEvent[];
  totalSoFar: number;
  isComplete: boolean;
  message?: string;
  error?: string;
  provider?: string;
}

/**
 * Progressive search endpoint using Server-Sent Events (SSE)
 * Returns results as they arrive from different sources
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Set up SSE headers
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (update: ProgressiveSearchUpdate) => {
        const data = JSON.stringify(update);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        const body = await req.json();
        const userText: string = body?.userText ?? '';
        const rawCountry = body?.country ?? '';
        const normalizedCountry = rawCountry ? toISO2Country(rawCountry) : null;

        // API Guard: Reject invalid country codes
        if (!isValidISO2Country(normalizedCountry)) {
          sendUpdate({
            stage: 'error',
            events: [],
            totalSoFar: 0,
            isComplete: true,
            error: 'country (ISO2) required',
          });
          controller.close();
          return;
        }

        const ctx = getCountryContext(normalizedCountry);
        const requestedLocale = body?.locale ?? '';
        const locale = deriveLocale(normalizedCountry ?? undefined, requestedLocale ?? undefined);
        const dateFrom: string | null = body?.dateFrom ?? null;
        const dateTo: string | null = body?.dateTo ?? null;
        const location: string | null = body?.location ?? null;
        const timeframe: string | null = body?.timeframe ?? null;
        const useNaturalLanguage = body?.useNaturalLanguage === true;

        // Process timeframe to date range (same logic as regular endpoint)
        let effectiveDateFrom = dateFrom;
        let effectiveDateTo = dateTo;

        if (timeframe && !dateFrom && !dateTo) {
          const now = new Date();
          switch (timeframe) {
            case 'next_7':
              effectiveDateFrom = now.toISOString().split('T')[0];
              effectiveDateTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              break;
            case 'next_30':
              effectiveDateFrom = now.toISOString().split('T')[0];
              effectiveDateTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              break;
            case 'next_90':
              effectiveDateFrom = now.toISOString().split('T')[0];
              effectiveDateTo = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              break;
          }
        } else if (!timeframe && !dateFrom && !dateTo) {
          if (normalizedCountry && normalizedCountry !== 'EU') {
            const now = new Date();
            effectiveDateFrom = now.toISOString().split('T')[0];
            effectiveDateTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          } else {
            effectiveDateFrom = null;
            effectiveDateTo = null;
          }
        }

        const allEvents: EventsSearchResponseEvent[] = [];
        const seenUrls = new Set<string>();

        // Load user profile for relevance scoring (skip if useNaturalLanguage is true)
        let userProfile: UserProfile | null = null;
        if (!useNaturalLanguage) {
          try {
            const supabase = await supabaseServer();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              userProfile = await RelevanceService.getUserProfile(user.id);
              if (userProfile) {
                console.log('[progressive-search] User profile loaded for relevance scoring');
              }
            }
          } catch (error) {
            console.warn('[progressive-search] Failed to load user profile, continuing without relevance scoring:', error);
          }
        }

        // Stage 1: Check database first (fastest, 1-2s)
        sendUpdate({
          stage: 'database',
          events: [],
          totalSoFar: 0,
          isComplete: false,
          message: 'Checking database...',
        });

        try {
          const dbResult = await SearchService.checkDatabaseForEvents({
            q: userText,
            country: normalizedCountry || 'DE',
            from: effectiveDateFrom || undefined,
            to: effectiveDateTo || undefined,
          });

          if (dbResult.found && dbResult.events.length > 0) {
            // Convert database events to response format
            const dbEvents = dbResult.events.map((event) => ({
              id: event.id || event.source_url,
              title: event.title,
              source_url: event.source_url,
              starts_at: event.starts_at,
              country: event.country,
              city: event.city,
              location: event.location,
              venue: event.venue,
              description: event.description,
              confidence: event.confidence,
              confidence_reason: event.confidence_reason,
              sessions: event.sessions || [],
              speakers: event.speakers || [],
              sponsors: event.sponsors || [],
            })) as EventsSearchResponseEvent[];

            // Add unique events
            dbEvents.forEach((event) => {
              if (!seenUrls.has(event.source_url)) {
                allEvents.push(event);
                seenUrls.add(event.source_url);
              }
            });

            sendUpdate({
              stage: 'database',
              events: [...allEvents],
              totalSoFar: allEvents.length,
              isComplete: false,
              message: `Found ${allEvents.length} events in database`,
              provider: 'database',
            });
          }
        } catch (error) {
          console.error('[progressive-search] Database check failed:', error);
        }

        // Stage 2: Try Firecrawl (primary search, 30-60s) - comprehensive results
        sendUpdate({
          stage: 'firecrawl',
          events: [...allEvents],
          totalSoFar: allEvents.length,
          isComplete: false,
          message: 'Searching with Firecrawl for comprehensive results (this may take 30-60 seconds)...',
        });

        let firecrawlSucceeded = false;
        try {
          // Use optimized orchestrator for full search with Firecrawl (primary provider)
          const optimizedResult = await executeOptimizedSearch({
            userText,
            country: normalizedCountry,
            dateFrom: effectiveDateFrom || undefined,
            dateTo: effectiveDateTo || undefined,
            location,
            timeframe,
            locale,
            useNaturalLanguage,
          });

          const processedResult = await processOptimizedResults(
            optimizedResult,
            normalizedCountry,
            effectiveDateFrom,
            effectiveDateTo,
            false
          );

          if (processedResult.events && processedResult.events.length > 0) {
            firecrawlSucceeded = true;
            
            // Add unique events from Firecrawl
            processedResult.events.forEach((event) => {
              if (!seenUrls.has(event.source_url)) {
                allEvents.push(event);
                seenUrls.add(event.source_url);
              }
            });

            sendUpdate({
              stage: 'firecrawl',
              events: [...allEvents],
              totalSoFar: allEvents.length,
              isComplete: false,
              message: `Found ${processedResult.events.length} events from Firecrawl`,
              provider: 'firecrawl',
            });
          }
        } catch (error) {
          console.error('[progressive-search] Firecrawl search failed:', error);
        }

        // Stage 3: Try CSE as fallback (only if Firecrawl failed or returned insufficient results)
        if (!firecrawlSucceeded || allEvents.length < 5) {
          sendUpdate({
            stage: 'cse',
            events: [...allEvents],
            totalSoFar: allEvents.length,
            isComplete: false,
              message: firecrawlSucceeded 
              ? 'Searching additional sources...' 
              : 'No results from primary search, trying alternative sources...',
          });

          try {
            const cseResult = await unifiedSearch({
              q: userText,
              dateFrom: effectiveDateFrom || undefined,
              dateTo: effectiveDateTo || undefined,
              country: normalizedCountry || undefined,
              limit: 20,
              useCache: true,
            });

            // Only use CSE if it's the provider that returned results (Firecrawl may have failed)
            if (cseResult.items && cseResult.items.length > 0 && cseResult.provider === 'cse') {
              // Convert CSE items to events (basic info only - CSE is fallback)
              const cseEvents = cseResult.items
                .filter((item) => {
                  const url = typeof item === 'string' ? item : item.url;
                  return url && !seenUrls.has(url);
                })
                .map((item) => {
                  const url = typeof item === 'string' ? item : item.url;
                  const title = typeof item === 'object' ? item.title : undefined;
                  const description = typeof item === 'object' ? item.description : undefined;
                  
                  return {
                    id: url,
                    title: title || 'Event',
                    source_url: url,
                    starts_at: null,
                    country: normalizedCountry,
                    city: null,
                    location: null,
                    venue: null,
                    description: description || null,
                    confidence: 0.6, // Lower confidence for fallback results
                    sessions: [],
                    speakers: [],
                    sponsors: [],
                  } as EventsSearchResponseEvent;
                });

              cseEvents.forEach((event) => {
                allEvents.push(event);
                seenUrls.add(event.source_url);
              });

              sendUpdate({
                stage: 'cse',
                events: [...allEvents],
                totalSoFar: allEvents.length,
                isComplete: false,
                message: `Found ${cseEvents.length} additional events from alternative search`,
                provider: 'cse',
              });
            }
          } catch (error) {
            console.error('[progressive-search] CSE fallback search failed:', error);
          }
        }

        // Calculate relevance scores and sort if user profile is available
        let finalEvents = [...allEvents];
        if (userProfile && finalEvents.length > 0) {
          try {
            // Convert EventsSearchResponseEvent to EventData format for RelevanceService
            const eventDataForScoring = finalEvents.map(event => ({
              id: event.id || event.source_url,
              title: event.title || 'Event',
              starts_at: event.starts_at || undefined,
              ends_at: undefined,
              city: event.city || undefined,
              country: event.country || undefined,
              venue: event.venue || undefined,
              organizer: undefined,
              description: event.description || undefined,
              topics: undefined, // Could extract from description if needed
              speakers: event.speakers || [],
              sponsors: event.sponsors || [],
              participating_organizations: undefined,
              partners: undefined,
              competitors: undefined,
              confidence: event.confidence || undefined,
              data_completeness: undefined,
            }));

            // Calculate relevance scores
            const relevanceScores = await RelevanceService.calculateRelevanceScores(
              eventDataForScoring,
              userProfile
            );

            // Create a map of eventId -> relevance score
            const scoreMap = new Map<string, RelevanceScore>();
            relevanceScores.forEach(score => {
              scoreMap.set(score.eventId, score);
            });

            // Attach relevance scores to events and sort by relevance
            finalEvents = finalEvents
              .map(event => {
                const eventId = event.id || event.source_url;
                const relevanceScore = scoreMap.get(eventId);
                
                return {
                  ...event,
                  relevance_score: relevanceScore ? Math.round(relevanceScore.score * 100) : null,
                  relevance_reasons: relevanceScore?.reasons || [],
                  relevance_matched_terms: relevanceScore?.matchedTerms || {
                    industry: [],
                    icp: [],
                    competitors: [],
                  },
                } as EventsSearchResponseEvent & {
                  relevance_score?: number | null;
                  relevance_reasons?: string[];
                  relevance_matched_terms?: {
                    industry: string[];
                    icp: string[];
                    competitors: string[];
                  };
                };
              })
              .sort((a, b) => {
                // Sort by relevance score (highest first), then by confidence, then by date
                const scoreA = (a as any).relevance_score ?? 0;
                const scoreB = (b as any).relevance_score ?? 0;
                if (scoreB !== scoreA) {
                  return scoreB - scoreA;
                }
                const confA = a.confidence ?? 0;
                const confB = b.confidence ?? 0;
                if (confB !== confA) {
                  return confB - confA;
                }
                // Sort by date (upcoming first)
                const dateA = a.starts_at ? new Date(a.starts_at).getTime() : 0;
                const dateB = b.starts_at ? new Date(b.starts_at).getTime() : 0;
                return dateA - dateB;
              });

            console.log(`[progressive-search] Calculated relevance scores for ${finalEvents.length} events, sorted by relevance`);
          } catch (error) {
            console.error('[progressive-search] Failed to calculate relevance scores:', error);
            // Continue with unsorted events if scoring fails
          }
        }

        // Final completion
        sendUpdate({
          stage: 'complete',
          events: finalEvents,
          totalSoFar: finalEvents.length,
          isComplete: true,
          message: `Search complete. Found ${finalEvents.length} events total${userProfile ? ', sorted by relevance' : ''}.`,
        });

        controller.close();
      } catch (error) {
        console.error('[progressive-search] Error:', error);
        sendUpdate({
          stage: 'error',
          events: [],
          totalSoFar: 0,
          isComplete: true,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

