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

/**
 * Enhanced speaker data structure interface
 */
interface EnhancedSpeaker {
  name: string;                    // Speaker's full name
  org: string;                     // Current organization
  title: string;                   // Job title or role
  speech_title?: string;           // Title of their presentation/speech
  session?: string;                // Session name or track
  bio?: string;                    // Professional biography
  profile_url?: string;            // LinkedIn or personal profile URL
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
  confidence: number;              // Data quality confidence score (0-1)
}

/**
 * EnhancedSpeakerCard component props
 */
interface EnhancedSpeakerCardProps {
  speaker: EnhancedSpeaker;        // Speaker data object
  eventTitle?: string;             // Title of the event this speaker is associated with
  sessionTitle?: string;           // Title of the specific session (if different from event)
}

/**
 * Main EnhancedSpeakerCard component
 * 
 * @param speaker - Enhanced speaker data object
 * @param eventTitle - Title of the event this speaker is associated with
 * @param sessionTitle - Title of the specific session (if different from event)
 * @returns JSX element representing the speaker card
 */
export default function EnhancedSpeakerCard({ speaker, eventTitle, sessionTitle }: EnhancedSpeakerCardProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [expanded, setExpanded] = useState(false);  // Whether detailed sections are expanded
  const [busy, setBusy] = useState(false);          // Loading state for save operation

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
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
          <div className="font-semibold text-lg text-slate-900">{speaker.name}</div>
          {speaker.title && <div className="text-sm text-slate-700">{speaker.title}</div>}
          {speaker.org && <div className="text-sm text-slate-600">{speaker.org}</div>}
          {speaker.location && <div className="text-xs text-slate-500 mt-1">📍 {speaker.location}</div>}
          
          {/* Event/Session Title */}
          {(eventTitle || sessionTitle) && (
            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-xs font-medium text-blue-800 mb-1">Speaking at:</div>
              {sessionTitle && (
                <div className="text-sm font-medium text-blue-900">{sessionTitle}</div>
              )}
              {eventTitle && (
                <div className="text-xs text-blue-700">
                  {sessionTitle ? `Part of: ${eventTitle}` : eventTitle}
                </div>
              )}
            </div>
          )}
        </div>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getConfidenceColor(speaker.confidence)}`}>
          Confidence: {(speaker.confidence * 100).toFixed(0)}%
        </span>
      </div>

      {speaker.speech_title && (
        <div className="mt-2 text-sm font-medium text-blue-700">
          🎤 {speaker.speech_title}
        </div>
      )}
      {speaker.session && (
        <div className="text-xs text-slate-500">
          Session: {speaker.session}
        </div>
      )}

      {speaker.bio && !expanded && (
        <p className="mt-3 text-sm text-slate-800 line-clamp-2">
          {speaker.bio}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium rounded-full px-3 py-1 border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors duration-200"
        >
          {expanded ? "Show Less" : "More Details"}
        </button>
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
          {speaker.bio && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Professional Summary</h4>
              <p className="text-sm text-slate-800">{speaker.bio}</p>
            </div>
          )}

          {speaker.education && speaker.education.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Education</h4>
              <ul className="space-y-1">
                {speaker.education.map((edu, idx) => (
                  <li key={idx} className="text-sm text-slate-700">• {edu}</li>
                ))}
              </ul>
            </div>
          )}

          {speaker.career_history && speaker.career_history.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Career History</h4>
              <ul className="space-y-1">
                {speaker.career_history.map((career, idx) => (
                  <li key={idx} className="text-sm text-slate-700">• {career}</li>
                ))}
              </ul>
            </div>
          )}

          {speaker.publications && speaker.publications.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Publications</h4>
              <ul className="space-y-1">
                {speaker.publications.map((pub, idx) => (
                  <li key={idx} className="text-sm text-slate-700">• {pub}</li>
                ))}
              </ul>
            </div>
          )}

          {speaker.expertise_areas && speaker.expertise_areas.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Expertise Areas</h4>
              <div className="flex flex-wrap gap-2">
                {speaker.expertise_areas.map((area, idx) => (
                  <span key={idx} className="text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 px-2 py-1">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Speaking History */}
          {speaker.speaking_history && speaker.speaking_history.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Speaking History</h4>
              <ul className="space-y-1">
                {speaker.speaking_history.map((event, idx) => (
                  <li key={idx} className="text-sm text-slate-700">• {event}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Achievements */}
          {speaker.achievements && speaker.achievements.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Key Achievements</h4>
              <ul className="space-y-1">
                {speaker.achievements.map((achievement, idx) => (
                  <li key={idx} className="text-sm text-slate-700">• {achievement}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Industry Connections */}
          {speaker.industry_connections && speaker.industry_connections.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Industry Connections</h4>
              <ul className="space-y-1">
                {speaker.industry_connections.map((connection, idx) => (
                  <li key={idx} className="text-sm text-slate-700">• {connection}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent News */}
          {speaker.recent_news && speaker.recent_news.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Recent News & Media</h4>
              <ul className="space-y-1">
                {speaker.recent_news.map((news, idx) => (
                  <li key={idx} className="text-sm text-slate-700">• {news}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Social Links */}
          {speaker.social_links && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Connect</h4>
              <div className="flex gap-3">
                {speaker.social_links.linkedin && (
                  <a href={speaker.social_links.linkedin} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">LinkedIn</a>
                )}
                {speaker.social_links.twitter && (
                  <a href={`https://twitter.com/${speaker.social_links.twitter}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm">Twitter</a>
                )}
                {speaker.social_links.website && (
                  <a href={speaker.social_links.website} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline text-sm">Website</a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
