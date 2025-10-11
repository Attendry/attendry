/**
 * Recommendation Engine Component
 * 
 * This component provides AI-powered event recommendations based on
 * user behavior, preferences, and industry trends.
 */

"use client";
import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { EventData } from '@/lib/types/core';

/**
 * Recommendation types
 */
type RecommendationType = 
  | 'similar_events'
  | 'trending_events'
  | 'industry_events'
  | 'location_based'
  | 'time_based'
  | 'collaborative';

/**
 * Recommendation interface
 */
interface RecommendationEvent extends EventData {
  icpSegment?: string;
  accountTier?: 'Strategic' | 'Expansion' | 'New Market';
  attributedSource?: string;
  projectedPipelineImpact?: string;
  likelihood?: number;
}

interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  events: RecommendationEvent[];
  confidence: number;
  reason: string;
  icpSegment: string;
  source: string;
  likelihood: number;
  lastUpdated: string;
}

const demoRecommendations: Recommendation[] = [
  {
    id: 'demo-strategic-fintech',
    type: 'industry_events',
    title: 'Strategic FinTech Conferences for Tier-1 Accounts',
    description: 'High-propensity events where Fortune 500 financial institutions invest in ecosystem partnerships.',
    confidence: 0.82,
    reason: 'Aligns with top strategic accounts in Financial Services ICP with high engagement scores.',
    icpSegment: 'FSI – Tier 1 Strategic',
    source: 'Salesforce CRM + Analyst Curated',
    likelihood: 0.78,
    lastUpdated: '3 days ago',
    events: [
      {
        id: 'demo-event-1',
        title: 'Global Banking Innovation Forum 2025',
        source_url: 'https://example.com/events/global-banking-innovation',
        starts_at: new Date().toISOString(),
        city: 'London',
        country: 'United Kingdom',
        organizer: 'Velocity Events',
        icpSegment: 'FSI – Tier 1 Strategic',
        accountTier: 'Strategic',
        attributedSource: 'Salesforce Opportunity Insights',
        projectedPipelineImpact: '$1.2M - Expansion Licenses',
        likelihood: 0.74,
      },
      {
        id: 'demo-event-2',
        title: 'FinTech Leadership Exchange',
        source_url: 'https://example.com/events/fintech-leadership',
        starts_at: new Date().toISOString(),
        city: 'New York',
        country: 'USA',
        organizer: 'CXO Collaborative',
        icpSegment: 'FSI – Tier 1 Strategic',
        accountTier: 'Strategic',
        attributedSource: 'Partner Ecosystem Feed',
        projectedPipelineImpact: '$720K - Co-marketing Motion',
        likelihood: 0.81,
      },
    ],
  },
  {
    id: 'demo-emea-expansion',
    type: 'location_based',
    title: 'EMEA Pipeline Acceleration Opportunities',
    description: 'EMEA-based events with high attendance from target accounts in manufacturing and automotive.',
    confidence: 0.76,
    reason: 'Strong overlap with expansion list accounts and active engagements led by regional teams.',
    icpSegment: 'Manufacturing – Growth Accounts',
    source: 'Marketing Intelligence + ABM Data',
    likelihood: 0.69,
    lastUpdated: '5 days ago',
    events: [
      {
        id: 'demo-event-3',
        title: 'Smart Factory Summit Europe',
        source_url: 'https://example.com/events/smart-factory-summit',
        starts_at: new Date().toISOString(),
        city: 'Munich',
        country: 'Germany',
        organizer: 'Industrial Innovation Europe',
        icpSegment: 'Manufacturing – Growth Accounts',
        accountTier: 'Expansion',
        attributedSource: 'Demand Gen Signals',
        projectedPipelineImpact: '$540K - Services Upsell',
        likelihood: 0.66,
      },
      {
        id: 'demo-event-4',
        title: 'Connected Mobility Forum',
        source_url: 'https://example.com/events/connected-mobility',
        starts_at: new Date().toISOString(),
        city: 'Barcelona',
        country: 'Spain',
        organizer: 'Mobility Alliance',
        icpSegment: 'Manufacturing – Growth Accounts',
        accountTier: 'Expansion',
        attributedSource: 'Salesforce Opportunity Insights',
        projectedPipelineImpact: '$380K - Cross-sell',
        likelihood: 0.72,
      },
    ],
  },
  {
    id: 'demo-net-new',
    type: 'trending_events',
    title: 'Net-New Demand in High-Growth SaaS',
    description: 'Emerging SaaS community events with high conversion for top-of-funnel lead generation.',
    confidence: 0.71,
    reason: 'Signals from partner ecosystems combined with positive sentiment among target personas.',
    icpSegment: 'SaaS – Emerging Accounts',
    source: 'Third-party Intent + Marketing Ops',
    likelihood: 0.64,
    lastUpdated: 'Yesterday',
    events: [
      {
        id: 'demo-event-5',
        title: 'SaaS Growth Blueprint 2025',
        source_url: 'https://example.com/events/saas-growth-blueprint',
        starts_at: new Date().toISOString(),
        city: 'Austin',
        country: 'USA',
        organizer: 'GrowthOps Collective',
        icpSegment: 'SaaS – Emerging Accounts',
        accountTier: 'New Market',
        attributedSource: 'HubSpot Campaign History',
        projectedPipelineImpact: '$250K - Net New',
        likelihood: 0.58,
      },
      {
        id: 'demo-event-6',
        title: 'Revenue Architects Live',
        source_url: 'https://example.com/events/revenue-architects',
        starts_at: new Date().toISOString(),
        city: 'Toronto',
        country: 'Canada',
        organizer: 'RevOps Guild',
        icpSegment: 'SaaS – Emerging Accounts',
        accountTier: 'New Market',
        attributedSource: 'Analyst Curated',
        projectedPipelineImpact: '$190K - PLG Program',
        likelihood: 0.61,
      },
    ],
  },
];

/**
 * Recommendation Engine Component
 */
const RecommendationEngine = memo(function RecommendationEngine() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<RecommendationType | 'all'>('all');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load recommendations
  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('RecommendationEngine: failed to load session', error);
      }
      if (!cancelled) {
        setIsAuthenticated(!!session);
        setAuthReady(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setIsAuthenticated(!!session);
        setAuthReady(true);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const loadRecommendations = async () => {
      setIsLoading(true);

      if (!isAuthenticated) {
        setRecommendations(demoRecommendations);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/recommendations');
        if (response.ok) {
          const data = await response.json();
          const hydrated = (data.recommendations as Recommendation[] | undefined)?.length
            ? data.recommendations
            : demoRecommendations;
          setRecommendations(hydrated);
        } else {
          setRecommendations(demoRecommendations);
        }
      } catch (error) {
        console.error('Failed to load recommendations:', error);
        setRecommendations(demoRecommendations);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendations();
  }, [authReady, isAuthenticated]);

  // Filter recommendations by type
  const availableSegments = useMemo(() => {
    const segments = new Set<string>();
    recommendations.forEach((rec) => {
      if (rec.icpSegment) {
        segments.add(rec.icpSegment);
      }
    });
    return Array.from(segments);
  }, [recommendations]);

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((rec) => {
      const matchesType = selectedType === 'all' || rec.type === selectedType;
      const matchesSegment = selectedSegment === 'all' || rec.icpSegment === selectedSegment;
      return matchesType && matchesSegment;
    });
  }, [recommendations, selectedType, selectedSegment]);

  // Get recommendation type label
  const getTypeLabel = useCallback((type: RecommendationType) => {
    const labels = {
      similar_events: 'Similar Events',
      trending_events: 'Trending Events',
      industry_events: 'Industry Events',
      location_based: 'Location Based',
      time_based: 'Time Based',
      collaborative: 'Collaborative',
    };
    return labels[type];
  }, []);

  // Get recommendation type icon
  const getTypeIcon = useCallback((type: RecommendationType) => {
    const icons = {
      similar_events: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      trending_events: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      industry_events: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      location_based: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      time_based: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      collaborative: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    };
    return icons[type];
  }, []);

  const isEmpty = filteredRecommendations.length === 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Event Recommendations</h1>
          <p className="text-gray-600">Pipeline-ready suggestions with attribution, segment fit, and projected impact.</p>
        </div>
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-100 px-3 py-2 rounded-md text-sm">
          <span className="font-medium">Demo Preview</span>
          <span className="text-blue-600">Synced from CRM & Analyst Feeds (mock)</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Recommendation Types
          </button>
          {(['similar_events', 'trending_events', 'industry_events', 'location_based', 'time_based', 'collaborative'] as RecommendationType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getTypeLabel(type)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedSegment('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedSegment === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ICP Segments
          </button>
          {availableSegments.map((segment) => (
            <button
              key={segment}
              onClick={() => setSelectedSegment(segment)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedSegment === segment
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {segment}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-6 animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="space-y-2">
                  {[...Array(3)].map((__, innerIdx) => (
                    <div key={innerIdx} className="h-3 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="border border-dashed border-gray-300 rounded-lg p-10 text-center space-y-4 bg-white">
            <h3 className="text-lg font-semibold text-gray-900">No curated recommendations for this view</h3>
            <p className="text-sm text-gray-600 max-w-xl mx-auto">
              Activate CRM and marketing integrations to personalize events by pipeline stage, or adjust filters to surface broader insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                Connect Salesforce (mock)
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
                Invite marketing partner
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
                Watch 2-min alignment video
              </button>
            </div>
          </div>
        ) : (
          filteredRecommendations.map((recommendation) => (
            <div key={recommendation.id} className="bg-white border border-gray-200 rounded-lg">
              <div className="border-b border-gray-200 p-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {getTypeIcon(recommendation.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-semibold text-gray-900">{recommendation.title}</h2>
                      <span className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                        {recommendation.icpSegment}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{recommendation.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>Source: {recommendation.source}</span>
                      <span>Likelihood: {Math.round(recommendation.likelihood * 100)}%</span>
                      <span>Updated {recommendation.lastUpdated}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Confidence</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {Math.round(recommendation.confidence * 100)}%
                    </div>
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${recommendation.confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-b border-gray-100 bg-gray-50 rounded-b-lg">
                <p className="text-sm text-gray-700">
                  <strong>Why we recommend this:</strong> {recommendation.reason}
                </p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendation.events.map((event, index) => (
                    <div key={event.id || index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div>
                        <h3 className="font-medium text-gray-900 line-clamp-2">{event.title}</h3>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100">{event.accountTier || 'General'}</span>
                          <span>{event.icpSegment}</span>
                        </div>
                      </div>

                      {event.starts_at && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{new Date(event.starts_at).toLocaleDateString()}</span>
                        </div>
                      )}

                      {(event.city || event.country) && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{[event.city, event.country].filter(Boolean).join(', ')}</span>
                        </div>
                      )}

                      {event.projectedPipelineImpact && (
                        <div className="text-sm text-gray-700">
                          <strong>Projected Impact:</strong> {event.projectedPipelineImpact}
                        </div>
                      )}

                      {typeof event.likelihood === 'number' && (
                        <div className="text-xs text-gray-500">
                          Likelihood of attendance: {Math.round(event.likelihood * 100)}%
                        </div>
                      )}

                      {event.attributedSource && (
                        <div className="text-xs text-gray-500">
                          Source: {event.attributedSource}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <a
                          href={event.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          View Event Brief
                        </a>
                        <button className="text-sm text-gray-600 hover:text-gray-800 transition-colors">
                          Share with AE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default RecommendationEngine;
