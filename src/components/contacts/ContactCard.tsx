"use client";

import React, { useState, useEffect } from "react";
import { SavedSpeakerProfile } from "@/lib/types/database";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
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
  Bot,
  Plus,
} from "lucide-react";
import { AssignTaskModal } from "@/components/agents/AssignTaskModal";
import { useAgents } from "@/lib/hooks/useAgents";

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
  const [hasPendingDraft, setHasPendingDraft] = useState(false);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);
  const [outreachAgent, setOutreachAgent] = useState<any>(null);
  const { agents } = useAgents();
  
  const isDue =
    contact.reminder_date &&
    new Date(contact.reminder_date) <= new Date();
  const hasNewIntel = contact.contact_research?.has_new_intel || false;
  const isArchived = contact.archived || false;
  const status = contact.outreach_status || "not_started";

  // Check for pending drafts and get outreach agent
  useEffect(() => {
    const checkDraft = async () => {
      try {
        const supabase = supabaseBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's outreach agents
        const { data: agentData } = await supabase
          .from('ai_agents')
          .select('*')
          .eq('user_id', user.id)
          .eq('agent_type', 'outreach')
          .eq('status', 'active')
          .limit(1);

        if (agentData && agentData.length > 0) {
          setOutreachAgent(agentData[0]);

          // Check for pending draft
          const { data: drafts } = await supabase
            .from('agent_outreach_drafts')
            .select('id')
            .eq('contact_id', contact.id)
            .eq('agent_id', agentData[0].id)
            .eq('status', 'pending_approval')
            .limit(1);

          setHasPendingDraft(drafts && drafts.length > 0);
        }
      } catch (error) {
        console.error('Error checking draft:', error);
      }
    };

    checkDraft();
  }, [contact.id, agents]);

  const handleCopyDraft = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const supabase = supabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      // Get user's outreach agents
      const { data: agents } = await supabase
        .from('ai_agents')
        .select('id')
        .eq('user_id', user.id)
        .eq('agent_type', 'outreach')
        .limit(1);

      if (!agents || agents.length === 0) {
        toast.error("No outreach agent found", {
          description: "Please generate a draft first"
        });
        return;
      }

      // Get latest draft for this contact
      const { data: drafts } = await supabase
        .from('agent_outreach_drafts')
        .select('*')
        .eq('contact_id', contact.id)
        .eq('agent_id', agents[0].id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!drafts || drafts.length === 0) {
        toast.error("No draft found", {
          description: "Generate a draft in the contact details first"
        });
        return;
      }

      const latestDraft = drafts[0];
      let draftText = latestDraft.message_body || "";
      if (latestDraft.subject && latestDraft.channel === 'email') {
        draftText = `Subject: ${latestDraft.subject}\n\n${draftText}`;
      }

      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      toast.success("Draft copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error: any) {
      console.error("Error copying draft:", error);
      toast.error("Failed to copy draft", {
        description: error.message || "Please try again"
      });
    }
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
          {!isArchived && (
            <button
              onClick={handleCopyDraft}
              className="rounded-full p-1 text-slate-400 opacity-0 transition-opacity hover:bg-indigo-50 hover:text-indigo-500 group-hover:opacity-100"
              title="Copy draft"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}
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
        {hasPendingDraft && !isArchived && (
          <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
            <Bot className="w-3 h-3" /> Draft Pending
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
        <div className="flex items-center gap-2">
          {outreachAgent && !isArchived && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAssignTaskModal(true);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              title="Assign outreach task to agent"
            >
              <Plus className="h-3 w-3" />
              Draft Outreach
            </button>
          )}
          <span className="text-xs text-slate-400">
            {contact.last_contacted_date
              ? `Contacted: ${new Date(contact.last_contacted_date).toLocaleDateString()}`
              : `Added: ${contact.saved_at ? new Date(contact.saved_at).toLocaleDateString() : "N/A"}`}
          </span>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-indigo-500" />
      </div>

      {/* Assign Task Modal */}
      {outreachAgent && (
        <AssignTaskModal
          agent={outreachAgent}
          isOpen={showAssignTaskModal}
          onClose={() => setShowAssignTaskModal(false)}
          onSuccess={async () => {
            setShowAssignTaskModal(false);
            toast.success('Task assigned! The agent will draft outreach shortly.');
            // Refresh draft status
            const supabase = supabaseBrowser();
            const { data: drafts } = await supabase
              .from('agent_outreach_drafts')
              .select('id')
              .eq('contact_id', contact.id)
              .eq('agent_id', outreachAgent.id)
              .eq('status', 'pending_approval')
              .limit(1);
            setHasPendingDraft(drafts && drafts.length > 0);
          }}
          preselectedContactId={contact.id}
        />
      )}
    </div>
  );
}

