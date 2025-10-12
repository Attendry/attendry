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
import React, { useState, useEffect } from "react";
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
  industry_connections?: string[]; // Industry associations and connections
  recent_news?: string[];          // Recent media mentions and news
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
      
      setEnhancedSpeaker(j.enhanced);
    } catch (e: unknown) {
      setEnhancementError((e as Error)?.message || "Enhancement failed");
    } finally {
      setEnhancing(false);
    }
  }

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
  
  // Check if speaker has enhanced data
  const hasEnhancedData = enhancedSpeaker && (
    enhancedSpeaker.education?.length ||
    enhancedSpeaker.publications?.length ||
    enhancedSpeaker.career_history?.length ||
    enhancedSpeaker.expertise_areas?.length ||
    enhancedSpeaker.achievements?.length ||
    enhancedSpeaker.industry_connections?.length ||
    enhancedSpeaker.recent_news?.length
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
          <div className="font-semibold text-lg text-slate-900">{displaySpeaker.name}</div>
          {displaySpeaker.title && <div className="text-sm text-slate-700">{displaySpeaker.title}</div>}
          {displaySpeaker.org && <div className="text-sm text-slate-600">{displaySpeaker.org}</div>}
          {displaySpeaker.location && <div className="text-xs text-slate-500 mt-1">{displaySpeaker.location}</div>}
          
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
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium rounded-full px-3 py-1 border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors duration-200"
        >
          {expanded ? "Show Less" : "More Details"}
        </button>
        
        {/* Enhancement button - only show if not already enhanced and not currently enhancing */}
        {!hasEnhancedData && !enhancing && (
          <button
            onClick={enhanceSpeaker}
            disabled={enhancing}
            className="text-xs font-medium rounded-full px-3 py-1 border border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors duration-200 disabled:opacity-50"
          >
            {enhancing ? "Enhancing..." : "Enhance Profile"}
          </button>
        )}
        
        {/* Show enhancement status */}
        {enhancing && (
          <span className="text-xs text-blue-600 flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            Enhancing with AI...
          </span>
        )}
        
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
          {!hasEnhancedData && !enhancing && (
            <div className="text-center py-4 text-slate-500">
              <p className="text-sm">Click "Enhance Profile" to get detailed professional information</p>
            </div>
          )}
          
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
                {displaySpeaker.industry_connections.map((connection: string, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">• {connection}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent News */}
          {displaySpeaker.recent_news && displaySpeaker.recent_news.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Recent News & Media</h4>
              <ul className="space-y-1">
                {displaySpeaker.recent_news.map((news: string, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">• {news}</li>
                ))}
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
