"use client";

import React, { useState } from 'react';
import { Edit, Trash2, ExternalLink, MapPin, Calendar, Star, MessageSquare } from 'lucide-react';
import { SavedSpeakerProfile } from '@/lib/types/database';

interface EnhancedSavedProfileCardProps {
  profile: SavedSpeakerProfile;
  onEdit: (profile: SavedSpeakerProfile) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onNotesChange: (id: string, notes: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

export function EnhancedSavedProfileCard({ 
  profile, 
  onEdit, 
  onDelete, 
  onStatusChange, 
  onNotesChange,
  showActions = true,
  compact = false 
}: EnhancedSavedProfileCardProps) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editingNotes, setEditingNotes] = useState(profile.notes || '');
  const [isEditingStatus, setIsEditingStatus] = useState(false);

  const enhancedData = profile.enhanced_data;
  const speakerData = profile.speaker_data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started': return 'bg-slate-100 text-slate-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'responded': return 'bg-green-100 text-green-800';
      case 'meeting_scheduled': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleNotesSave = () => {
    onNotesChange(profile.id, editingNotes);
    setIsEditingNotes(false);
  };

  const handleNotesCancel = () => {
    setEditingNotes(profile.notes || '');
    setIsEditingNotes(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (compact) {
    return (
      <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-slate-900 mb-1">
              {speakerData.name}
            </h3>
            <p className="text-slate-700 font-medium text-sm">
              {enhancedData?.title || speakerData.title || "Title not available"}
            </p>
            <p className="text-slate-600 text-sm">
              {enhancedData?.organization || speakerData.org || "Organization not available"}
            </p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(profile.outreach_status)}`}>
            {getStatusLabel(profile.outreach_status)}
          </span>
        </div>

        {/* Quick Facts */}
        {enhancedData?.expertise_areas && enhancedData.expertise_areas.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {enhancedData.expertise_areas.slice(0, 3).map((area: string, idx: number) => (
                <span key={idx} className="text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 px-2 py-1">
                  {area}
                </span>
              ))}
              {enhancedData.expertise_areas.length > 3 && (
                <span className="text-xs text-slate-500">+{enhancedData.expertise_areas.length - 3} more</span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(profile)}
              className="text-xs px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
            >
              Edit
            </button>
            <select
              value={profile.outreach_status}
              onChange={(e) => onStatusChange(profile.id, e.target.value)}
              className="text-xs px-2 py-1 border border-slate-300 rounded"
            >
              <option value="not_started">Not Started</option>
              <option value="contacted">Contacted</option>
              <option value="responded">Responded</option>
              <option value="meeting_scheduled">Meeting Scheduled</option>
            </select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-xl text-slate-900 mb-2">
            {speakerData.name}
          </h3>
          <div className="space-y-1">
            <p className="text-slate-700 font-medium">
              {enhancedData?.title || speakerData.title || "Title not available"}
            </p>
            <p className="text-slate-600 text-sm">
              {enhancedData?.organization || speakerData.org || "Organization not available"}
            </p>
            {enhancedData?.location && (
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <MapPin className="w-3 h-3" />
                {enhancedData.location}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(profile.outreach_status)}`}>
            {getStatusLabel(profile.outreach_status)}
          </span>
          {showActions && (
            <div className="flex gap-1">
              <button
                onClick={() => onEdit(profile)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit profile"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(profile.id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete profile"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Information */}
      {enhancedData?.bio && (
        <div className="mb-4">
          <p className="text-sm text-slate-800 line-clamp-3">
            {enhancedData.bio}
          </p>
        </div>
      )}

      {/* Expertise Areas */}
      {enhancedData?.expertise_areas && enhancedData.expertise_areas.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-900 mb-2">Expertise Areas</h4>
          <div className="flex flex-wrap gap-2">
            {enhancedData.expertise_areas.map((area: string, idx: number) => (
              <span key={idx} className="text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 px-2 py-1">
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Speaking History */}
      {enhancedData?.speaking_history && enhancedData.speaking_history.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-900 mb-2">Recent Speaking</h4>
          <div className="space-y-1">
            {enhancedData.speaking_history.slice(0, 2).map((event: string, idx: number) => (
              <p key={idx} className="text-xs text-slate-700">
                • {event}
              </p>
            ))}
            {enhancedData.speaking_history.length > 2 && (
              <p className="text-xs text-slate-500">
                +{enhancedData.speaking_history.length - 2} more events
              </p>
            )}
          </div>
        </div>
      )}

      {/* Social Links */}
      {enhancedData?.social_links && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-900 mb-2">Contact</h4>
          <div className="flex gap-3">
            {enhancedData.social_links.linkedin && (
              <a 
                href={enhancedData.social_links.linkedin} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                LinkedIn
              </a>
            )}
            {enhancedData.social_links.twitter && (
              <a 
                href={`https://twitter.com/${enhancedData.social_links.twitter}`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Twitter
              </a>
            )}
            {enhancedData.social_links.website && (
              <a 
                href={enhancedData.social_links.website} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Website
              </a>
            )}
          </div>
        </div>
      )}

      {/* Notes Section */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-slate-500" />
          <h4 className="text-sm font-medium text-slate-900">Notes</h4>
        </div>
        {isEditingNotes ? (
          <div className="space-y-2">
            <textarea
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add notes about this contact..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleNotesSave}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleNotesCancel}
                className="px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <p className="text-sm text-slate-700 flex-1">
              {profile.notes || "No notes added yet."}
            </p>
            {showActions && (
              <button
                onClick={() => setIsEditingNotes(true)}
                className="ml-2 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Edit notes"
              >
                <Edit className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status and Actions */}
      {showActions && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Status:</span>
            {isEditingStatus ? (
              <select
                value={profile.outreach_status}
                onChange={(e) => {
                  onStatusChange(profile.id, e.target.value);
                  setIsEditingStatus(false);
                }}
                className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              >
                <option value="not_started">Not Started</option>
                <option value="contacted">Contacted</option>
                <option value="responded">Responded</option>
                <option value="meeting_scheduled">Meeting Scheduled</option>
              </select>
            ) : (
              <button
                onClick={() => setIsEditingStatus(true)}
                className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(profile.outreach_status)} hover:opacity-80 transition-opacity`}
              >
                {getStatusLabel(profile.outreach_status)}
              </button>
            )}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Saved {formatDate(profile.saved_at)}
          </div>
        </div>
      )}
    </div>
  );
}
