/**
 * ExpandableSpeakerCard Component
 * 
 * An enhanced speaker card that can expand to show more detailed information
 * when the right earmark is clicked. Features smooth animations and responsive design.
 * 
 * Features:
 * - Clickable right earmark for expansion
 * - Smooth size transitions
 * - Responsive layout that adapts to expansion
 * - Enhanced information display in expanded state
 * - Maintains existing speaker enhancement functionality
 * 
 * @author Attendry Team
 * @version 2.1
 */

"use client";
import React, { useState } from "react";
import { SpeakerData } from "@/lib/types/core";
import { ChevronRight, ChevronDown, Maximize2, Minimize2, Linkedin, ExternalLink } from "lucide-react";
import { useSpeakerEnhancement } from "@/lib/hooks/useSpeakerEnhancement";
import SpeakerDataDebugger from "./SpeakerDataDebugger";
import { normalizeSpeakerData, getDisplayTitle, getDisplayOrganization } from "@/lib/utils/speaker-data-normalizer";
import "@/lib/utils/speaker-cache-debug"; // Import debug utilities

/**
 * Enhanced speaker data structure interface
 * Extends the base SpeakerData with additional professional information
 */
interface EnhancedSpeaker extends SpeakerData {
  location?: string;
  education?: string[];
  publications?: string[];
  career_history?: string[];
  social_links?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  expertise_areas?: string[];
  speaking_history?: string[];
  achievements?: string[];
  industry_connections?: Array<{name: string, org?: string, url?: string}> | string[];
  recent_news?: Array<{title: string, url: string, date?: string}> | string[];
}

/**
 * ExpandableSpeakerCard component props
 */
interface ExpandableSpeakerCardProps {
  speaker: SpeakerData;
  sessionTitle?: string;
  isExpanded?: boolean;
  onToggleExpansion?: (expanded: boolean) => void;
}

/**
 * Main ExpandableSpeakerCard component
 */
export default function ExpandableSpeakerCard({ 
  speaker, 
  sessionTitle,
  isExpanded = false,
  onToggleExpansion
}: ExpandableSpeakerCardProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [expanded, setExpanded] = useState(isExpanded);
  const [busy, setBusy] = useState(false);
  
  // Use the custom hook for speaker enhancement
  const {
    enhancedSpeaker,
    enhancing,
    enhancementError,
    cached,
    enhanceSpeaker,
    hasEnhancedData
  } = useSpeakerEnhancement(speaker);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  const handleToggleExpansion = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggleExpansion?.(newExpanded);

    // Auto-enhance when expanding if not already enhanced
    if (newExpanded && !enhancedSpeaker && !enhancing) {
      void enhanceSpeaker();
    }
  };


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
  
  // Normalize the speaker data to ensure consistent field access
  const normalizedSpeaker = normalizeSpeakerData(speaker);
  
  // Always use enhanced data if available, but fall back to basic speaker data
  const displaySpeaker: EnhancedSpeaker = enhancedSpeaker || normalizedSpeaker;
  
  // Use the utility functions to get display values
  const displayTitle = getDisplayTitle(normalizedSpeaker, enhancedSpeaker);
  const displayOrg = getDisplayOrganization(normalizedSpeaker, enhancedSpeaker);
  
  // Check if we have any basic information available
  const hasBasicInfo = !!(displayTitle || displayOrg);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
  };

  return (
    <div className={`
      relative rounded-xl border bg-white dark:bg-gray-800 shadow-sm transition-all duration-500 ease-in-out
      ${expanded 
        ? 'col-span-2 row-span-2 shadow-lg border-blue-200 dark:border-blue-700' 
        : 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600'
      }
    `}>
      <SpeakerDataDebugger speaker={speaker} label="ExpandableSpeakerCard Data" />
      {/* Right Earmark - Clickable Expansion Trigger */}
      <button
        onClick={handleToggleExpansion}
        className={`
          absolute top-4 right-4 p-2 rounded-full transition-all duration-300 ease-in-out
          ${expanded 
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50' 
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-300'
          }
          group
        `}
        aria-label={expanded ? "Minimize speaker card" : "Expand speaker card"}
      >
        {expanded ? (
          <Minimize2 size={16} className="transition-transform duration-300 group-hover:scale-110" />
        ) : (
          <Maximize2 size={16} className="transition-transform duration-300 group-hover:scale-110" />
        )}
      </button>

      <div className={`p-4 transition-all duration-500 ease-in-out ${expanded ? 'p-6' : ''}`}>
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 pr-12">
            <div className={`font-semibold text-slate-900 dark:text-white mb-2 transition-all duration-300 ${
              expanded ? 'text-2xl' : 'text-xl'
            }`}>
              {displaySpeaker.name}
            </div>
            
            {/* Job Title and Organization */}
            <div className="mb-3">
              <div className={`font-medium text-slate-800 dark:text-slate-200 mb-1 flex flex-wrap items-baseline gap-2 ${
                expanded ? 'text-lg' : 'text-base'
              }`}>
                {displayTitle ? (
                  <span>{displayTitle}</span>
                ) : (
                  <span className="italic text-slate-400 dark:text-slate-500">Title not provided yet</span>
                )}
                {displayTitle && displayOrg && (
                  <span className="text-slate-400 dark:text-slate-500">·</span>
                )}
                {displayOrg ? (
                  <span className={`font-medium text-slate-700 dark:text-slate-300 ${
                    expanded ? 'text-base' : 'text-sm'
                  }`}>
                    {displayOrg}
                  </span>
                ) : (
                  <span className={`font-medium text-slate-700 dark:text-slate-300 italic ${
                    expanded ? 'text-base' : 'text-sm'
                  }`}>
                    Organization not provided yet
                  </span>
                )}
              </div>
              {displaySpeaker.location && (
                <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
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
              <div className={`p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 ${
                expanded ? 'p-4' : 'p-2'
              }`}>
                <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">Speaking on:</div>
                <div className={`font-medium text-blue-900 dark:text-blue-200 ${
                  expanded ? 'text-base' : 'text-sm'
                }`}>
                  {sessionTitle}
                </div>
              </div>
            )}
          </div>
          
          {/* Confidence Badge */}
          {displaySpeaker.confidence && (
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getConfidenceColor(displaySpeaker.confidence)}`}>
              Confidence: {(displaySpeaker.confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>

        {/* Bio Section */}
        {displaySpeaker.bio && (
          <div className="mb-4">
            <p className={`text-slate-800 dark:text-slate-200 transition-all duration-300 ${
              expanded 
                ? 'text-sm line-clamp-4' 
                : 'text-sm line-clamp-2'
            }`}>
              {displaySpeaker.bio}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={enhanceSpeaker}
            disabled={enhancing}
            className="text-xs font-medium rounded-full px-3 py-1 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-colors duration-200 disabled:opacity-60 flex items-center gap-2"
          >
            {enhancing ? (
              <>
                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                Enhancing…
              </>
            ) : hasEnhancedData ? (
              cached ? "Show Saved Details" : "Show Details"
            ) : (
              "Enhance Profile"
            )}
          </button>

          {cached && !enhancing && (
            <span className="text-xs text-slate-500 dark:text-slate-400">Loaded from saved profile</span>
          )}

          {enhancementError && (
            <span className="text-xs text-red-600 dark:text-red-400">
              Enhancement failed: {enhancementError}
            </span>
          )}
          
          <button
            onClick={save}
            disabled={busy}
            className="text-xs rounded-full border border-slate-300 dark:border-slate-600 px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-slate-700 dark:text-slate-300 transition-colors duration-200"
          >
            {busy ? "Saving…" : "Save to Watchlist"}
          </button>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-6 animate-fade-in">
            {/* Professional Information Grid */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                </svg>
                Professional Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displaySpeaker.title && (
                  <div>
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Job Title</div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{displaySpeaker.title}</div>
                  </div>
                )}
                {displaySpeaker.org && (
                  <div>
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Organization</div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{displaySpeaker.org}</div>
                  </div>
                )}
                {displaySpeaker.location && (
                  <div>
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Location</div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1">
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
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Data Quality</div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      <span className={`px-2 py-1 rounded-full text-xs ${getConfidenceColor(displaySpeaker.confidence)}`}>
                        {(displaySpeaker.confidence * 100).toFixed(0)}% Confidence
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Information Sections */}
            {hasEnhancedData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Education */}
                {displaySpeaker.education && displaySpeaker.education.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Education</h4>
                    <ul className="space-y-2">
                      {displaySpeaker.education.map((edu: string, idx: number) => (
                        <li key={idx} className="text-sm text-slate-700 dark:text-slate-300">• {edu}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Expertise Areas */}
                {displaySpeaker.expertise_areas && displaySpeaker.expertise_areas.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Expertise Areas</h4>
                    <div className="flex flex-wrap gap-2">
                      {displaySpeaker.expertise_areas.map((area: string, idx: number) => (
                        <span key={idx} className="text-xs font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 px-3 py-1">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Achievements */}
                {displaySpeaker.achievements && displaySpeaker.achievements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Key Achievements</h4>
                    <ul className="space-y-2">
                      {displaySpeaker.achievements.map((achievement: string, idx: number) => (
                        <li key={idx} className="text-sm text-slate-700 dark:text-slate-300">• {achievement}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Industry Connections */}
                {displaySpeaker.industry_connections && displaySpeaker.industry_connections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Industry Connections</h4>
                    <ul className="space-y-2">
                      {displaySpeaker.industry_connections.map((connection: any, idx: number) => {
                        if (!connection) return null;
                        
                        const isStructured = typeof connection === 'object' && connection !== null && connection.name;
                        const name = isStructured ? String(connection.name || '') : String(connection || '');
                        const org = isStructured ? String(connection.org || '') : null;
                        const url = isStructured ? String(connection.url || '') : null;
                        
                        if (!name || name === 'undefined' || name === 'null') return null;
                        
                        return (
                          <li key={idx} className="text-sm text-slate-700 dark:text-slate-300">
                            • {name}
                            {org && org !== 'undefined' && org !== 'null' && (
                              <span className="text-slate-500 dark:text-slate-400"> ({org})</span>
                            )}
                            {url && url !== 'undefined' && url !== 'null' && url.startsWith('http') && (
                              <a href={url} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 dark:text-blue-400 hover:underline text-xs">
                                [source]
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* LinkedIn Search & Social Links */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Connect</h4>
              
              {/* Quick LinkedIn Search */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-2 mb-2">
                  <Linkedin size={16} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Quick LinkedIn Search</span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                  Search for {displaySpeaker.name} on LinkedIn to connect or view their profile
                </p>
                <a
                  href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(displaySpeaker.name + (displaySpeaker.org ? ` ${displaySpeaker.org}` : ''))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                >
                  <Linkedin size={14} />
                  Search on LinkedIn
                  <ExternalLink size={12} />
                </a>
              </div>

              {/* Existing Social Links */}
              {displaySpeaker.social_links && (
                <div>
                  <h5 className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Direct Links</h5>
                  <div className="flex gap-4">
                    {displaySpeaker.social_links.linkedin && (
                      <a href={displaySpeaker.social_links.linkedin} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1">
                        <Linkedin size={12} />
                        LinkedIn
                      </a>
                    )}
                    {displaySpeaker.social_links.twitter && (
                      <a href={`https://twitter.com/${displaySpeaker.social_links.twitter}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm">
                        Twitter
                      </a>
                    )}
                    {displaySpeaker.social_links.website && (
                      <a href={displaySpeaker.social_links.website} target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 hover:underline text-sm">
                        Website
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
