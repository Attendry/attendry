"use client";

import { useState, useEffect, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { SavedSpeakerProfile } from "@/lib/types/database";
import { useSavedProfiles } from "@/lib/hooks/useSavedProfiles";
import { toast } from "sonner";
import { Loader2, Archive, History, Plus, Zap, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ContactCard } from "@/components/contacts/ContactCard";
import { ContactModal } from "@/components/contacts/ContactModal";

const MAX_FOCUS_CONTACTS = 4;

type TabType = "focus" | "history";

export default function ContactsPage() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("focus");
  const [selectedContact, setSelectedContact] = useState<SavedSpeakerProfile | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [contactsWithResearch, setContactsWithResearch] = useState<
    Array<SavedSpeakerProfile & { contact_research?: any }>
  >([]);

  const {
    profiles,
    loading: profilesLoading,
    error: profilesError,
    refresh: refreshProfiles,
  } = useSavedProfiles({ enabled: authReady && !!userId });

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

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Load research data for contacts
  useEffect(() => {
    if (!userId || profiles.length === 0) return;

    const loadResearch = async () => {
      const supabase = supabaseBrowser();
      const contactIds = profiles.map((p) => p.id);

      const { data: researchData } = await supabase
        .from("contact_research")
        .select("*")
        .in("contact_id", contactIds);

      const researchMap = new Map(
        (researchData || []).map((r) => [r.contact_id, r])
      );

      setContactsWithResearch(
        profiles.map((p) => ({
          ...p,
          contact_research: researchMap.get(p.id) || null,
        }))
      );
    };

    loadResearch();
  }, [userId, profiles]);

  // Filter contacts by archive status
  const activeContacts = useMemo(() => {
    return contactsWithResearch.filter((p) => !p.archived);
  }, [contactsWithResearch]);

  const archivedContacts = useMemo(() => {
    return contactsWithResearch
      .filter((p) => p.archived)
      .sort((a, b) => {
        const dateA = new Date(a.saved_at || a.last_updated).getTime();
        const dateB = new Date(b.saved_at || b.last_updated).getTime();
        return dateB - dateA;
      });
  }, [contactsWithResearch]);

  // Group archived contacts by week
  const groupedHistory = useMemo(() => {
    const groups: Record<string, SavedSpeakerProfile[]> = {};
    
    archivedContacts.forEach((contact) => {
      const date = new Date(contact.saved_at || contact.last_updated);
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      const dateString = startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const key = `Week of ${dateString}`;
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(contact);
    });
    
    return groups;
  }, [archivedContacts]);

  // Count monitored contacts
  const totalMonitoringCount = useMemo(() => {
    return profiles.filter((p) => p.monitor_updates).length;
  }, [profiles]);

  // Daily Briefing - check for updates on monitored contacts
  const handleRunDailyBriefing = async () => {
    if (!userId) return;
    
    setIsBriefingLoading(true);
    let updatesFound = 0;
    let movedToFocus = 0;

    try {
      const monitoredContacts = profiles.filter((p) => p.monitor_updates && !p.archived);
      
      for (const contact of monitoredContacts) {
        try {
          const response = await fetch(`/api/contacts/${contact.id}/research`, {
            method: 'PUT',
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.hasUpdates) {
              updatesFound++;
              
              // If archived contact has new intel, move back to focus
              if (contact.archived && activeContacts.length < MAX_FOCUS_CONTACTS) {
                // Update contact to unarchive
                const supabase = supabaseBrowser();
                await supabase
                  .from('saved_speaker_profiles')
                  .update({ archived: false })
                  .eq('id', contact.id);
                movedToFocus++;
              }
            }
          }
        } catch (e) {
          console.error(`Failed to check updates for ${contact.id}`, e);
        }
      }

      await refreshProfiles();

      if (updatesFound > 0) {
        const moveMsg = movedToFocus > 0 ? ` and moved ${movedToFocus} back to Focus` : '';
        toast.success(`Daily Briefing Complete`, {
          description: `Found new updates for ${updatesFound} contact(s)${moveMsg}!`,
        });
      } else {
        toast.info("Daily Briefing Complete", {
          description: "No significant new updates found.",
        });
      }
    } catch (error: any) {
      toast.error("Daily Briefing failed", {
        description: error.message || "An error occurred while checking for updates.",
      });
    } finally {
      setIsBriefingLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <h2 className="text-2xl font-semibold mb-4">Sign in required</h2>
            <p className="text-slate-600 mb-4">
              Please sign in to manage your contacts.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Contacts</h1>
          <p className="mt-2 text-slate-600">
            Manage your outreach contacts with AI-powered research and monitoring.
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("focus")}
            className={`pb-4 px-2 text-sm font-medium transition-all relative ${
              activeTab === "focus"
                ? "text-indigo-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Focus ({activeContacts.length}/{MAX_FOCUS_CONTACTS})
            {activeTab === "focus" && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-4 px-2 text-sm font-medium transition-all relative ${
              activeTab === "history"
                ? "text-indigo-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            History & Archives ({archivedContacts.length})
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
            )}
          </button>
        </div>

        {/* Focus Tab */}
        {activeTab === "focus" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Active Contacts</h2>
                <p className="text-sm text-slate-500">
                  Manage your {MAX_FOCUS_CONTACTS} key contacts for this week.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {totalMonitoringCount > 0 && (
                  <button
                    onClick={handleRunDailyBriefing}
                    disabled={isBriefingLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {isBriefingLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {isBriefingLoading ? "Scanning..." : "Daily Briefing"}
                  </button>
                )}
                <Link
                  href="/saved-profiles"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Contact ({activeContacts.length}/{MAX_FOCUS_CONTACTS})
                </Link>
              </div>
            </div>

            {profilesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : activeContacts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <Archive className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  Focus list is empty
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Add contacts from saved profiles to start researching and drafting.
                </p>
                <Link
                  href="/saved-profiles"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Contacts
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {activeContacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    onClick={setSelectedContact}
                    onArchive={async (c) => {
                      const supabase = supabaseBrowser();
                      await supabase
                        .from("saved_speaker_profiles")
                        .update({ archived: true, monitor_updates: false })
                        .eq("id", c.id);
                      await refreshProfiles();
                      toast.success("Contact archived");
                    }}
                    onDelete={async (id) => {
                      const supabase = supabaseBrowser();
                      await supabase
                        .from("saved_speaker_profiles")
                        .delete()
                        .eq("id", id);
                      await refreshProfiles();
                      toast.success("Contact deleted");
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Outreach History</h2>
              <p className="text-sm text-slate-500">
                Overview of past weeks and archived contacts.
              </p>
            </div>

            {Object.keys(groupedHistory).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <History className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-slate-600">No archived contacts yet.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedHistory).map(([week, weekContacts]) => (
                  <div key={week}>
                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                      {week}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {weekContacts.map((contact) => (
                        <ContactCard
                          key={contact.id}
                          contact={contact}
                          onClick={setSelectedContact}
                          onRestore={async (c) => {
                            if (activeContacts.length >= MAX_FOCUS_CONTACTS) {
                              toast.error("Focus list is full", {
                                description: "Archive a contact first to restore this one.",
                              });
                              return;
                            }
                            const supabase = supabaseBrowser();
                            await supabase
                              .from("saved_speaker_profiles")
                              .update({ archived: false, monitor_updates: true })
                              .eq("id", c.id);
                            await refreshProfiles();
                            toast.success("Contact restored to Focus");
                          }}
                          onDelete={async (id) => {
                            const supabase = supabaseBrowser();
                            await supabase
                              .from("saved_speaker_profiles")
                              .delete()
                              .eq("id", id);
                            await refreshProfiles();
                            toast.success("Contact deleted");
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contact Modal */}
        {selectedContact && (
          <ContactModal
            contact={
              contactsWithResearch.find((c) => c.id === selectedContact.id) ||
              selectedContact
            }
            onClose={() => setSelectedContact(null)}
            onUpdate={async (updated) => {
              await refreshProfiles();
              setSelectedContact(updated);
            }}
          />
        )}
      </div>
    </div>
  );
}

