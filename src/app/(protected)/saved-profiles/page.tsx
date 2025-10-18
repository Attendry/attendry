"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { SavedSpeakerProfile } from "@/lib/types/database";
import { EnhancedSavedProfileCard } from "@/components/EnhancedSavedProfileCard";

export default function SavedProfilesPage() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<SavedSpeakerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  
  // Modal states
  const [selectedProfile, setSelectedProfile] = useState<SavedSpeakerProfile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [editingStatus, setEditingStatus] = useState<string>("not_started");

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

  useEffect(() => {
    if (userId) {
      loadProfiles();
    } else {
      setProfiles([]);
      setLoading(false);
    }
  }, [userId, statusFilter, tagFilter, searchTerm]);

  async function loadProfiles() {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (tagFilter !== "all") params.append("tag", tagFilter);
      if (searchTerm) params.append("search", searchTerm);
      
      const response = await fetch(`/api/profiles/saved?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to load profiles");
      }
      
      setProfiles(data.profiles || []);
    } catch (e: any) {
      setError(e.message || "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }

  async function deleteProfile(id: string) {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    
    try {
      const response = await fetch(`/api/profiles/saved/${id}`, {
        method: "DELETE"
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete profile");
      }
      
      await loadProfiles();
    } catch (e: any) {
      alert(e.message || "Failed to delete profile");
    }
  }

  async function updateProfile() {
    if (!selectedProfile) return;
    
    try {
      const response = await fetch(`/api/profiles/saved/${selectedProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: editingNotes,
          tags: editingTags,
          outreach_status: editingStatus
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update profile");
      }
      
      setShowModal(false);
      await loadProfiles();
    } catch (e: any) {
      alert(e.message || "Failed to update profile");
    }
  }

  function openEditModal(profile: SavedSpeakerProfile) {
    setSelectedProfile(profile);
    setEditingNotes(profile.notes || "");
    setEditingTags(profile.tags || []);
    setEditingStatus(profile.outreach_status);
    setShowModal(true);
  }

  function addTag(tag: string) {
    if (tag && !editingTags.includes(tag)) {
      setEditingTags([...editingTags, tag]);
    }
  }

  function removeTag(tag: string) {
    setEditingTags(editingTags.filter(t => t !== tag));
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
      
      await loadProfiles();
    } catch (e: any) {
      alert(e.message || "Failed to update status");
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
      
      await loadProfiles();
    } catch (e: any) {
      alert(e.message || "Failed to update notes");
    }
  }

  function exportProfiles() {
    const exportData = profiles.map(profile => ({
      name: profile.speaker_data.name,
      title: profile.enhanced_data.title || profile.speaker_data.title,
      organization: profile.enhanced_data.organization || profile.speaker_data.org,
      email: profile.speaker_data.email,
      linkedin: profile.enhanced_data.social_links?.linkedin || profile.speaker_data.linkedin_url,
      notes: profile.notes,
      tags: profile.tags,
      outreach_status: profile.outreach_status,
      saved_at: profile.saved_at
    }));
    
    const csv = [
      Object.keys(exportData[0]).join(","),
      ...exportData.map(row => Object.values(row).map(val => `"${val || ""}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "saved-speaker-profiles.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authReady) {
    return <div className="flex items-center justify-center py-12"><p>Loading…</p></div>;
  }

  if (!userId) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Saved Speaker Profiles</h1>
        <p className="text-slate-600">Please sign in to view your saved profiles.</p>
      </div>
    );
  }

  const allTags = Array.from(new Set(profiles.flatMap(p => p.tags || [])));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Saved Speaker Profiles</h1>
          <p className="text-slate-600 mt-2">Manage your saved profiles for outreach and relationship building</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportProfiles}
            disabled={profiles.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, title, or organization..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="not_started">Not Started</option>
              <option value="contacted">Contacted</option>
              <option value="responded">Responded</option>
              <option value="meeting_scheduled">Meeting Scheduled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tag</label>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadProfiles}
              className="w-full px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <p>Loading profiles...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600">Error: {error}</p>
          <button
            onClick={loadProfiles}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-600">No saved profiles found.</p>
          <p className="text-slate-500 text-sm mt-2">Save profiles from speaker cards to see them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => (
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

      {/* Edit Modal */}
      {showModal && selectedProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-900">Edit Profile</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">{selectedProfile.speaker_data.name}</h3>
                  <p className="text-slate-600">
                    {selectedProfile.enhanced_data.title || selectedProfile.speaker_data.title} at {selectedProfile.enhanced_data.organization || selectedProfile.speaker_data.org}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Outreach Status</label>
                  <select
                    value={editingStatus}
                    onChange={(e) => setEditingStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="contacted">Contacted</option>
                    <option value="responded">Responded</option>
                    <option value="meeting_scheduled">Meeting Scheduled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                  <textarea
                    value={editingNotes}
                    onChange={(e) => setEditingNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add notes about this contact..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editingTags.map((tag, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Add a tag and press Enter"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        addTag(input.value.trim());
                        input.value = '';
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={updateProfile}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-300 text-slate-700 rounded-md hover:bg-slate-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
