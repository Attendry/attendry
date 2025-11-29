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
  Loader2,
  AlertCircle,
} from "lucide-react";
import { AssignTaskModal } from "@/components/agents/AssignTaskModal";
import { useAgents } from "@/lib/hooks/useAgents";
import { useTaskSubscription } from "@/lib/hooks/useTaskSubscription";
import { notificationService } from "@/lib/services/notification-service";

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
  const [followupAgent, setFollowupAgent] = useState<any>(null);
  const [activeTask, setActiveTask] = useState<{
    id: string;
    status: string;
    task_type: string;
    agent_name: string;
    assigned_at: string;
  } | null>(null);
  const { agents } = useAgents();
  
  const isDue =
    contact.reminder_date &&
    new Date(contact.reminder_date) <= new Date();
  const hasNewIntel = contact.contact_research?.has_new_intel || false;
  const isArchived = contact.archived || false;
  const status = contact.outreach_status || "not_started";

  // Get user's agents (outreach and followup)
  useEffect(() => {
    const getAgents = async () => {
      try {
        const supabase = supabaseBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: agentData } = await supabase
          .from('ai_agents')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('agent_type', ['outreach', 'followup']);

        if (agentData) {
          const outreach = agentData.find(a => a.agent_type === 'outreach');
          const followup = agentData.find(a => a.agent_type === 'followup');
          if (outreach) setOutreachAgent(outreach);
          if (followup) setFollowupAgent(followup);
        }
      } catch (error) {
        console.error('Error loading agents:', error);
      }
    };

    getAgents();
  }, [agents]);

  // Check for pending drafts
  useEffect(() => {
    const checkDraft = async () => {
      if (!outreachAgent) return;
      
      try {
        const supabase = supabaseBrowser();
        const { data: drafts } = await supabase
          .from('agent_outreach_drafts')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('agent_id', outreachAgent.id)
          .eq('status', 'pending_approval')
          .limit(1);

        setHasPendingDraft(drafts && drafts.length > 0);
      } catch (error) {
        console.error('Error checking draft:', error);
      }
    };

    checkDraft();
  }, [contact.id, outreachAgent]);

  // Real-time task subscription (include both outreach and followup agents)
  const agentIds = [
    ...(outreachAgent ? [outreachAgent.id] : []),
    ...(followupAgent ? [followupAgent.id] : []),
  ];
  const { activeTasks } = useTaskSubscription({
    contactId: contact.id,
    agentIds,
    enabled: agentIds.length > 0 && !isArchived,
    onTaskComplete: async (task) => {
      const contactName = contact.speaker_data?.name || 'Contact';
      // Show notification when task completes
      await notificationService.notifyTaskComplete({
        task_type: task.task_type,
        status: task.status,
        agent_name: task.agent?.name,
        contact_name: contactName,
      });
      
      if (task.status === 'completed') {
        toast.success('Agent task completed! Draft is ready.');
      } else if (task.status === 'failed') {
        toast.error('Agent task failed. Please check the task details.');
      }
    },
  });

  // Update activeTask state from subscription
  useEffect(() => {
    // Prioritize active tasks, but also show completed tasks briefly
    const activeTask = activeTasks.find(
      (t) => ['pending', 'in_progress'].includes(t.status)
    ) || activeTasks.find(
      (t) => t.status === 'completed' && 
      // Show completed tasks that were completed in the last 5 minutes
      t.completed_at && 
      new Date(t.completed_at).getTime() > Date.now() - 5 * 60 * 1000
    );
    
    if (activeTask) {
      setActiveTask({
        id: activeTask.id,
        status: activeTask.status,
        task_type: activeTask.task_type,
        agent_name: activeTask.agent?.name || 'Agent',
        assigned_at: activeTask.assigned_at,
      });
    } else {
      setActiveTask(null);
    }
  }, [activeTasks]);

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
            : "bg-blue-500 opacity-0 group-hover:opacity-100"
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
              className="rounded-full p-1 text-slate-400 opacity-0 transition-opacity hover:bg-blue-50 hover:text-blue-500 group-hover:opacity-100"
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
              className="rounded-full p-1 text-slate-400 opacity-0 transition-opacity hover:bg-blue-50 hover:text-blue-500 group-hover:opacity-100"
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
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-500"
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
        {activeTask && !isArchived && (
          <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            activeTask.status === 'in_progress' 
              ? 'bg-blue-100 text-blue-700' 
              : activeTask.status === 'pending'
              ? 'bg-yellow-100 text-yellow-700'
              : activeTask.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {activeTask.status === 'in_progress' && <Loader2 className="w-3 h-3 animate-spin" />}
            {activeTask.status === 'pending' && <Clock className="w-3 h-3" />}
            {activeTask.status === 'completed' && <CheckCircle className="w-3 h-3" />}
            {(activeTask.status === 'failed' || activeTask.status === 'cancelled') && <AlertCircle className="w-3 h-3" />}
            {activeTask.status === 'in_progress' ? 'Agent Working' :
             activeTask.status === 'pending' ? 'Task Queued' :
             activeTask.status === 'completed' ? 'Draft Ready' : 'Task Failed'}
          </span>
        )}
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
        {hasPendingDraft && !activeTask && !isArchived && (
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
        <ChevronRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-blue-500" />
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
            
            // Refresh task and draft status
            const supabase = supabaseBrowser();
            
            // Check for new task
            const { data: tasks } = await supabase
              .from('agent_tasks')
              .select(`
                id,
                status,
                task_type,
                assigned_at,
                input_data,
                agent:ai_agents(id, name, agent_type)
              `)
              .eq('agent_id', outreachAgent.id)
              .in('status', ['pending', 'in_progress'])
              .order('assigned_at', { ascending: false })
              .limit(5);

            const contactTask = tasks?.find((task: any) => {
              const inputData = task.input_data || {};
              return inputData.contactId === contact.id;
            });

            if (contactTask) {
              setActiveTask({
                id: contactTask.id,
                status: contactTask.status,
                task_type: contactTask.task_type,
                agent_name: contactTask.agent?.name || 'Agent',
                assigned_at: contactTask.assigned_at,
              });
            }
            
            // Check for pending draft
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

