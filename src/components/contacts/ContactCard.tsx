"use client";

import React, { useState } from "react";
import { SavedSpeakerProfile } from "@/lib/types/database";
import {
  User,
  Building2,
  ChevronRight,
  RefreshCw,
  Mail,
  CheckCircle,
  Clock,
  Bell,
  Eye,
  Sparkles,
  Archive,
  RotateCcw,
  Copy,
  Check,
} from "lucide-react";

interface ContactCardProps {
  contact: SavedSpeakerProfile & {
    contact_research?: {
      has_new_intel: boolean;
      new_intel_summary: string | null;
    } | null;
  };
  onClick: (contact: SavedSpeakerProfile) => void;
  onDelete?: (id: string) => void;
  onArchive?: (contact: SavedSpeakerProfile) => void;
  onRestore?: (contact: SavedSpeakerProfile) => void;
}

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600",
  contacted: "bg-yellow-100 text-yellow-600",
  responded: "bg-green-100 text-green-600",
  meeting_scheduled: "bg-purple-100 text-purple-600",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  not_started: <User className="w-4 h-4" />,
  contacted: <Mail className="w-4 h-4" />,
  responded: <CheckCircle className="w-4 h-4" />,
  meeting_scheduled: <CheckCircle className="w-4 h-4" />,
};

export function ContactCard({
  contact,
  onClick,
  onDelete,
  onArchive,
  onRestore,
}: ContactCardProps) {
  const [copied, setCopied] = useState(false);
  
  const isDue =
    contact.reminder_date &&
    new Date(contact.reminder_date) <= new Date();
  const hasNewIntel = contact.contact_research?.has_new_intel || false;
  const isArchived = contact.archived || false;
  const status = contact.outreach_status || "not_started";

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Copy email draft when available
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const name = contact.speaker_data?.name || "Unknown";
  const company =
    contact.speaker_data?.org ||
    contact.speaker_data?.organization ||
    "No company";

  return (
    <div
      onClick={() => onClick(contact)}
      className={`
        group relative cursor-pointer overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md
        ${
          isDue || hasNewIntel
            ? "border-orange-300 ring-1 ring-orange-100"
            : "border-slate-200"
        }
        ${isArchived ? "bg-slate-50 opacity-75 hover:opacity-100" : ""}
      `}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1 transition-opacity ${
          isArchived
            ? "bg-slate-300"
            : "bg-indigo-500 opacity-0 group-hover:opacity-100"
        }`}
      />

      <div className="mb-3 flex items-start justify-between">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.not_started}`}
        >
          {STATUS_ICONS[status] || STATUS_ICONS.not_started}
          {status.replace(/_/g, " ")}
        </span>
        <div className="flex items-center gap-1">
          {!isArchived && onArchive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive(contact);
              }}
              className="rounded-full p-1 text-slate-400 opacity-0 transition-opacity hover:bg-indigo-50 hover:text-indigo-500 group-hover:opacity-100"
              title="Archive to History"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
          {isArchived && onRestore && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore(contact);
              }}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-500"
              title="Restore to Active"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this contact permanently?")) {
                  onDelete(contact.id);
                }
              }}
              className="rounded-full p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              title="Delete"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
        {name}
      </h3>
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Building2 className="w-4 h-4" />
        {company}
      </div>

      {/* Reminder / Monitoring Badges */}
      <div className="mb-4 flex flex-wrap gap-2">
        {hasNewIntel && !isArchived && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            <Sparkles className="w-3 h-3" /> New Intel
          </span>
        )}
        {isDue && !isArchived && (
          <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
            <Clock className="w-3 h-3" /> Follow Up Due
          </span>
        )}
        {contact.monitor_updates && !hasNewIntel && !isArchived && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <Eye className="w-3 h-3" /> Monitoring
          </span>
        )}
        {contact.reminder_date && !isDue && !isArchived && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <Bell className="w-3 h-3" />{" "}
            {new Date(contact.reminder_date).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-400">
          {contact.last_contacted_date
            ? `Contacted: ${new Date(contact.last_contacted_date).toLocaleDateString()}`
            : `Added: ${contact.saved_at ? new Date(contact.saved_at).toLocaleDateString() : "N/A"}`}
        </span>
        <ChevronRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-indigo-500" />
      </div>
    </div>
  );
}

