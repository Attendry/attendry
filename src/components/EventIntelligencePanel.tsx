/**
 * Event Intelligence Panel Component
 * 
 * Full intelligence view with tabs (Discussions, Sponsors, Location, Outreach)
 * Shows complete analysis and allows export of intelligence report
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Brain, 
  MessageSquare, 
  Users, 
  MapPin, 
  Target,
  Download,
  Copy,
  Check,
  Loader2
} from 'lucide-react';
import { EventData } from '@/lib/types/core';

interface EventIntelligencePanelProps {
  eventId: string;
  event?: EventData;
}

interface EventIntelligence {
  eventId: string;
  discussions: {
    themes: string[];
    summary: string;
    keyTopics: Array<{ topic: string; importance: number }>;
    speakerInsights: string[];
  };
  sponsors: {
    analysis: string;
    tiers: Array<{ level: string; sponsors: any[] }>;
    industries: string[];
    strategicSignificance: number;
  };
  location: {
    venueContext: string;
    accessibility: string;
    localMarketInsights: string;
    travelRecommendations?: string;
  };
  outreach: {
    positioning: string;
    recommendedApproach: string;
    keyContacts: Array<{ type: string; recommendation: string }>;
    timing: { recommendation: string; rationale: string };
    messaging: Array<{ angle: string; valueProposition: string }>;
  };
  confidence: number;
  generatedAt: string;
  cached: boolean;
}

type Tab = 'discussions' | 'sponsors' | 'location' | 'outreach';

export function EventIntelligencePanel({ eventId, event }: EventIntelligencePanelProps) {
  const [intelligence, setIntelligence] = useState<EventIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('outreach');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadIntelligence();
  }, [eventId]);

  const loadIntelligence = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/intelligence`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'not_generated') {
          // Generate intelligence
          const generateResponse = await fetch(`/api/events/${encodeURIComponent(eventId)}/intelligence`, {
            method: 'POST'
          });
          if (generateResponse.ok) {
            const generated = await generateResponse.json();
            setIntelligence(generated);
          }
        } else {
          setIntelligence(data);
        }
      }
    } catch (error) {
      console.error('Failed to load intelligence:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const exportReport = () => {
    if (!intelligence) return;
    
    const report = `Event Intelligence Report
${'='.repeat(50)}

Event: ${event?.title || eventId}
Generated: ${new Date(intelligence.generatedAt).toLocaleString()}
Confidence: ${(intelligence.confidence * 100).toFixed(0)}%

${'='.repeat(50)}
DISCUSSIONS
${'='.repeat(50)}

Summary: ${intelligence.discussions.summary}

Key Themes:
${intelligence.discussions.themes.map(t => `- ${t}`).join('\n')}

Key Topics:
${intelligence.discussions.keyTopics.map(t => `- ${t.topic} (Importance: ${(t.importance * 100).toFixed(0)}%)`).join('\n')}

Speaker Insights:
${intelligence.discussions.speakerInsights.map(i => `- ${i}`).join('\n')}

${'='.repeat(50)}
SPONSORS
${'='.repeat(50)}

${intelligence.sponsors.analysis}

Strategic Significance: ${(intelligence.sponsors.strategicSignificance * 100).toFixed(0)}%

Industries: ${intelligence.sponsors.industries.join(', ')}

${'='.repeat(50)}
LOCATION
${'='.repeat(50)}

Venue Context: ${intelligence.location.venueContext}

Accessibility: ${intelligence.location.accessibility}

Local Market Insights: ${intelligence.location.localMarketInsights}

${intelligence.location.travelRecommendations ? `Travel Recommendations: ${intelligence.location.travelRecommendations}` : ''}

${'='.repeat(50)}
OUTREACH
${'='.repeat(50)}

Positioning: ${intelligence.outreach.positioning}

Recommended Approach: ${intelligence.outreach.recommendedApproach}

Timing: ${intelligence.outreach.timing.recommendation}
Rationale: ${intelligence.outreach.timing.rationale}

Key Contacts:
${intelligence.outreach.keyContacts.map(c => `- ${c.type}: ${c.recommendation}`).join('\n')}

Messaging Angles:
${intelligence.outreach.messaging.map(m => `- ${m.angle}: ${m.valueProposition}`).join('\n')}
`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-intelligence-${eventId.substring(0, 20)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading intelligence...</span>
        </div>
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div className="text-center py-12">
        <Brain className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">Intelligence Not Available</h3>
        <p className="text-slate-600 mb-4">Unable to load event intelligence.</p>
        <button
          onClick={loadIntelligence}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Header */}
      <div className="border-b border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-slate-900">Event Intelligence</h2>
          {intelligence.cached && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Cached
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex">
        {(['discussions', 'sponsors', 'location', 'outreach'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Discussions Tab */}
        {activeTab === 'discussions' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Summary</h3>
              <p className="text-slate-700">{intelligence.discussions.summary}</p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Key Themes</h3>
              <div className="flex flex-wrap gap-2">
                {intelligence.discussions.themes.map((theme, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Key Topics</h3>
              <div className="space-y-2">
                {intelligence.discussions.keyTopics.map((topic, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">{topic.topic}</span>
                    <span className="text-sm text-slate-600">
                      {(topic.importance * 100).toFixed(0)}% importance
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {intelligence.discussions.speakerInsights.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Speaker Insights</h3>
                <ul className="space-y-2">
                  {intelligence.discussions.speakerInsights.map((insight, idx) => (
                    <li key={idx} className="text-slate-700 flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Sponsors Tab */}
        {activeTab === 'sponsors' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Analysis</h3>
              <p className="text-slate-700">{intelligence.sponsors.analysis}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Strategic Significance</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-slate-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{ width: `${intelligence.sponsors.strategicSignificance * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {(intelligence.sponsors.strategicSignificance * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {intelligence.sponsors.industries.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Industries</h3>
                <div className="flex flex-wrap gap-2">
                  {intelligence.sponsors.industries.map((industry, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm"
                    >
                      {industry}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {intelligence.sponsors.tiers.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Sponsor Tiers</h3>
                <div className="space-y-4">
                  {intelligence.sponsors.tiers.map((tier, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-4">
                      <h4 className="font-medium text-slate-900 mb-2">{tier.level}</h4>
                      <div className="flex flex-wrap gap-2">
                        {tier.sponsors.map((sponsor: any, sIdx: number) => (
                          <span key={sIdx} className="text-sm text-slate-600">
                            {sponsor.name || sponsor}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Location Tab */}
        {activeTab === 'location' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Venue Context</h3>
              <p className="text-slate-700">{intelligence.location.venueContext}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Accessibility</h3>
              <p className="text-slate-700">{intelligence.location.accessibility}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Local Market Insights</h3>
              <p className="text-slate-700">{intelligence.location.localMarketInsights}</p>
            </div>

            {intelligence.location.travelRecommendations && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Travel Recommendations</h3>
                <p className="text-slate-700">{intelligence.location.travelRecommendations}</p>
              </div>
            )}
          </div>
        )}

        {/* Outreach Tab */}
        {activeTab === 'outreach' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Positioning</h3>
              <p className="text-slate-700">{intelligence.outreach.positioning}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Recommended Approach</h3>
              <p className="text-slate-700">{intelligence.outreach.recommendedApproach}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Timing</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-medium text-blue-900 mb-1">{intelligence.outreach.timing.recommendation}</p>
                <p className="text-sm text-blue-700">{intelligence.outreach.timing.rationale}</p>
              </div>
            </div>

            {intelligence.outreach.keyContacts.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Key Contacts</h3>
                <div className="space-y-2">
                  {intelligence.outreach.keyContacts.map((contact, idx) => (
                    <div key={idx} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <span className="font-medium text-slate-900">{contact.type}</span>
                        <p className="text-sm text-slate-700 mt-1">{contact.recommendation}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(contact.recommendation)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {intelligence.outreach.messaging.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Messaging Angles</h3>
                <div className="space-y-3">
                  {intelligence.outreach.messaging.map((msg, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-4">
                      <h4 className="font-medium text-slate-900 mb-1">{msg.angle}</h4>
                      <p className="text-sm text-slate-700">{msg.valueProposition}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

