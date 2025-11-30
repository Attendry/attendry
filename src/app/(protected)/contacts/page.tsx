"use client";

import { useState, useEffect, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { SavedSpeakerProfile } from "@/lib/types/database";
import { useSavedProfiles } from "@/lib/hooks/useSavedProfiles";
import { toast } from "sonner";
import { Loader2, Archive, History, Plus, Zap, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { ContactCard } from "@/components/contacts/ContactCard";
import { ContactModal } from "@/components/contacts/ContactModal";
import { EmptyState } from "@/components/States/EmptyState";

type TabType = "focus" | "history";

export default function ContactsPage() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("focus");
  const [selectedContact, setSelectedContact] = useState<SavedSpeakerProfile | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [filter, setFilter] = useState<'all' | 'auto-saved-today'>('all');
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

  // Filter contacts by archive status and auto-saved filter
  const activeContacts = useMemo(() => {
    let filtered = contactsWithResearch.filter((p) => !p.archived);
    
    if (filter === 'auto-saved-today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter((p) => {
        // Check if contact has auto_saved_at field (from database) or metadata
        const autoSavedAt = (p as any).auto_saved_at;
        if (!autoSavedAt) return false;
        const savedDate = new Date(autoSavedAt);
        savedDate.setHours(0, 0, 0, 0);
        return savedDate.getTime() === today.getTime() && !(p as any).undo_requested_at;
      });
    }
    
    return filtered;
  }, [contactsWithResearch, filter]);

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

  // Handle adding a new contact
  const handleAddContact = async (formData: {
    name: string;
    company: string;
    title?: string;
    email?: string;
    linkedin?: string;
  }) => {
    setIsAddingContact(true);
    try {
      const response = await fetch("/api/profiles/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker_data: {
            name: formData.name,
            org: formData.company,
            organization: formData.company,
            title: formData.title || null,
            email: formData.email || null,
            linkedin: formData.linkedin || null,
          },
          enhanced_data: {
            name: formData.name,
            organization: formData.company,
            title: formData.title || null,
            email: formData.email || null,
            linkedin_url: formData.linkedin || null,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to add contact");
      }

      await refreshProfiles();
      setShowAddContactModal(false);
      toast.success("Contact added", {
        description: `${formData.name} has been added and research is in progress.`,
      });
    } catch (error: any) {
      toast.error("Failed to add contact", {
        description: error.message || "An error occurred. Please try again.",
      });
    } finally {
      setIsAddingContact(false);
    }
  };

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
              if (contact.archived) {
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
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Contacts</h1>
              <p className="mt-2 text-slate-600">
                Manage your outreach contacts with AI-powered research and monitoring.
              </p>
            </div>
            {/* Daily Briefing - Prominent */}
            {activeTab === "focus" && (
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={handleRunDailyBriefing}
                  disabled={isBriefingLoading}
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-blue-600 bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
                >
                  {isBriefingLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Daily Briefing
                    </>
                  )}
                </button>
                <p className="text-xs text-slate-500 text-right max-w-[140px]">
                  Check for new updates on monitored contacts
                </p>
              </div>
            )}
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("focus")}
                  className={`pb-4 px-2 text-sm font-medium transition-all relative ${
              activeTab === "focus"
                ? "text-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Focus ({activeContacts.length})
            {activeTab === "focus" && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-4 px-2 text-sm font-medium transition-all relative ${
              activeTab === "history"
                ? "text-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            History & Archives ({archivedContacts.length})
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
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
                  Manage your key contacts for outreach and relationship building.
                </p>
              </div>
              <button
                onClick={() => setShowAddContactModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Contact ({activeContacts.length})
              </button>
            </div>

            {profilesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : activeContacts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <EmptyState
                  icon={<Archive className="h-12 w-12" />}
                  title="Focus list is empty"
                  description="Add contacts from saved profiles to start researching and drafting."
                  action={{
                    label: "Add Contact",
                    onClick: () => setShowAddContactModal(true)
                  }}
                />
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

        {/* Add Contact Modal */}
        {showAddContactModal && (
          <AddContactModal
            onClose={() => setShowAddContactModal(false)}
            onAdd={handleAddContact}
            isAdding={isAddingContact}
          />
        )}
      </div>
    </div>
  );
}

// Add Contact Modal Component
interface AddContactModalProps {
  onClose: () => void;
  onAdd: (data: {
    name: string;
    company: string;
    title?: string;
    email?: string;
    linkedin?: string;
  }) => Promise<void>;
  isAdding: boolean;
}

function AddContactModal({ onClose, onAdd, isAdding }: AddContactModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    title: "",
    email: "",
    linkedin: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.company.trim()) {
      toast.error("Name and company are required");
      return;
    }
    await onAdd(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Add New Contact</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            disabled={isAdding}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="John Doe"
              disabled={isAdding}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Company <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="Acme Corp"
              disabled={isAdding}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="VP of Sales"
              disabled={isAdding}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="john@acme.com"
              disabled={isAdding}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              LinkedIn URL
            </label>
            <input
              type="url"
              value={formData.linkedin}
              onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="https://linkedin.com/in/johndoe"
              disabled={isAdding}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isAdding}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding || !formData.name.trim() || !formData.company.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Contact
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

