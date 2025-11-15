"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { SavedSpeakerProfile } from "@/lib/types/database";
import { EnhancedSavedProfileCard } from "@/components/EnhancedSavedProfileCard";
import { toast } from "sonner";

type WatchItem = { 
  id: string; 
  label: string | null; 
  kind: "company" | "attendee"; 
  created_at: string; 
  owner?: string;
  company_type?: string;
  metadata?: any;
};

type TabType = "watchlist" | "saved-profiles";

export default function Watchlist() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("watchlist");
  
  // Watchlist state
  const [items, setItems] = useState<WatchItem[]>([]);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("");
  const [newItemKind, setNewItemKind] = useState<"attendee" | "company">("attendee");
  const [newCompanyType, setNewCompanyType] = useState<string>("general");
  
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

  async function updateProfileStatus(profileId: string, status: string) {
    try {
      const response = await fetch(`/api/profiles/saved/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreach_status: status })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }
      
      await loadSavedProfiles();
      toast.success("Status updated", {
        description: "Outreach status has been updated"
      });
    } catch (e: any) {
      toast.error("Failed to update status", {
        description: e.message || "An error occurred. Please try again."
      });
    }
  }

  async function updateProfileNotes(profileId: string, notes: string) {
    try {
      const response = await fetch(`/api/profiles/saved/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update notes");
      }
      
      await loadSavedProfiles();
      toast.success("Notes updated", {
        description: "Profile notes have been saved"
      });
    } catch (e: any) {
      toast.error("Failed to update notes", {
        description: e.message || "An error occurred. Please try again."
      });
    }
  }

  async function deleteProfile(profileId: string) {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    
    try {
      const response = await fetch(`/api/profiles/saved/${profileId}`, {
        method: "DELETE"
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete profile");
      }
      
      await loadSavedProfiles();
      toast.success("Profile deleted", {
        description: "Speaker profile has been removed"
      });
    } catch (e: any) {
      toast.error("Failed to delete profile", {
        description: e.message || "An error occurred. Please try again."
      });
    }
  }

  function openEditModal(profile: SavedSpeakerProfile) {
    // For now, show a toast. In a full implementation,
    // this would open a modal with detailed editing capabilities
    toast.info("Edit feature coming soon", {
      description: `Edit functionality for ${profile.speaker_data.name} will be available in a future update.`
    });
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
    if (!label.trim()) { setStatus("Please enter a label."); return; }
    
    setStatus("adding…");
    const supabase = supabaseBrowser();
    
    const { data, error } = await supabase.rpc("add_watchlist_item", {
      p_kind: newItemKind,
      p_label: label.trim(),
      p_ref_id: label.trim().toLowerCase().replace(/\s+/g, '-'),
      p_company_type: newItemKind === "company" ? newCompanyType : "general",
      p_metadata: newItemKind === "company" ? { added_via: "manual" } : {}
    });
    
    if (error) setStatus(`Insert error: ${error.message}`);
    else { 
      setLabel(""); 
      setStatus("added"); 
      await load(); 
    }
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
                    placeholder={newItemKind === "company" ? "e.g., Microsoft, Google, Salesforce" : "e.g., AI conferences, keynote speakers, networking events"}
                    className="input"
                  />
                </div>
                <div>
                  <label style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    marginBottom: "0.5rem",
                    color: "var(--foreground)"
                  }}>
                    Type
                  </label>
                  <select
                    value={newItemKind}
                    onChange={(e) => setNewItemKind(e.target.value as "attendee" | "company")}
                    className="input"
                    style={{ minWidth: "120px" }}
                  >
                    <option value="attendee">Person</option>
                    <option value="company">Company</option>
                  </select>
                </div>
                {newItemKind === "company" && (
                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      marginBottom: "0.5rem",
                      color: "var(--foreground)"
                    }}>
                      Company Type
                    </label>
                    <select
                      value={newCompanyType}
                      onChange={(e) => setNewCompanyType(e.target.value)}
                      className="input"
                      style={{ minWidth: "120px" }}
                    >
                      <option value="general">General</option>
                      <option value="competitor">Competitor</option>
                      <option value="partner">Partner</option>
                      <option value="customer">Customer</option>
                      <option value="prospect">Prospect</option>
                    </select>
                  </div>
                )}
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
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <h3 style={{
                              fontSize: "1.125rem",
                              fontWeight: "600",
                              color: "var(--foreground)",
                              margin: 0
                            }}>
                              {i.label || "(no label)"}
                            </h3>
                            <span style={{
                              fontSize: "0.75rem",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.375rem",
                              backgroundColor: i.kind === "company" ? "#dbeafe" : "#f3f4f6",
                              color: i.kind === "company" ? "#1e40af" : "#374151",
                              fontWeight: "500"
                            }}>
                              {i.kind === "company" ? "Company" : "Person"}
                            </span>
                            {i.kind === "company" && i.company_type && i.company_type !== "general" && (
                              <span style={{
                                fontSize: "0.75rem",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.375rem",
                                backgroundColor: "#fef3c7",
                                color: "#92400e",
                                fontWeight: "500"
                              }}>
                                {i.company_type}
                              </span>
                            )}
                          </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedProfiles.map((profile) => (
                  <EnhancedSavedProfileCard
                    key={profile.id}
                    profile={profile}
                    onEdit={openEditModal}
                    onDelete={deleteProfile}
                    onStatusChange={updateProfileStatus}
                    onNotesChange={updateProfileNotes}
                    showActions={true}
                    compact={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}