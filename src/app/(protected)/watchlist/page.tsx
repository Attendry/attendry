"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { SavedSpeakerProfile } from "@/lib/types/database";

type WatchItem = { id: string; label: string | null; kind: "company" | "attendee"; created_at: string; owner?: string };

type TabType = "watchlist" | "saved-profiles";

export default function Watchlist() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("watchlist");
  
  // Watchlist state
  const [items, setItems] = useState<WatchItem[]>([]);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("");
  
  // Saved profiles state
  const [savedProfiles, setSavedProfiles] = useState<SavedSpeakerProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUserId(data.session?.user?.id ?? null);
        setAuthReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!cancelled) setUserId(session?.user?.id ?? null);
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  async function load() {
    if (!userId) return;
    const supabase = supabaseBrowser();
    const { data, error } = await supabase
      .from("watchlists")
      .select("*")
      .eq("owner", userId)
      .order("created_at", { ascending: false });
    if (error) setStatus(`Error: ${error.message}`); else setItems((data ?? []) as WatchItem[]);
  }

  async function loadSavedProfiles() {
    if (!userId) return;
    setProfilesLoading(true);
    setProfilesError("");
    try {
      const response = await fetch("/api/profiles/saved");
      if (!response.ok) {
        throw new Error("Failed to load saved profiles");
      }
      const data = await response.json();
      setSavedProfiles(data.profiles || []);
    } catch (error) {
      setProfilesError(error instanceof Error ? error.message : "Failed to load saved profiles");
    } finally {
      setProfilesLoading(false);
    }
  }

  useEffect(() => {
    setItems([]);
    setStatus("");
    if (userId) {
      load();
      if (activeTab === "saved-profiles") {
        loadSavedProfiles();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeTab]);

  async function add() {
    if (!userId) { setStatus("Please sign in first."); return; }
    setStatus("adding…");
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.rpc("add_watchlist_item", {
      p_owner: userId,
      p_kind: "attendee",
      p_label: label || "Keynote speakers",
      p_ref_id: "00000000-0000-0000-0000-000000000000",
    });
    if (error) setStatus(`Insert error: ${error.message}`);
    else { setLabel(""); setStatus("added"); await load(); }
  }

  if (!authReady) {
    return <div className="flex items-center justify-center py-12"><p>Loading…</p></div>;
  }

  if (!userId) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-4">Sign in required</h2>
        <p><Link href="/login" className="text-blue-600 hover:text-blue-700">Go to sign in</Link> to manage your watchlist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{
            fontSize: "2.5rem",
            fontWeight: "700",
            color: "var(--foreground)",
            marginBottom: "0.5rem"
          }}>
            My Watchlist
          </h1>
          <p style={{
            fontSize: "1.125rem",
            color: "var(--muted-foreground)"
          }}>
            Keep track of events and people you're interested in
          </p>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: "flex", 
          gap: "0.5rem", 
          marginBottom: "2rem",
          borderBottom: "1px solid var(--border)"
        }}>
          <button
            onClick={() => setActiveTab("watchlist")}
            style={{
              padding: "0.75rem 1.5rem",
              border: "none",
              background: "none",
              color: activeTab === "watchlist" ? "var(--primary)" : "var(--muted-foreground)",
              borderBottom: activeTab === "watchlist" ? "2px solid var(--primary)" : "2px solid transparent",
              cursor: "pointer",
              fontWeight: "500",
              transition: "all 0.2s ease"
            }}
          >
            Watchlist ({items.length})
          </button>
          <button
            onClick={() => setActiveTab("saved-profiles")}
            style={{
              padding: "0.75rem 1.5rem",
              border: "none",
              background: "none",
              color: activeTab === "saved-profiles" ? "var(--primary)" : "var(--muted-foreground)",
              borderBottom: activeTab === "saved-profiles" ? "2px solid var(--primary)" : "2px solid transparent",
              cursor: "pointer",
              fontWeight: "500",
              transition: "all 0.2s ease"
            }}
          >
            Saved Profiles ({savedProfiles.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "watchlist" && (
          <>
            {/* Add Item Form */}
            <div className="card" style={{ marginBottom: "2rem" }}>
              <h2 style={{
                fontSize: "1.25rem",
                fontWeight: "600",
                marginBottom: "1rem",
                color: "var(--foreground)"
              }}>
                Add to Watchlist
              </h2>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    marginBottom: "0.5rem",
                    color: "var(--foreground)"
                  }}>
                    What are you interested in?
                  </label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., AI conferences, keynote speakers, networking events"
                    className="input"
                  />
                </div>
                <button 
                  onClick={add} 
                  className="btn btn-primary"
                  style={{ height: "fit-content" }}
                >
                  Add Item
                </button>
              </div>
              {status && (
                <p style={{ 
                  marginTop: "1rem", 
                  color: status.includes("Error") ? "#dc2626" : "var(--muted-foreground)",
                  fontSize: "0.875rem"
                }}>
                  {status}
                </p>
              )}
            </div>

            {/* Watchlist Items */}
            <div>
              <h2 style={{
                fontSize: "1.5rem",
                fontWeight: "600",
                marginBottom: "1rem",
                color: "var(--foreground)"
              }}>
                Your Items ({items.length})
              </h2>
              
              {items.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📝</div>
                  <h3 style={{
                    fontSize: "1.25rem",
                    fontWeight: "600",
                    marginBottom: "0.5rem",
                    color: "var(--foreground)"
                  }}>
                    No items yet
                  </h3>
                  <p style={{ color: "var(--muted-foreground)" }}>
                    Add your first item above to start building your watchlist
                  </p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "1rem" }}>
                  {items.map((i) => (
                    <div key={i.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{
                            fontSize: "1.125rem",
                            fontWeight: "600",
                            marginBottom: "0.5rem",
                            color: "var(--foreground)"
                          }}>
                            {i.label || "(no label)"}
                          </h3>
                          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                            <span style={{
                              fontSize: "0.875rem",
                              color: "var(--muted-foreground)",
                              background: "var(--secondary)",
                              padding: "0.25rem 0.75rem",
                              borderRadius: "var(--radius)",
                              fontWeight: "500"
                            }}>
                              {i.kind}
                            </span>
                            <span style={{
                              fontSize: "0.875rem",
                              color: "var(--muted-foreground)"
                            }}>
                              Added {new Date(i.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <button 
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--muted-foreground)",
                            cursor: "pointer",
                            padding: "0.5rem",
                            borderRadius: "var(--radius)",
                            transition: "all 0.2s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--muted)";
                            e.currentTarget.style.color = "var(--foreground)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "none";
                            e.currentTarget.style.color = "var(--muted-foreground)";
                          }}
                        >
                          ⋯
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "saved-profiles" && (
          <div>
            <h2 style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              marginBottom: "1rem",
              color: "var(--foreground)"
            }}>
              Saved Speaker Profiles ({savedProfiles.length})
            </h2>
            
            {profilesLoading ? (
              <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
                <p style={{ color: "var(--muted-foreground)" }}>Loading saved profiles...</p>
              </div>
            ) : profilesError ? (
              <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠️</div>
                <p style={{ color: "#dc2626" }}>Error: {profilesError}</p>
                <button 
                  onClick={loadSavedProfiles}
                  className="btn btn-primary"
                  style={{ marginTop: "1rem" }}
                >
                  Try Again
                </button>
              </div>
            ) : savedProfiles.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👤</div>
                <h3 style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  marginBottom: "0.5rem",
                  color: "var(--foreground)"
                }}>
                  No saved profiles yet
                </h3>
                <p style={{ color: "var(--muted-foreground)" }}>
                  Save speaker profiles from event pages to see them here
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "1rem" }}>
                {savedProfiles.map((profile) => (
                  <div key={profile.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{
                          fontSize: "1.125rem",
                          fontWeight: "600",
                          marginBottom: "0.5rem",
                          color: "var(--foreground)"
                        }}>
                          {profile.speaker_data?.name || "Unknown Speaker"}
                        </h3>
                        <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "0.5rem" }}>
                          {profile.speaker_data?.title && (
                            <span style={{
                              fontSize: "0.875rem",
                              color: "var(--muted-foreground)",
                              background: "var(--secondary)",
                              padding: "0.25rem 0.75rem",
                              borderRadius: "var(--radius)",
                              fontWeight: "500"
                            }}>
                              {profile.speaker_data.title}
                            </span>
                          )}
                          {profile.speaker_data?.org && (
                            <span style={{
                              fontSize: "0.875rem",
                              color: "var(--muted-foreground)"
                            }}>
                              {profile.speaker_data.org}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                          <span style={{
                            fontSize: "0.875rem",
                            background: profile.outreach_status === "not_started" ? "var(--secondary)" : 
                                       profile.outreach_status === "contacted" ? "#fef3c7" :
                                       profile.outreach_status === "responded" ? "#d1fae5" : "#dbeafe",
                            color: profile.outreach_status === "not_started" ? "var(--muted-foreground)" :
                                   profile.outreach_status === "contacted" ? "#92400e" :
                                   profile.outreach_status === "responded" ? "#065f46" : "#1e40af",
                            padding: "0.25rem 0.75rem",
                            borderRadius: "var(--radius)",
                            fontWeight: "500"
                          }}>
                            {profile.outreach_status.replace("_", " ")}
                          </span>
                          <span style={{
                            fontSize: "0.875rem",
                            color: "var(--muted-foreground)"
                          }}>
                            Saved {new Date(profile.saved_at).toLocaleDateString()}
                          </span>
                        </div>
                        {profile.notes && (
                          <p style={{
                            fontSize: "0.875rem",
                            color: "var(--muted-foreground)",
                            marginTop: "0.5rem",
                            fontStyle: "italic"
                          }}>
                            {profile.notes}
                          </p>
                        )}
                      </div>
                      <button 
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--muted-foreground)",
                          cursor: "pointer",
                          padding: "0.5rem",
                          borderRadius: "var(--radius)",
                          transition: "all 0.2s ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--muted)";
                          e.currentTarget.style.color = "var(--foreground)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "none";
                          e.currentTarget.style.color = "var(--muted-foreground)";
                        }}
                      >
                        ⋯
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}