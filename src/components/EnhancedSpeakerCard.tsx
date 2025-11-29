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
import { useSpeakerEnhancement } from "@/lib/hooks/useSpeakerEnhancement";
import SpeakerDataDebugger from "./SpeakerDataDebugger";
import { normalizeSpeakerData, getDisplayTitle, getDisplayOrganization } from "@/lib/utils/speaker-data-normalizer";
import "@/lib/utils/speaker-cache-debug"; // Import debug utilities
import { toast } from "sonner";

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
  recent_projects?: Array<{name: string, description: string, date?: string}>;         // Recent projects and initiatives
  company_size?: string;           // Company size (e.g., "500-1000 employees")
  team_info?: string;              // Team leadership information
  speaking_topics?: string[];      // Key topics they speak about
  media_mentions?: Array<{outlet: string, title: string, url: string, date: string}>; // Media appearances and mentions
  board_positions?: string[];      // Board positions and advisory roles
  certifications?: string[];       // Professional certifications
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
  const [profileSaved, setProfileSaved] = useState(false); // Whether profile is saved
  const [savingProfile, setSavingProfile] = useState(false); // Loading state for profile save
  
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
  

  const handleToggleDetails = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);

    if (nextExpanded && !enhancedSpeaker && !enhancing) {
      void enhanceSpeaker();
    } else if (!nextExpanded) {
      // Enhancement error is now managed by the hook
    }
  };

  /**
   * Save speaker to user's watchlist
   * 
   * This function adds the speaker to the user's watchlist for later reference.
   * It uses the speaker's profile URL or creates a unique identifier.
   */
  async function saveToWatchlist() {
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
      toast.success("Saved to watchlist", {
        description: `${speaker.name} has been added to your watchlist`
      });
    } catch (e: unknown) {
      toast.error("Save failed", {
        description: (e as Error)?.message || "Could not save to watchlist. Please try again."
      });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Save enhanced speaker profile for outreach and relationship management
   */
  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profiles/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker_data: speaker,
          enhanced_data: displaySpeaker,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      setProfileSaved(true);
      toast.success("Profile saved", {
        description: "Speaker profile saved for outreach tracking"
      });
    } catch (e: unknown) {
      toast.error("Save failed", {
        description: (e as Error)?.message || "Could not save profile. Please try again."
      });
    } finally {
      setSavingProfile(false);
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
  
  // Determine confidence color based on data quality score
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  // Date filtering utilities
  const isWithinLast12Months = (dateString: string): boolean => {
    try {
      const date = new Date(dateString);
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      return date >= twelveMonthsAgo;
    } catch {
      return false;
    }
  };

  const filterRecentItems = <T extends { date?: string }>(items: T[]): T[] => {
    return items.filter(item => {
      if (!item.date) return true; // Keep items without dates
      return isWithinLast12Months(item.date);
    });
  };

  const formatRelativeDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMonths = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30));
      
      if (diffInMonths === 0) return "This month";
      if (diffInMonths === 1) return "1 month ago";
      if (diffInMonths < 12) return `${diffInMonths} months ago`;
      
      const diffInYears = Math.floor(diffInMonths / 12);
      if (diffInYears === 1) return "1 year ago";
      return `${diffInYears} years ago`;
    } catch {
      return dateString;
    }
  };

  // Filter time-sensitive data
  const filteredRecentNews = displaySpeaker.recent_news ? 
    filterRecentItems(Array.isArray(displaySpeaker.recent_news) ? 
      displaySpeaker.recent_news.filter(item => typeof item === 'object' && item !== null) : []) : [];
  
  const filteredMediaMentions = displaySpeaker.media_mentions ? 
    filterRecentItems(displaySpeaker.media_mentions) : [];
  
  const filteredSpeakingHistory = displaySpeaker.speaking_history ? 
    displaySpeaker.speaking_history.filter((item: string) => {
      // For speaking history, try to extract dates from the string
      const dateMatch = item.match(/\b(20\d{2})\b/);
      if (dateMatch) {
        return isWithinLast12Months(`${dateMatch[1]}-01-01`);
      }
      return true; // Keep items without clear dates
    }) : [];

  return (
    <div className="rounded-xl border p-4 bg-white shadow-sm">
      <SpeakerDataDebugger speaker={speaker} label="EnhancedSpeakerCard Data" />
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="font-semibold text-xl text-slate-900 mb-2">{displaySpeaker.name}</div>
          
          {/* Original Title and Organization (Always Visible) */}
          <div className="mb-3">
            <div className="text-lg font-medium text-slate-800 mb-1 flex flex-wrap items-baseline gap-2">
              {speaker.title ? (
                <span className="bg-blue-50 px-2 py-1 rounded-md text-blue-800 font-medium">
                  {speaker.title}
                </span>
              ) : (
                <span className="italic text-slate-400">Title not provided</span>
              )}
              {speaker.title && speaker.org && (
                <span className="text-slate-400">·</span>
              )}
              {speaker.org ? (
                <span className="text-base font-medium text-slate-700">{speaker.org}</span>
              ) : (
                <span className="text-base font-medium text-slate-700 italic text-slate-400">Organization not provided</span>
              )}
            </div>
            
            {/* Enhanced Title/Organization (if different from original) */}
            {enhancedSpeaker && (enhancedSpeaker.title !== speaker.title || enhancedSpeaker.organization !== speaker.org) && (
              <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
                <div className="text-xs font-medium text-green-800 mb-1">Enhanced Information:</div>
                <div className="text-sm text-green-900">
                  {enhancedSpeaker.title && enhancedSpeaker.title !== speaker.title && (
                    <div className="font-medium">{enhancedSpeaker.title}</div>
                  )}
                  {enhancedSpeaker.organization && enhancedSpeaker.organization !== speaker.org && (
                    <div className="text-green-700">{enhancedSpeaker.organization}</div>
                  )}
                </div>
              </div>
            )}
            
            {displaySpeaker.location && (
              <div className="text-sm text-slate-600 flex items-center gap-1 mt-2">
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

      {/* Quick Facts Section - Show key info without expansion */}
      {!expanded && (displaySpeaker.expertise_areas || displaySpeaker.speaking_history || displaySpeaker.social_links || displaySpeaker.confidence) && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <h4 className="text-xs font-semibold text-slate-900 mb-2">Quick Facts</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {displaySpeaker.expertise_areas && displaySpeaker.expertise_areas.length > 0 && (
              <div>
                <span className="font-medium text-slate-600">Expertise:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {displaySpeaker.expertise_areas.slice(0, 2).map((area: string, idx: number) => (
                    <span key={idx} className="px-1 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs">
                      {area}
                    </span>
                  ))}
                  {displaySpeaker.expertise_areas.length > 2 && (
                    <span className="text-slate-500">+{displaySpeaker.expertise_areas.length - 2}</span>
                  )}
                </div>
              </div>
            )}
            
            {displaySpeaker.speaking_history && displaySpeaker.speaking_history.length > 0 && (
              <div>
                <span className="font-medium text-slate-600">Recent:</span>
                <div className="text-slate-700 mt-1 line-clamp-1">
                  {displaySpeaker.speaking_history[0]}
                </div>
              </div>
            )}
            
            {displaySpeaker.social_links && (
              <div>
                <span className="font-medium text-slate-600">Contact:</span>
                <div className="flex gap-2 mt-1">
                  {displaySpeaker.social_links.linkedin && (
                    <a href={displaySpeaker.social_links.linkedin} target="_blank" rel="noreferrer" 
                       className="text-blue-600 hover:underline">LinkedIn</a>
                  )}
                  {displaySpeaker.social_links.website && (
                    <a href={displaySpeaker.social_links.website} target="_blank" rel="noreferrer" 
                       className="text-purple-600 hover:underline">Website</a>
                  )}
                </div>
              </div>
            )}
            
            {displaySpeaker.confidence && (
              <div>
                <span className="font-medium text-slate-600">Data Quality:</span>
                <div className="mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${getConfidenceColor(displaySpeaker.confidence)}`}>
                    {(displaySpeaker.confidence * 100).toFixed(0)}% Confidence
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
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
      ) : expanded ? "Hide Details" : hasEnhancedData || hasBasicInfo ? (cached ? "Show Saved Details" : "Show Details") : "Enhance & Show"
          }
        </button>

        {cached && !enhancing && (
          <span className="text-xs text-slate-500">Loaded from saved profile</span>
        )}

        {enhancementError && (
          <span className="text-xs text-red-600">
            Enhancement failed: {enhancementError}
          </span>
        )}
        
        <button
          onClick={saveToWatchlist}
          disabled={busy}
          className="text-xs rounded-full border px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save to Watchlist"}
        </button>

        <button
          onClick={saveProfile}
          disabled={savingProfile || profileSaved}
          className={`text-xs rounded-full border px-3 py-1 disabled:opacity-50 ${
            profileSaved 
              ? "bg-green-50 border-green-200 text-green-700" 
              : "hover:bg-slate-50"
          }`}
        >
          {savingProfile ? "Saving…" : profileSaved ? "Saved ✓" : "Save Profile"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
          {/* Show message if no enhanced data is available */}
          {!hasEnhancedData && !enhancing && !hasBasicInfo && (
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
          {filteredSpeakingHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Recent Speaking History (Last 12 months)</h4>
              <ul className="space-y-1">
                {filteredSpeakingHistory.map((event: string, idx: number) => (
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
          {filteredRecentNews.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Recent News & Media (Last 12 months)</h4>
              <ul className="space-y-1">
                {filteredRecentNews.map((news: any, idx: number) => {
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
                          ({formatRelativeDate(date)})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Media Mentions */}
          {filteredMediaMentions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Media Mentions (Last 12 months)</h4>
              <ul className="space-y-1">
                {filteredMediaMentions.map((mention: any, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">
                    • <span className="font-medium">{mention.outlet}</span>: {mention.url && mention.url.startsWith('http') ? (
                      <a href={mention.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        {mention.title}
                      </a>
                    ) : mention.title}
                    {mention.date && (
                      <span className="text-slate-500 text-xs ml-2">
                        ({formatRelativeDate(mention.date)})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent Projects */}
          {displaySpeaker.recent_projects && displaySpeaker.recent_projects.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Recent Projects</h4>
              <ul className="space-y-2">
                {displaySpeaker.recent_projects.map((project: any, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">
                    <div className="font-medium">{project.name}</div>
                    <div className="text-slate-600">{project.description}</div>
                    {project.date && (
                      <div className="text-slate-500 text-xs">
                        {formatRelativeDate(project.date)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Company & Team Information */}
          {(displaySpeaker.company_size || displaySpeaker.team_info) && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Company & Team</h4>
              <div className="space-y-1">
                {displaySpeaker.company_size && (
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">Company Size:</span> {displaySpeaker.company_size}
                  </div>
                )}
                {displaySpeaker.team_info && (
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">Team:</span> {displaySpeaker.team_info}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Speaking Topics */}
          {displaySpeaker.speaking_topics && displaySpeaker.speaking_topics.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Speaking Topics</h4>
              <div className="flex flex-wrap gap-2">
                {displaySpeaker.speaking_topics.map((topic: string, idx: number) => (
                  <span key={idx} className="text-xs font-medium rounded-full bg-purple-100 text-purple-800 px-2 py-1">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Board Positions */}
          {displaySpeaker.board_positions && displaySpeaker.board_positions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Board Positions & Advisory Roles</h4>
              <ul className="space-y-1">
                {displaySpeaker.board_positions.map((position: string, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">• {position}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Certifications */}
          {displaySpeaker.certifications && displaySpeaker.certifications.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Certifications</h4>
              <ul className="space-y-1">
                {displaySpeaker.certifications.map((cert: string, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">• {cert}</li>
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
