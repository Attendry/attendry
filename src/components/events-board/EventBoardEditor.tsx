"use client";

import React, { useState, useEffect } from "react";
import { BoardItemWithEvent, ColumnStatus } from "@/lib/types/event-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Tag, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EventBoardEditorProps {
  item: BoardItemWithEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemId: string, updates: { notes?: string; tags?: string[]; columnStatus?: ColumnStatus }) => Promise<void>;
}

export function EventBoardEditor({
  item,
  isOpen,
  onClose,
  onSave,
}: EventBoardEditorProps) {
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [status, setStatus] = useState<ColumnStatus>("interested");
  const [saving, setSaving] = useState(false);

  // Initialize form when item changes
  useEffect(() => {
    if (item) {
      setNotes(item.notes || "");
      setTags(item.tags || []);
      setStatus(item.column_status);
    }
  }, [item]);

  // Reset form when panel closes
  useEffect(() => {
    if (!isOpen) {
      setNotes("");
      setTags([]);
      setNewTag("");
      setStatus("interested");
    }
  }, [isOpen]);

  // Handle escape key to close panel
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!item) return;

    setSaving(true);
    try {
      await onSave(item.id, {
        notes: notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        columnStatus: status,
      });
      toast.success("Event updated", {
        description: "Changes have been saved"
      });
      onClose();
    } catch (error: any) {
      toast.error("Failed to update", {
        description: error.message || "An error occurred. Please try again."
      });
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  const event = item.event;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Side Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-slate-900",
          "border-l border-slate-200 dark:border-slate-700 shadow-xl z-50",
          "transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white truncate">
                Edit Event
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
                {event?.title || "Untitled Event"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Status
              </label>
              <Select value={status} onValueChange={(value) => setStatus(value as ColumnStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="researching">Researching</SelectItem>
                  <SelectItem value="attending">Attending</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes about this event..."
                className="w-full min-h-[120px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add a tag..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                >
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Event Info (Read-only) */}
            {event && (
              <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Event Information
                </label>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  {event.starts_at && (
                    <div>
                      <span className="font-medium">Date: </span>
                      {new Date(event.starts_at).toLocaleDateString()}
                    </div>
                  )}
                  {(event.city || event.country) && (
                    <div>
                      <span className="font-medium">Location: </span>
                      {event.city && event.country ? `${event.city}, ${event.country}` : event.city || event.country}
                    </div>
                  )}
                  {event.venue && (
                    <div>
                      <span className="font-medium">Venue: </span>
                      {event.venue}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

