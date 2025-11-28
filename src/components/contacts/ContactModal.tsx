"use client";

import React, { useState, useEffect } from "react";
import { SavedSpeakerProfile } from "@/lib/types/database";
import {
  X,
  ExternalLink,
  Sparkles,
  Send,
  Copy,
  Check,
  Calendar,
  RotateCw,
  AlertCircle,
  Globe,
  MessageSquare,
  Bell,
  Eye,
  Loader2,
  Cloud,
  Share2,
  Bot,
  Plus,
  Mail,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { useAgents } from "@/lib/hooks/useAgents";
import { useTaskAssignment } from "@/lib/hooks/useTaskAssignment";
import { useTaskSubscription } from "@/lib/hooks/useTaskSubscription";
import { AssignTaskModal } from "@/components/agents/AssignTaskModal";
import { notificationService } from "@/lib/services/notification-service";
import { AIAgent, OutreachChannel, TaskPriority } from "@/lib/types/agents";
import Link from "next/link";

interface ContactModalProps {
  contact: SavedSpeakerProfile & {
    contact_research?: {
      background_info: string | null;
      grounding_links: Array<{ title: string; url: string }>;
      last_research_date: string | null;
      has_new_intel: boolean;
      new_intel_summary: string | null;
    } | null;
  };
  onClose: () => void;
  onUpdate: (updatedContact: SavedSpeakerProfile) => void;
}

type OutreachStatus = SavedSpeakerProfile["outreach_status"];
type OutreachChannel = "email" | "linkedin" | "other";

export function ContactModal({ contact, onClose, onUpdate }: ContactModalProps) {
  const [localContact, setLocalContact] = useState(contact);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [updateAlert, setUpdateAlert] = useState<string | null>(
    contact.contact_research?.new_intel_summary || null
  );

  // Draft configuration state
  const [draftLanguage, setDraftLanguage] = useState<"English" | "German">(
    (contact.preferred_language as "English" | "German") || "English"
  );
  const [draftTone, setDraftTone] = useState<"Formal" | "Informal">(
    (contact.preferred_tone as "Formal" | "Informal") || "Formal"
  );
  const [draftChannel, setDraftChannel] = useState<OutreachChannel>(
    (contact.preferred_channel as OutreachChannel) || "email"
  );
  const [emailDraft, setEmailDraft] = useState<string>("");

  // Research data
  const [research, setResearch] = useState(contact.contact_research);

  // Agent integration
  const { agents } = useAgents();
  const [availableAgents, setAvailableAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);
  const [agentDrafts, setAgentDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const { assignTask, loading: assignmentLoading } = useTaskAssignment({ 
    agentId: selectedAgentId || undefined 
  });

  // Load existing draft when modal opens
  useEffect(() => {
    const loadDraft = async () => {
      try {
        // Get user's outreach agents to find drafts
        const supabase = supabaseBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's outreach agents
        const { data: agents } = await supabase
          .from('ai_agents')
          .select('id')
          .eq('user_id', user.id)
          .eq('agent_type', 'outreach')
          .limit(1);

        if (!agents || agents.length === 0) return;

        // Get latest draft for this contact
        const { data: drafts } = await supabase
          .from('agent_outreach_drafts')
          .select('*')
          .eq('contact_id', contact.id)
          .eq('agent_id', agents[0].id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (drafts && drafts.length > 0) {
          const latestDraft = drafts[0];
          let draftText = latestDraft.message_body || "";
          if (latestDraft.subject && latestDraft.channel === 'email') {
            draftText = `Subject: ${latestDraft.subject}\n\n${draftText}`;
          }
          setEmailDraft(draftText);
          
          // Update draft settings from the draft
          if (latestDraft.personalization_context) {
            const context = latestDraft.personalization_context as any;
            if (context.language) {
              setDraftLanguage(context.language as "English" | "German");
            }
            if (context.tone) {
              setDraftTone(context.tone as "Formal" | "Informal");
            }
            if (latestDraft.channel) {
              setDraftChannel(latestDraft.channel as OutreachChannel);
            }
          }
        }
      } catch (error) {
        console.error('Error loading draft:', error);
        // Don't show error - just continue without draft
      }
    };

    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id]);

  // Load available agents and their drafts for this contact
  useEffect(() => {
    const loadAgentData = async () => {
      try {
        const supabase = supabaseBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's active agents
        const agentsArray = Array.isArray(agents) ? agents : [];
        const activeAgents = agentsArray.filter(a => a?.status === 'active');
        setAvailableAgents(activeAgents);

        if (activeAgents.length > 0) {
          // Set default to outreach agent if available
          const outreachAgent = activeAgents.find(a => a.agent_type === 'outreach');
          if (outreachAgent) {
            setSelectedAgentId(outreachAgent.id);
          } else {
            setSelectedAgentId(activeAgents[0].id);
          }

          // Load drafts for this contact
          setLoadingDrafts(true);
          const agentIds = activeAgents.map(a => a.id);
          const { data: drafts } = await supabase
            .from('agent_outreach_drafts')
            .select(`
              *,
              agent:ai_agents(id, name, agent_type)
            `)
            .eq('contact_id', contact.id)
            .in('agent_id', agentIds)
            .order('created_at', { ascending: false })
            .limit(10);

          setAgentDrafts(drafts || []);
        }
      } catch (error) {
        console.error('Error loading agent data:', error);
      } finally {
        setLoadingDrafts(false);
      }
    };

    loadAgentData();
  }, [contact.id, agents]);

  // Real-time task subscription
  const agentIds = availableAgents.map(a => a.id);
  const { activeTasks: subscribedTasks } = useTaskSubscription({
    contactId: contact.id,
    agentIds,
    enabled: availableAgents.length > 0,
    onTaskComplete: async (task) => {
      const contactName = contact.speaker_data?.name || 'Contact';
      // Show notification when task completes
      await notificationService.notifyTaskComplete({
        task_type: task.task_type,
        status: task.status,
        agent_name: task.agent?.name,
        contact_name: contactName,
      });
      
      // Refresh drafts when task completes
      if (task.status === 'completed') {
        // Reload agent data to refresh drafts
        const supabase = supabaseBrowser();
        const agentIds = availableAgents.map(a => a.id);
        const { data: drafts } = await supabase
          .from('agent_outreach_drafts')
          .select(`
            *,
            agent:ai_agents(id, name, agent_type)
          `)
          .eq('contact_id', contact.id)
          .in('agent_id', agentIds)
          .order('created_at', { ascending: false })
          .limit(10);
        setAgentDrafts(drafts || []);
        toast.success('Agent task completed!');
      } else if (task.status === 'failed') {
        toast.error('Agent task failed. Please check the task details.');
      }
    },
  });

  // Update activeTasks state from subscription
  useEffect(() => {
    setActiveTasks(subscribedTasks);
  }, [subscribedTasks]);

  // Sync prop changes
  useEffect(() => {
    if (!isSaving || localContact.id !== contact.id) {
      setLocalContact(contact);
      setResearch(contact.contact_research);
      if (contact.contact_research?.new_intel_summary) {
        setUpdateAlert(contact.contact_research.new_intel_summary);
      }
      if (localContact.id !== contact.id) {
        setDraftLanguage(
          (contact.preferred_language as "English" | "German") || "English"
        );
        setDraftTone(
          (contact.preferred_tone as "Formal" | "Informal") || "Formal"
        );
        setDraftChannel(
          (contact.preferred_channel as OutreachChannel) || "email"
        );
      }
    }
  }, [contact, isSaving, localContact.id]);

  // Auto-save effect
  useEffect(() => {
    const isDirty =
      JSON.stringify(localContact) !== JSON.stringify(contact) ||
      localContact.notes !== contact.notes ||
      localContact.preferred_language !== contact.preferred_language ||
      localContact.preferred_tone !== contact.preferred_tone ||
      localContact.preferred_channel !== contact.preferred_channel ||
      localContact.reminder_date !== contact.reminder_date ||
      localContact.monitor_updates !== contact.monitor_updates;

    if (isDirty) {
      setIsSaving(true);
      const timer = setTimeout(async () => {
        await saveContact();
        setIsSaving(false);
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      setIsSaving(false);
    }
  }, [localContact, contact]);

  const saveContact = async () => {
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase
        .from("saved_speaker_profiles")
        .update({
          notes: localContact.notes,
          preferred_language: draftLanguage,
          preferred_tone: draftTone,
          preferred_channel: draftChannel,
          reminder_date: localContact.reminder_date,
          monitor_updates: localContact.monitor_updates,
          outreach_status: localContact.outreach_status,
          last_updated: new Date().toISOString(),
        })
        .eq("id", localContact.id);

      if (error) throw error;

      const updated = {
        ...localContact,
        preferred_language: draftLanguage,
        preferred_tone: draftTone,
        preferred_channel: draftChannel,
      };
      onUpdate(updated);
    } catch (error: any) {
      console.error("Failed to save contact:", error);
      toast.error("Failed to save", {
        description: error.message || "An error occurred",
      });
    }
  };

  const handleResearch = async () => {
    setIsLoading(true);
    setLoadingMessage("Analyzing web for background intel...");
    try {
      const response = await fetch(`/api/contacts/${contact.id}/research`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to research contact");
      }

      const data = await response.json();
      if (data.success && data.research) {
        setResearch(data.research);
        setUpdateAlert(null);
        toast.success("Research complete", {
          description: "Background information has been updated",
        });
      }
    } catch (error: any) {
      toast.error("Failed to research contact", {
        description: error.message || "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckUpdates = async () => {
    if (!research?.background_info) return;

    setIsLoading(true);
    setLoadingMessage("Checking for new intel...");
    try {
      const response = await fetch(
        `/api/contacts/${contact.id}/research`,
        {
          method: "PUT",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to check updates");
      }

      const data = await response.json();
      if (data.success) {
        if (data.hasUpdates && data.newIntel) {
          setUpdateAlert(data.newIntel);
          // Refresh research data
          const researchResponse = await fetch(
            `/api/contacts/${contact.id}/research`
          );
          if (researchResponse.ok) {
            const researchData = await researchResponse.json();
            if (researchData.success) {
              setResearch(researchData.research);
            }
          }
        } else {
          setUpdateAlert("No significant new updates found.");
          setTimeout(() => {
            if (!research?.new_intel_summary) setUpdateAlert(null);
          }, 3000);
        }
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to check updates", {
        description: error.message || "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDraftEmail = async () => {
    setIsLoading(true);
    setLoadingMessage(`Drafting ${draftTone} ${draftChannel} in ${draftLanguage}...`);
    try {
      const response = await fetch(`/api/contacts/${contact.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: draftLanguage,
          tone: draftTone,
          channel: draftChannel,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate draft");
      }

      // Set the draft in the textarea
      if (data.draft) {
        let draftText = data.draft.messageBody || "";
        if (data.draft.subject && draftChannel === "email") {
          draftText = `Subject: ${data.draft.subject}\n\n${draftText}`;
        }
        setEmailDraft(draftText);
        
        // Draft is already saved in database via the API, so it will persist
        toast.success("Draft generated", {
          description: "Your personalized outreach message is ready",
        });
      }
    } catch (error: any) {
      console.error("Error generating draft:", error);
      toast.error("Failed to generate draft", {
        description: error.message || "Please try again",
      });
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleStatusChange = (newStatus: OutreachStatus) => {
    const updated = { ...localContact, outreach_status: newStatus };
    if (newStatus === "contacted" || newStatus === "responded") {
      updated.last_contacted_date = new Date().toISOString();
      if (!updated.reminder_date) {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        updated.reminder_date = nextWeek.toISOString().split("T")[0];
      }
    }
    setLocalContact(updated);
  };

  const copyToClipboard = () => {
    if (emailDraft) {
      navigator.clipboard.writeText(emailDraft);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const name = contact.speaker_data?.name || "Unknown";
  const company =
    contact.speaker_data?.org ||
    contact.speaker_data?.organization ||
    "No company";
  const role =
    contact.speaker_data?.title ||
    contact.enhanced_data?.title ||
    "Contact";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        {/* Header */}
        <div className="z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{name}</h2>
            <p className="text-sm text-slate-500">
              {company} • {role}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs font-medium transition-colors duration-300">
              {isSaving ? (
                <span className="flex items-center gap-1 text-indigo-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400">
                  <Cloud className="h-3 w-3" /> Saved
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          {/* Status Bar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Current Status
            </label>
            <div className="flex items-center gap-3">
              <select
                value={localContact.outreach_status}
                onChange={(e) =>
                  handleStatusChange(e.target.value as OutreachStatus)
                }
                className="block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="not_started">Not Started</option>
                <option value="contacted">Contacted</option>
                <option value="responded">Responded</option>
                <option value="meeting_scheduled">Meeting Scheduled</option>
              </select>
              {localContact.last_contacted_date && (
                <div className="flex items-center gap-1 whitespace-nowrap text-xs text-slate-500">
                  <Calendar className="h-3 w-3" />
                  Last:{" "}
                  {new Date(localContact.last_contacted_date).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Follow-up & Reminders Section */}
          <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-orange-900">
                Reminders & Monitoring
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Time-based Reminder */}
              <div>
                <label className="mb-1 block text-xs font-medium text-orange-800">
                  Time-based Follow Up
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                  value={
                    localContact.reminder_date
                      ? localContact.reminder_date.split("T")[0]
                      : ""
                  }
                  onChange={(e) => {
                    const updated = {
                      ...localContact,
                      reminder_date: e.target.value,
                    };
                    setLocalContact(updated);
                  }}
                />
              </div>

              {/* Info-based Monitoring */}
              <div>
                <label className="mb-1 block text-xs font-medium text-orange-800">
                  Background Monitoring
                </label>
                <button
                  onClick={() => {
                    const updated = {
                      ...localContact,
                      monitor_updates: !localContact.monitor_updates,
                    };
                    setLocalContact(updated);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                    localContact.monitor_updates
                      ? "border-orange-300 bg-orange-100 text-orange-800"
                      : "border-orange-200 bg-white text-slate-500"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    {localContact.monitor_updates
                      ? "Monitoring Active"
                      : "Monitor Disabled"}
                  </span>
                  {localContact.monitor_updates && (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Research Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                Background Intel
              </h3>
              <div className="flex gap-2">
                {research?.background_info && (
                  <button
                    onClick={handleCheckUpdates}
                    disabled={isLoading}
                    className="flex items-center gap-1 rounded-md bg-indigo-50 px-3 py-1.5 text-xs text-indigo-600 transition-colors hover:text-indigo-700"
                  >
                    <RotateCw className="h-3 w-3" /> Check Updates
                  </button>
                )}
                <button
                  onClick={handleResearch}
                  disabled={isLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {research?.background_info ? "Refresh Intel" : "Generate Intel"}
                </button>
              </div>
            </div>

            {updateAlert && (
              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <span className="mb-1 block font-semibold">Update Alert</span>
                  {updateAlert}
                </div>
              </div>
            )}

            {research?.background_info ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap text-slate-600">
                  {research.background_info}
                </div>
                {research.grounding_links &&
                  research.grounding_links.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      {research.grounding_links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-200"
                        >
                          {link.title} <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  )}
                {research.last_research_date && (
                  <p className="mt-3 text-right text-xs text-slate-400">
                    Intel updated:{" "}
                    {new Date(research.last_research_date).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-400">
                  No background information yet. Click "Generate Intel" to start.
                </p>
              </div>
            )}
          </div>

          {/* Agent Assignment Section */}
          {availableAgents.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <Bot className="h-5 w-5 text-indigo-500" />
                  AI Agent Assignment
                </h3>
                {selectedAgentId && (
                  <button
                    onClick={() => setShowAssignTaskModal(true)}
                    disabled={assignmentLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Assign Task
                  </button>
                )}
              </div>

              {/* Agent Selection */}
              {availableAgents.length > 1 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Select Agent
                  </label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {availableAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.agent_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Active Tasks */}
              {activeTasks.filter((t: any) => ['pending', 'in_progress'].includes(t.status)).length > 0 && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-semibold text-slate-700">Active Agent Tasks</h4>
                  <div className="space-y-2">
                    {activeTasks
                      .filter((t: any) => ['pending', 'in_progress'].includes(t.status))
                      .slice(0, 3)
                      .map((task: any) => {
                        const agent = task.agent;
                        const getTaskStatusIcon = () => {
                          switch (task.status) {
                            case 'in_progress':
                              return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
                            case 'pending':
                              return <Clock className="h-4 w-4 text-yellow-500" />;
                            default:
                              return <Bot className="h-4 w-4 text-slate-400" />;
                          }
                        };

                        const getTaskStatusColor = () => {
                          switch (task.status) {
                            case 'in_progress':
                              return 'border-blue-200 bg-blue-50';
                            case 'pending':
                              return 'border-yellow-200 bg-yellow-50';
                            default:
                              return 'border-slate-200 bg-slate-50';
                          }
                        };

                        const formatTimeAgo = (date: string) => {
                          const now = new Date();
                          const taskDate = new Date(date);
                          const diffMs = now.getTime() - taskDate.getTime();
                          const diffMins = Math.floor(diffMs / 60000);
                          const diffHours = Math.floor(diffMs / 3600000);
                          
                          if (diffMins < 1) return 'Just now';
                          if (diffMins < 60) return `${diffMins}m ago`;
                          if (diffHours < 24) return `${diffHours}h ago`;
                          return taskDate.toLocaleDateString();
                        };

                        return (
                          <div
                            key={task.id}
                            className={`rounded-lg border p-3 ${getTaskStatusColor()}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {getTaskStatusIcon()}
                                  <span className="text-xs font-medium text-slate-700">
                                    {task.status === 'in_progress' ? 'Agent Working' : 'Task Queued'}
                                  </span>
                                  {agent && (
                                    <>
                                      <span className="text-slate-400">•</span>
                                      <span className="text-xs text-slate-500">{agent.name}</span>
                                    </>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 mb-1">
                                  {task.task_type.replace('_', ' ')}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatTimeAgo(task.assigned_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Agent Drafts History */}
              {agentDrafts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700">Recent Agent Activity</h4>
                  <div className="space-y-2">
                    {agentDrafts.slice(0, 3).map((draft) => {
                      const agent = (draft as any).agent;
                      const getStatusIcon = () => {
                        switch (draft.status) {
                          case 'pending_approval':
                            return <Clock className="h-4 w-4 text-amber-500" />;
                          case 'approved':
                            return <CheckCircle2 className="h-4 w-4 text-green-500" />;
                          case 'rejected':
                            return <X className="h-4 w-4 text-red-500" />;
                          default:
                            return <Mail className="h-4 w-4 text-slate-400" />;
                        }
                      };

                      const getStatusColor = () => {
                        switch (draft.status) {
                          case 'pending_approval':
                            return 'border-amber-200 bg-amber-50';
                          case 'approved':
                            return 'border-green-200 bg-green-50';
                          case 'rejected':
                            return 'border-red-200 bg-red-50';
                          default:
                            return 'border-slate-200 bg-slate-50';
                        }
                      };

                      return (
                        <div
                          key={draft.id}
                          className={`rounded-lg border p-3 ${getStatusColor()}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {getStatusIcon()}
                                <span className="text-xs font-medium text-slate-700">
                                  {draft.status.replace('_', ' ')}
                                </span>
                                {agent && (
                                  <>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-xs text-slate-500">{agent.name}</span>
                                  </>
                                )}
                              </div>
                              {draft.subject && (
                                <p className="text-xs text-slate-600 mb-1">{draft.subject}</p>
                              )}
                              <p className="text-xs text-slate-500">
                                {new Date(draft.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            {draft.status === 'pending_approval' && (
                              <Link
                                href="/agents/approvals"
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                              >
                                Review →
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {agentDrafts.length > 3 && (
                    <Link
                      href="/agents/approvals"
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      View all {agentDrafts.length} drafts →
                    </Link>
                  )}
                </div>
              )}

              {agentDrafts.length === 0 && activeTasks.length === 0 && !loadingDrafts && (
                <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <Bot className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500 mb-3">
                    No agent tasks assigned yet
                  </p>
                  <button
                    onClick={() => setShowAssignTaskModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Assign First Task
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Email Draft Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Send className="h-5 w-5 text-indigo-500" />
                Outreach Draft
              </h3>
              <button
                onClick={handleDraftEmail}
                disabled={isLoading}
                className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {emailDraft ? "Regenerate Draft" : "Create Draft"}
              </button>
            </div>

            {/* Configuration Controls */}
            <div className="flex flex-wrap gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div className="min-w-[120px] flex-1">
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Globe className="h-3 w-3" /> Language
                </label>
                <div className="flex rounded-md border border-slate-200 bg-white p-1 shadow-sm">
                  {(["English", "German"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setDraftLanguage(lang)}
                      className={`flex-1 rounded-sm px-2 py-1.5 text-xs font-medium transition-all ${
                        draftLanguage === lang
                          ? "bg-indigo-100 text-indigo-700 shadow-sm"
                          : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-[120px] flex-1">
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <MessageSquare className="h-3 w-3" /> Tone
                </label>
                <div className="flex rounded-md border border-slate-200 bg-white p-1 shadow-sm">
                  {(["Formal", "Informal"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setDraftTone(t)}
                      className={`flex-1 rounded-sm px-2 py-1.5 text-xs font-medium transition-all ${
                        draftTone === t
                          ? "bg-indigo-100 text-indigo-700 shadow-sm"
                          : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-[160px] flex-1">
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Share2 className="h-3 w-3" /> Channel
                </label>
                <div className="flex rounded-md border border-slate-200 bg-white p-1 shadow-sm">
                  {(["email", "linkedin", "other"] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setDraftChannel(ch)}
                      className={`flex-1 rounded-sm px-2 py-1.5 text-xs font-medium transition-all capitalize ${
                        draftChannel === ch
                          ? "bg-indigo-100 text-indigo-700 shadow-sm"
                          : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {emailDraft ? (
              <div className="relative group">
                <textarea
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  className="h-64 w-full resize-none rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                />
                <div className="absolute right-3 top-3 flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="rounded-md border border-slate-200 bg-white/90 p-2 text-slate-500 backdrop-blur-sm transition-colors hover:bg-slate-100"
                    title="Copy to clipboard"
                  >
                    {copySuccess ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-400">
                  No draft generated yet. Requires intel first.
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              My Notes
            </h3>
            <textarea
              className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-700 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="Add personal notes, specific goals for this contact..."
              value={localContact.notes || ""}
              onChange={(e) => {
                const updated = { ...localContact, notes: e.target.value };
                setLocalContact(updated);
              }}
            />
          </div>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600"></div>
              <p className="animate-pulse text-sm font-medium text-indigo-800">
                {loadingMessage}
              </p>
            </div>
          </div>
        )}

        {/* Assign Task Modal */}
        {selectedAgentId && availableAgents.length > 0 && (
          <AssignTaskModal
            agent={availableAgents.find(a => a.id === selectedAgentId)!}
            isOpen={showAssignTaskModal}
            onClose={() => setShowAssignTaskModal(false)}
            onSuccess={async () => {
              setShowAssignTaskModal(false);
              toast.success('Task assigned! The agent will process it shortly.');
              
              // Refresh agent drafts
              try {
                const supabase = supabaseBrowser();
                const agentIds = availableAgents.map(a => a.id);
                const { data: drafts } = await supabase
                  .from('agent_outreach_drafts')
                  .select(`
                    *,
                    agent:ai_agents(id, name, agent_type)
                  `)
                  .eq('contact_id', contact.id)
                  .in('agent_id', agentIds)
                  .order('created_at', { ascending: false })
                  .limit(10);
                setAgentDrafts(drafts || []);
              } catch (error) {
                console.error('Error refreshing drafts:', error);
              }
            }}
            preselectedContactId={contact.id}
          />
        )}
      </div>
    </div>
  );
}

