/**
 * EventCard Component
 * 
 * A comprehensive event display component that shows detailed event information
 * including speakers, sponsors, organizations, and interactive features.
 * 
 * Features:
 * - Event details display (title, dates, location, venue)
 * - Speaker information with enhanced profiles
 * - Organization information (sponsors, partners, competitors)
 * - Save to watchlist functionality
 * - Expandable speaker details
 * - Topic tags display
 * 
 * @author Attendry Team
 * @version 2.0
 */

"use client";
import React, { useState, useMemo, useCallback, memo } from "react";
import AttendeeCard from "./AttendeeCard";
import EnhancedSpeakerCard from "./EnhancedSpeakerCard"; // Speaker card component
import CompanyCard from "./CompanyCard"; // Company/sponsor card component
import { SpeakerData } from "@/lib/types/core";

/**
 * Event data structure interface
 */
interface Event {
  id?: string;                      // Event ID
  title?: string;                   // Event title
  starts_at?: string | null;        // Start date (ISO format)
  ends_at?: string | null;          // End date (ISO format)
  city?: string | null;             // Event city
  country?: string | null;          // Event country
  venue?: string | null;            // Event venue
  location?: string | null;         // Event location (city, country)
  organizer?: string | null;        // Event organizer
  topics?: string[];                // Event topics/themes
  speakers?: SpeakerData[] | null;  // Array of speaker objects
  sponsors?: string[] | null;       // Array of sponsor names
  participating_organizations?: string[] | null; // Participating organizations
  partners?: string[] | null;       // Event partners
  competitors?: string[] | null;    // Industry competitors
  source_url: string;              // Source URL of the event
  description?: string | null;      // Event description
  confidence?: number | null;       // Event confidence score
  confidence_reason?: string | null; // Confidence reason
  pipeline_metadata?: any | null;   // Pipeline metadata (LLM enhanced, quality scores, etc.)
}

/**
 * EventCard component props
 */
interface EventCardProps {
  ev: Event;                        // Event data object
  initiallySaved?: boolean;         // Whether the event is initially saved to watchlist
  onAddToComparison?: (event: Event) => void; // Callback for adding to comparison
}

/**
 * Main EventCard component
 * 
 * @param ev - Event data object containing all event information
 * @param initiallySaved - Whether the event is initially saved to watchlist
 * @returns JSX element representing the event card
 */
const EventCard = memo(function EventCard({ ev, initiallySaved = false, onAddToComparison }: EventCardProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [saved, setSaved] = useState(initiallySaved);           // Whether event is saved to watchlist
  const [busy, setBusy] = useState(false);                     // Loading state for save operation
  const [open, setOpen] = useState(false);                     // Whether event details are expanded
  const [includePast, setIncludePast] = useState(false);       // Whether to include past speakers
  const [loadingSpeakers, setLoadingSpeakers] = useState(false); // Loading state for speaker extraction
  const [speakers, setSpeakers] = useState<SpeakerData[] | null>(null); // Extracted speaker data
  const [followed, setFollowed] = useState<string[]>([]);       // List of followed speakers

  // ============================================================================
  // DEBUG: Log event data to understand what we're receiving
  // ============================================================================
  console.log('EventCard received event:', {
    title: ev.title,
    speakers: ev.speakers,
    speakersLength: ev.speakers?.length,
    speakersType: typeof ev.speakers,
    speakersIsArray: Array.isArray(ev.speakers)
  });

  // ============================================================================
  // DEBUG: Force speakers to be set if they exist in event data
  // ============================================================================
  React.useEffect(() => {
    if (ev.speakers && ev.speakers.length > 0 && speakers === null) {
      console.log('DEBUG: Auto-setting speakers from event data:', ev.speakers);
      setSpeakers(ev.speakers);
    }
  }, [ev.speakers, speakers]);

  // ============================================================================
  // COMPUTED VALUES (Memoized for performance)
  // ============================================================================
  
  // Format event date for display
  const when = useMemo(() => 
    ev.starts_at ? new Date(ev.starts_at).toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" }) : "TBA",
    [ev.starts_at]
  );
  
  // Format event location for display
  const where = useMemo(() => 
    [ev.city, ev.country].filter(Boolean).join(", ") || "Location TBA",
    [ev.city, ev.country]
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  /**
   * Toggle save/remove event from watchlist
   * 
   * This function handles adding or removing the event from the user's watchlist.
   * It includes authentication checks and proper error handling.
   */
  const toggleSave = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const body = JSON.stringify({ kind: "event", label: ev.title, ref_id: ev.source_url });
    try {
      if (!saved) {
        // Add to watchlist
        const res = await fetch("/api/watchlist/add", { method: "POST", headers: { "Content-Type":"application/json" }, body });
        const j = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            alert("Please log in to save items.");
            if (typeof window !== 'undefined') {
              window.location.href = "/login";
            }
            return;
          }
          throw new Error(j.error || "Save failed");
        }
        setSaved(true);
      } else {
        // Remove from watchlist
        const res = await fetch("/api/watchlist/remove", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ kind:"event", ref_id: ev.source_url }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Unsave failed");
        setSaved(false);
      }
    } catch (e: any) {
      alert(e.message || "Action failed");
    } finally {
      setBusy(false);
    }
  }, [busy, saved, ev.title, ev.source_url]);

  /**
   * Load speaker information for the event
   * 
   * This function fetches detailed speaker information from the event URL,
   * including enhanced profiles with professional details.
   * 
   * @param past - Whether to include past speakers in the results
   */
  const loadSpeakers = useCallback(async (past: boolean) => {
    setLoadingSpeakers(true);
    try {
      const res = await fetch("/api/events/speakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ev.source_url, includePast: past }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "load failed");
      setSpeakers(j.speakers || []);
      setFollowed(j.followed || []);
    } catch (e: any) {
      alert(e.message || "Could not load speakers");
      setSpeakers([]);
      setFollowed([]);
    } finally {
      setLoadingSpeakers(false);
    }
  }, [ev.source_url]);

  /**
   * Toggle event details expansion
   * 
   * This function handles expanding/collapsing the event details.
   * When expanding for the first time, it automatically loads speaker information.
   */
  const toggleOpen = useCallback(() => {
    const next = !open;
    setOpen(next);
    console.log('toggleOpen called:', { next, speakers, evSpeakers: ev.speakers, evSpeakersLength: ev.speakers?.length });
    if (next && speakers == null) {
      // First check if speakers are already available in the event data
      if (ev.speakers && ev.speakers.length > 0) {
        console.log('Setting speakers from event data:', ev.speakers);
        setSpeakers(ev.speakers);
      } else {
        console.log('No speakers in event data, loading via API');
        // If no speakers in event data, load them via API
        loadSpeakers(includePast);
      }
    }
  }, [open, speakers, ev.speakers, loadSpeakers]);

  return (
    <div className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <a 
            href={ev.source_url} 
            target="_blank" 
            rel="noreferrer" 
            className="text-xl font-semibold text-slate-900 hover:text-blue-600 transition-colors duration-200 line-clamp-2"
          >
            {ev.title || "Untitled Event"}
          </a>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{when}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{where}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
          <button
            onClick={toggleOpen}
            className="text-sm font-medium rounded-lg px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors duration-200"
          >
            {open ? "Hide speakers" : "View speakers"}
          </button>
          <button
            onClick={toggleSave}
            disabled={busy}
            className={`text-sm font-medium rounded-lg px-3 py-2 border transition-all duration-200 disabled:opacity-50 ${
              saved 
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" 
                : "border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400"
            }`}
            aria-pressed={saved}
          >
            {busy ? (
              <div className="flex items-center gap-1">
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {saved ? "Removing…" : "Saving…"}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {saved ? (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Saved
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Save
                  </>
                )}
              </div>
            )}
          </button>
          {onAddToComparison && (
            <button
              onClick={() => onAddToComparison(ev)}
              className="text-sm font-medium rounded-lg px-3 py-2 border border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors duration-200"
            >
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Compare
              </div>
            </button>
          )}
        </div>
      </div>
      
      {/* Enhanced Organization Information */}
      <div className="space-y-3 mb-4">
        {ev.organizer && (
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-700">Organizer:</span> {ev.organizer}
          </div>
        )}
        
        {ev.venue && (
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-700">Venue:</span> {ev.venue}
          </div>
        )}

        {/* Enhanced Speaker Summary */}
        {(speakers && speakers.length > 0 ? speakers : ev.speakers) && (speakers && speakers.length > 0 ? speakers : ev.speakers)!.length > 0 && (
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">🎤 Speakers ({speakers && speakers.length > 0 ? speakers.length : ev.speakers!.length}):</div>
            <div className="space-y-1">
              {(speakers && speakers.length > 0 ? speakers : ev.speakers)!.slice(0, 3).map((speaker: any, idx: number) => (
                <div key={idx} className="text-sm text-slate-600">
                  <span className="font-medium">{speaker.name}</span>
                  {speaker.title && <span className="text-slate-500"> - {speaker.title}</span>}
                  {speaker.org && <span className="text-slate-500"> at {speaker.org}</span>}
                </div>
              ))}
              {(speakers && speakers.length > 3 ? speakers.length : (ev.speakers?.length || 0)) > 3 && (
                <div className="text-xs text-slate-500">
                  +{(speakers && speakers.length > 0 ? speakers.length : (ev.speakers?.length || 0)) - 3} more speakers
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sponsors Summary */}
        {ev.sponsors && ev.sponsors.length > 0 && (
          <div>
            <div className="text-sm font-medium text-slate-700 mb-1">💰 Sponsors ({ev.sponsors.length}):</div>
            <div className="flex flex-wrap gap-1">
              {ev.sponsors.slice(0, 4).map((sponsor: string, idx: number) => (
                <span key={idx} className="text-xs font-medium rounded-full bg-green-100 text-green-800 px-2 py-1">
                  {sponsor}
                </span>
              ))}
              {ev.sponsors.length > 4 && (
                <span className="text-xs text-slate-500 px-2 py-1">
                  +{ev.sponsors.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Participating Organizations Summary */}
        {ev.participating_organizations && ev.participating_organizations.length > 0 && (
          <div>
            <div className="text-sm font-medium text-slate-700 mb-1">🏢 Participating Organizations ({ev.participating_organizations.length}):</div>
            <div className="flex flex-wrap gap-1">
              {ev.participating_organizations.slice(0, 4).map((org: string, idx: number) => (
                <span key={idx} className="text-xs font-medium rounded-full bg-blue-100 text-blue-800 px-2 py-1">
                  {org}
                </span>
              ))}
              {ev.participating_organizations.length > 4 && (
                <span className="text-xs text-slate-500 px-2 py-1">
                  +{ev.participating_organizations.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}


        {/* Partners */}
        {ev.partners && ev.partners.length > 0 && (
          <div>
            <div className="text-sm font-medium text-slate-700 mb-1">🤝 Partners:</div>
            <div className="flex flex-wrap gap-2">
              {ev.partners.slice(0, 4).map((partner: string, idx: number) => (
                <span key={idx} className="text-xs font-medium rounded-full bg-purple-100 text-purple-800 px-2 py-1">
                  {partner}
                </span>
              ))}
              {ev.partners.length > 4 && (
                <span className="text-xs text-slate-500 px-2 py-1">
                  +{ev.partners.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Competitors */}
        {ev.competitors && ev.competitors.length > 0 && (
          <div>
            <div className="text-sm font-medium text-slate-700 mb-1">⚔️ Industry Competitors:</div>
            <div className="flex flex-wrap gap-2">
              {ev.competitors.slice(0, 4).map((competitor: string, idx: number) => (
                <span key={idx} className="text-xs font-medium rounded-full bg-red-100 text-red-800 px-2 py-1">
                  {competitor}
                </span>
              ))}
              {ev.competitors.length > 4 && (
                <span className="text-xs text-slate-500 px-2 py-1">
                  +{ev.competitors.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      
      {!!(ev.topics?.length) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {ev.topics.slice(0, 6).map((t: string) => (
            <span key={t} className="text-xs font-medium rounded-full bg-blue-50 text-blue-700 px-3 py-1">
              {t}
            </span>
          ))}
          {ev.topics.length > 6 && (
            <span className="text-xs text-slate-500 px-2 py-1">
              +{ev.topics.length - 6} more
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-medium text-slate-700">
                Speakers {loadingSpeakers ? "…" : speakers ? `(${speakers.length})` : ev.speakers && ev.speakers.length > 0 ? `(${ev.speakers.length})` : ""}
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includePast}
                onChange={(e) => { setIncludePast(e.target.checked); loadSpeakers(e.target.checked); }}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              Include past editions
            </label>
          </div>

          {loadingSpeakers && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-slate-600">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Fetching speakers...</span>
              </div>
            </div>
          )}

          {!loadingSpeakers && speakers && speakers.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-slate-600">No speakers found for this event.</p>
            </div>
          )}

          {/* DEBUG: Always show speakers if they exist */}
          {speakers && speakers.length > 0 && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {(() => { console.log('Rendering speakers:', speakers); return null; })()}
              {speakers.map((p, idx) => (
                <EnhancedSpeakerCard 
                  key={(p.name || "unknown") + (p.org || "") + idx} 
                  speaker={p} 
                  sessionTitle={p.session || p.speech_title}
                />
              ))}
            </div>
          )}

          {/* Original conditional rendering */}
          {!loadingSpeakers && speakers && speakers.length > 0 && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {(() => { console.log('Rendering speakers (original):', speakers); return null; })()}
              {speakers.map((p, idx) => (
                <EnhancedSpeakerCard 
                  key={(p.name || "unknown") + (p.org || "") + idx} 
                  speaker={p} 
                  sessionTitle={p.session || p.speech_title}
                />
              ))}
            </div>
          )}

          {/* Sponsors Section */}
          {ev.sponsors && ev.sponsors.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <span className="font-medium text-slate-700">
                  Sponsors ({ev.sponsors.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ev.sponsors.map((sponsor: string, idx: number) => (
                  <span key={idx} className="text-sm font-medium rounded-full bg-green-100 text-green-800 px-3 py-1">
                    {sponsor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Participating Organizations Section */}
          {ev.participating_organizations && ev.participating_organizations.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="font-medium text-slate-700">
                  Participating Organizations ({ev.participating_organizations.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ev.participating_organizations.map((org: string, idx: number) => (
                  <span key={idx} className="text-sm font-medium rounded-full bg-blue-100 text-blue-800 px-3 py-1">
                    {org}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!!followed?.length && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Sources followed:</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">{followed.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default EventCard;
