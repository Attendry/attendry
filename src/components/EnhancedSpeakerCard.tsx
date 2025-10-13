/**
 * EnhancedSpeakerCard Component
 * 
 * A comprehensive speaker profile component that displays detailed speaker information
 * with expandable sections for professional details, achievements, and connections.
 * 
 * Features:
 * - Basic speaker information (name, title, organization)
 * - Speech/presentation details
 * - Expandable detailed profile sections
 * - Professional background and achievements
 * - Social links and connections
 * - Save to watchlist functionality
 * - Confidence scoring for data quality
 * 
 * @author Attendry Team
 * @version 2.0
 */

"use client";
import React, { useState } from "react";
import { SpeakerData } from "@/lib/types/core";

/**
 * Enhanced speaker data structure interface
 * Extends the base SpeakerData with additional professional information
 */
interface EnhancedSpeaker extends SpeakerData {
  location?: string;               // Current location (city, country)
  education?: string[];            // Educational background
  publications?: string[];         // Published works and articles
  career_history?: string[];       // Career progression
  social_links?: {                 // Social media and professional links
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  expertise_areas?: string[];      // Areas of expertise
  speaking_history?: string[];     // Previous speaking engagements
  achievements?: string[];         // Professional achievements and awards
  industry_connections?: Array<{name: string, org?: string, url?: string}> | string[]; // Industry associations and connections
  recent_news?: Array<{title: string, url: string, date?: string}> | string[];          // Recent media mentions and news
}

/**
 * EnhancedSpeakerCard component props
 */
interface EnhancedSpeakerCardProps {
  speaker: SpeakerData;            // Speaker data object (can be basic or enhanced)
  sessionTitle?: string;           // Title of the specific session or speech
}

/**
 * Main EnhancedSpeakerCard component
 * 
 * @param speaker - Enhanced speaker data object
 * @param sessionTitle - Title of the specific session or speech
 * @returns JSX element representing the speaker card
 */
export default function EnhancedSpeakerCard({ speaker, sessionTitle }: EnhancedSpeakerCardProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [expanded, setExpanded] = useState(false);  // Whether detailed sections are expanded
  const [busy, setBusy] = useState(false);          // Loading state for save operation
  const [enhancedSpeaker, setEnhancedSpeaker] = useState<EnhancedSpeaker | null>(null); // Enhanced speaker data
  const [enhancing, setEnhancing] = useState(false); // Loading state for enhancement
  const [enhancementError, setEnhancementError] = useState<string | null>(null); // Enhancement error

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  /**
   * Enhance speaker data with additional professional information
   * 
   * This function calls the enhancement API to get additional speaker details
   * like education, publications, career history, etc.
   */
  async function enhanceSpeaker() {
    if (enhancing || enhancedSpeaker) return; // Already enhancing or enhanced
    
    setEnhancing(true);
    setEnhancementError(null);
    
    try {
      const res = await fetch("/api/speakers/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker }),
      });
      const j = await res.json();
      
      if (!res.ok) {
        throw new Error(j.error || "Enhancement failed");
      }
      
      console.log('Enhanced speaker data received:', j.enhanced);
      console.log('Industry connections:', j.enhanced?.industry_connections);
      console.log('Recent news:', j.enhanced?.recent_news);
      setEnhancedSpeaker(j.enhanced);
    } catch (e: unknown) {
      setEnhancementError((e as Error)?.message || "Enhancement failed");
    } finally {
      setEnhancing(false);
    }
  }

  const handleToggleDetails = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);

    if (nextExpanded && !enhancedSpeaker && !enhancing) {
      void enhanceSpeaker();
    } else if (!nextExpanded) {
      setEnhancementError(null);
    }
  };

  /**
   * Save speaker to user's watchlist
   * 
   * This function adds the speaker to the user's watchlist for later reference.
   * It uses the speaker's profile URL or creates a unique identifier.
   */
  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/watchlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "attendee",
          label: `${speaker.name} — ${speaker.org}`,
          ref_id: speaker.profile_url || (speaker.name + (speaker.org ? `|${speaker.org}` : "")),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
    } catch (e: unknown) {
      alert((e as Error)?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  // Use enhanced speaker data if available, otherwise fall back to basic speaker data
  const displaySpeaker: EnhancedSpeaker = enhancedSpeaker || speaker;

  const baseHasCoreDetails = !!(speaker?.title || speaker?.org);

  // Check if speaker has enhanced data
  const hasEnhancedData = Boolean(
    enhancedSpeaker && (
      enhancedSpeaker.education?.length ||
      enhancedSpeaker.publications?.length ||
      enhancedSpeaker.career_history?.length ||
      enhancedSpeaker.expertise_areas?.length ||
      enhancedSpeaker.achievements?.length ||
      enhancedSpeaker.industry_connections?.length ||
      enhancedSpeaker.recent_news?.length
    )
  );
  
  // Determine confidence color based on data quality score
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="rounded-xl border p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="font-semibold text-xl text-slate-900 mb-2">{displaySpeaker.name}</div>
          
          {/* Prominent Job Title and Organization */}
          <div className="mb-3">
            <div className="text-lg font-medium text-slate-800 mb-1 flex flex-wrap items-baseline gap-2">
              {displaySpeaker.title ? (
                <span>{displaySpeaker.title}</span>
              ) : speaker.title ? (
                <span>{speaker.title}</span>
              ) : (
                <span className="italic text-opacity-40">Title not provided yet</span>
              )}
              {(displaySpeaker.title || speaker.title) && (displaySpeaker.org || speaker.org) && (
                <span className="text-slate-400">·</span>
              )}
              {displaySpeaker.org ? (
                <span className="text-base font-medium text-slate-700">{displaySpeaker.org}</span>
              ) : speaker.org ? (
                <span className="text-base font-medium text-slate-700">{speaker.org}</span>
              ) : (
                <span className="text-base font-medium text-slate-700 italic text-opacity-40">Organization not provided yet</span>
              )}
            </div>
            {displaySpeaker.location && (
              <div className="text-sm text-slate-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {displaySpeaker.location}
              </div>
            )}
          </div>
          
          {/* Session/Speech Title */}
          {sessionTitle && (
            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-xs font-medium text-blue-800 mb-1">Speaking on:</div>
              <div className="text-sm font-medium text-blue-900">{sessionTitle}</div>
            </div>
          )}
        </div>
        {displaySpeaker.confidence && (
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getConfidenceColor(displaySpeaker.confidence)}`}>
            Confidence: {(displaySpeaker.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {displaySpeaker.speech_title && (
        <div className="mt-2 text-sm font-medium text-blue-700">
          {displaySpeaker.speech_title}
        </div>
      )}
      {displaySpeaker.session && (
        <div className="text-xs text-slate-500">
          Session: {displaySpeaker.session}
        </div>
      )}

      {displaySpeaker.bio && !expanded && (
        <p className="mt-3 text-sm text-slate-800 line-clamp-2">
          {displaySpeaker.bio}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={handleToggleDetails}
          disabled={enhancing && !expanded}
          className="text-xs font-medium rounded-full px-3 py-1 border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors duration-200 disabled:opacity-60 flex items-center gap-2"
        >
          {enhancing && !expanded ? (
            <>
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Enhancing…
            </>
          ) : enhancing && expanded ? (
            <>
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Hide Details
            </>
          ) : expanded ? "Hide Details" : hasEnhancedData || baseHasCoreDetails ? "Show Details" : "Enhance & Show"
          }
        </button>

        {enhancementError && (
          <span className="text-xs text-red-600">
            Enhancement failed: {enhancementError}
          </span>
        )}
        
        <button
          onClick={save}
          disabled={busy}
          className="text-xs rounded-full border px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save to Watchlist"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
          {/* Show message if no enhanced data is available */}
          {!hasEnhancedData && !enhancing && !baseHasCoreDetails && (
            <div className="text-center py-4 text-slate-500">
              <p className="text-sm">Click "Enhance & Show" to load detailed professional information</p>
            </div>
          )}
          
          {/* Professional Information Section */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2V6" />
              </svg>
              Professional Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displaySpeaker.title && (
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Job Title</div>
                  <div className="text-sm font-medium text-slate-900">{displaySpeaker.title}</div>
                </div>
              )}
              {displaySpeaker.org && (
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Organization</div>
                  <div className="text-sm font-medium text-slate-900">{displaySpeaker.org}</div>
                </div>
              )}
              {displaySpeaker.location && (
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Location</div>
                  <div className="text-sm font-medium text-slate-900 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {displaySpeaker.location}
                  </div>
                </div>
              )}
              {displaySpeaker.confidence && (
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Data Quality</div>
                  <div className="text-sm font-medium text-slate-900">
                    <span className={`px-2 py-1 rounded-full text-xs ${getConfidenceColor(displaySpeaker.confidence)}`}>
                      {(displaySpeaker.confidence * 100).toFixed(0)}% Confidence
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {displaySpeaker.bio && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Professional Summary</h4>
              <p className="text-sm text-slate-800">{displaySpeaker.bio}</p>
            </div>
          )}

          {displaySpeaker.education && displaySpeaker.education.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Education</h4>
              <ul className="space-y-1">
                {displaySpeaker.education.map((edu: string, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">• {edu}</li>
                ))}
              </ul>
            </div>
          )}

          {displaySpeaker.career_history && displaySpeaker.career_history.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Career History</h4>
              <ul className="space-y-1">
                {displaySpeaker.career_history.map((career: string, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">• {career}</li>
                ))}
              </ul>
            </div>
          )}

          {displaySpeaker.publications && displaySpeaker.publications.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Publications</h4>
              <ul className="space-y-1">
                {displaySpeaker.publications.map((pub: string, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">• {pub}</li>
                ))}
              </ul>
            </div>
          )}

          {displaySpeaker.expertise_areas && displaySpeaker.expertise_areas.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Expertise Areas</h4>
              <div className="flex flex-wrap gap-2">
                {displaySpeaker.expertise_areas.map((area: string, idx: number) => (
                  <span key={idx} className="text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 px-2 py-1">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Speaking History */}
          {displaySpeaker.speaking_history && displaySpeaker.speaking_history.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Speaking History</h4>
              <ul className="space-y-1">
                {displaySpeaker.speaking_history.map((event: string, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">• {event}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Achievements */}
          {displaySpeaker.achievements && displaySpeaker.achievements.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Key Achievements</h4>
              <ul className="space-y-1">
                {displaySpeaker.achievements.map((achievement: string, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">• {achievement}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Industry Connections */}
          {displaySpeaker.industry_connections && displaySpeaker.industry_connections.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Industry Connections</h4>
              <ul className="space-y-1">
                {displaySpeaker.industry_connections.map((connection: any, idx: number) => {
                  // Defensive programming: handle various data structures
                  if (!connection) return null;
                  
                  const isStructured = typeof connection === 'object' && connection !== null && connection.name;
                  const name = isStructured ? String(connection.name || '') : String(connection || '');
                  const org = isStructured ? String(connection.org || '') : null;
                  const url = isStructured ? String(connection.url || '') : null;
                  
                  // Ensure we have a valid name to display
                  if (!name || name === 'undefined' || name === 'null') return null;
                  
                  return (
                    <li key={idx} className="text-sm text-slate-700">
                      • {name}
                      {org && org !== 'undefined' && org !== 'null' && (
                        <span className="text-slate-500"> ({org})</span>
                      )}
                      {url && url !== 'undefined' && url !== 'null' && url.startsWith('http') && (
                        <a href={url} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 hover:underline text-xs">
                          [source]
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Recent News */}
          {displaySpeaker.recent_news && displaySpeaker.recent_news.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Recent News & Media</h4>
              <ul className="space-y-1">
                {displaySpeaker.recent_news.map((news: any, idx: number) => {
                  // Defensive programming: handle various data structures
                  if (!news) return null;
                  
                  const isStructured = typeof news === 'object' && news !== null && news.title;
                  const title = isStructured ? String(news.title || '') : String(news || '');
                  const url = isStructured ? String(news.url || '') : null;
                  const date = isStructured ? String(news.date || '') : null;
                  
                  // Ensure we have a valid title to display
                  if (!title || title === 'undefined' || title === 'null') return null;
                  
                  return (
                    <li key={idx} className="text-sm text-slate-700">
                      • {url && url !== 'undefined' && url !== 'null' && url.startsWith('http') ? (
                        <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          {title}
                        </a>
                      ) : title}
                      {date && date !== 'undefined' && date !== 'null' && (
                        <span className="text-slate-500 text-xs ml-2">
                          ({new Date(date).toLocaleDateString()})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Social Links */}
          {displaySpeaker.social_links && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Connect</h4>
              <div className="flex gap-3">
                {displaySpeaker.social_links.linkedin && (
                  <a href={displaySpeaker.social_links.linkedin} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">LinkedIn</a>
                )}
                {displaySpeaker.social_links.twitter && (
                  <a href={`https://twitter.com/${displaySpeaker.social_links.twitter}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm">Twitter</a>
                )}
                {displaySpeaker.social_links.website && (
                  <a href={displaySpeaker.social_links.website} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline text-sm">Website</a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
