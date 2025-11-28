'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSavedProfiles } from '@/lib/hooks/useSavedProfiles';
import { useTaskAssignment } from '@/lib/hooks/useTaskAssignment';
import { SavedSpeakerProfile } from '@/lib/types/database';
import { AIAgent, AgentType, OutreachChannel, TaskPriority } from '@/lib/types/agents';
import { 
  X, 
  Loader2, 
  AlertCircle,
  Mail,
  Linkedin,
  User,
  Search,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

interface AssignTaskModalProps {
  agent: AIAgent;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedContactId?: string;
  preselectedOpportunityId?: string;
}

export function AssignTaskModal({
  agent,
  isOpen,
  onClose,
  onSuccess,
  preselectedContactId,
  preselectedOpportunityId
}: AssignTaskModalProps) {
  const { profiles, loading: profilesLoading } = useSavedProfiles({ enabled: isOpen });
  const { assignTask, loading: assignmentLoading, error } = useTaskAssignment({ agentId: agent.id });
  
  const [selectedContactId, setSelectedContactId] = useState<string>(preselectedContactId || '');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>(preselectedOpportunityId || '');
  const [selectedChannel, setSelectedChannel] = useState<OutreachChannel>('email');
  const [selectedLanguage, setSelectedLanguage] = useState<'English' | 'German'>('English');
  const [selectedTone, setSelectedTone] = useState<'Formal' | 'Informal'>('Formal');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [searchTerm, setSearchTerm] = useState('');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (preselectedContactId) {
        setSelectedContactId(preselectedContactId);
        // Load contact preferences if available
        const contact = profiles.find(p => p.id === preselectedContactId);
        if (contact) {
          if (contact.preferred_language) {
            setSelectedLanguage(contact.preferred_language as 'English' | 'German');
          }
          if (contact.preferred_tone) {
            setSelectedTone(contact.preferred_tone as 'Formal' | 'Informal');
          }
          if (contact.preferred_channel) {
            setSelectedChannel(contact.preferred_channel as OutreachChannel);
          }
        }
      }
      if (preselectedOpportunityId) {
        setSelectedOpportunityId(preselectedOpportunityId);
      }
    } else {
      setSelectedContactId('');
      setSelectedOpportunityId('');
      setSelectedChannel('email');
      setSelectedLanguage('English');
      setSelectedTone('Formal');
      setPriority('medium');
      setSearchTerm('');
    }
  }, [isOpen, preselectedContactId, preselectedOpportunityId, profiles]);

  const selectedContact = useMemo(() => {
    return profiles.find(p => p.id === selectedContactId);
  }, [profiles, selectedContactId]);

  const filteredProfiles = useMemo(() => {
    if (!searchTerm) return profiles;
    const term = searchTerm.toLowerCase();
    return profiles.filter(profile => {
      const name = profile.speaker_data?.name?.toLowerCase() || '';
      const org = profile.speaker_data?.org?.toLowerCase() || '';
      const title = profile.enhanced_data?.title?.toLowerCase() || '';
      return name.includes(term) || org.includes(term) || title.includes(term);
    });
  }, [profiles, searchTerm]);

  const getTaskType = (): string => {
    switch (agent.agent_type) {
      case 'outreach':
        return 'draft_outreach';
      case 'followup':
        return 'schedule_followup';
      case 'planning':
        return 'analyze_opportunity';
      case 'research':
        return 'research_contact';
      default:
        return 'draft_outreach';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For planning agents analyzing opportunities, contact is optional
    if (agent.agent_type === 'planning' && selectedOpportunityId && !selectedContactId) {
      // Allow planning agents to analyze opportunities without a contact
    } else if (!selectedContactId) {
      toast.error('Please select a contact');
      return;
    }

    const inputData: Record<string, any> = {};
    
    if (selectedContactId) {
      inputData.contactId = selectedContactId;
    }
    
    if (selectedOpportunityId) {
      inputData.opportunityId = selectedOpportunityId;
    }

    if (agent.agent_type === 'outreach') {
      inputData.channel = selectedChannel;
      inputData.context = {
        preferredLanguage: selectedLanguage,
        preferredTone: selectedTone,
      };
    }

    const task = await assignTask({
      taskType: getTaskType(),
      priority,
      inputData
    });

    if (task) {
      toast.success('Task assigned successfully! The agent will process it shortly.');
      // Close modal immediately - don't wait for task to complete
      onClose();
      // Call onSuccess after modal closes (non-blocking)
      setTimeout(() => {
        onSuccess?.();
      }, 100);
    } else {
      toast.error(error || 'Failed to assign task');
    }
  };

  if (!isOpen) return null;

  const getAgentDescription = (): string => {
    switch (agent.agent_type) {
      case 'outreach':
        return 'This agent will draft a personalized outreach message for the selected contact.';
      case 'followup':
        return 'This agent will schedule and manage follow-up communications.';
      case 'planning':
        return 'This agent will analyze and prioritize opportunities.';
      case 'research':
        return 'This agent will research the contact and gather intelligence.';
      default:
        return 'This agent will process the assigned task.';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Assign Task to {agent.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{getAgentDescription()}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Contact Selection */}
            {/* For planning agents with preselected opportunity, contact is optional */}
            {(agent.agent_type !== 'planning' || !preselectedOpportunityId) && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Select Contact {agent.agent_type !== 'planning' && <span className="text-red-500">*</span>}
              </label>
              
              {/* Search */}
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search contacts by name, company, or title..."
                    className="w-full rounded-lg border border-slate-300 px-10 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Contact List */}
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                {profilesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : filteredProfiles.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    {searchTerm ? 'No contacts found' : 'No contacts available'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredProfiles.map((profile) => {
                      const isSelected = selectedContactId === profile.id;
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => setSelectedContactId(profile.id)}
                          className={`w-full px-4 py-3 text-left transition-colors ${
                            isSelected
                              ? 'bg-blue-50 border-l-4 border-blue-600'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                <p className={`font-medium truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                                  {profile.speaker_data?.name || 'Unknown'}
                                </p>
                                {isSelected && (
                                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                )}
                              </div>
                              <p className="mt-1 text-xs text-slate-600 truncate">
                                {profile.speaker_data?.org || 'No company'}
                                {profile.enhanced_data?.title && ` • ${profile.enhanced_data.title}`}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Contact Preview */}
              {selectedContact && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Selected: {selectedContact.speaker_data?.name}
                    </span>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Opportunity Info (if preselected) */}
            {preselectedOpportunityId && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Opportunity preselected for analysis
                  </span>
                </div>
              </div>
            )}

            {/* Outreach Options (for outreach agents) */}
            {agent.agent_type === 'outreach' && (
              <>
                {/* Channel Selection */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    Outreach Channel
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedChannel('email')}
                      className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-all ${
                        selectedChannel === 'email'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                      <span className="text-sm font-medium">Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChannel('linkedin')}
                      className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-all ${
                        selectedChannel === 'linkedin'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <Linkedin className="h-4 w-4" />
                      <span className="text-sm font-medium">LinkedIn</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChannel('other')}
                      className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-all ${
                        selectedChannel === 'other'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="text-sm font-medium">Other</span>
                    </button>
                  </div>
                </div>

                {/* Language Selection */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    Language
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value as 'English' | 'German')}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="English">English</option>
                    <option value="German">German</option>
                  </select>
                </div>

                {/* Tone Selection */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    Tone
                  </label>
                  <select
                    value={selectedTone}
                    onChange={(e) => setSelectedTone(e.target.value as 'Formal' | 'Informal')}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Formal">Formal</option>
                    <option value="Informal">Informal</option>
                  </select>
                </div>
              </>
            )}

            {/* Priority Selection */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Task Preview */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Task Preview</h3>
              <div className="space-y-1 text-sm text-slate-600">
                <p><span className="font-medium">Agent:</span> {agent.name}</p>
                <p><span className="font-medium">Task Type:</span> {getTaskType()}</p>
                {selectedContact && (
                  <p><span className="font-medium">Contact:</span> {selectedContact.speaker_data?.name}</p>
                )}
                {agent.agent_type === 'outreach' && (
                  <>
                    <p><span className="font-medium">Channel:</span> {selectedChannel}</p>
                    <p><span className="font-medium">Language:</span> {selectedLanguage}</p>
                    <p><span className="font-medium">Tone:</span> {selectedTone}</p>
                  </>
                )}
                <p><span className="font-medium">Priority:</span> {priority}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={(!selectedContactId && !(agent.agent_type === 'planning' && selectedOpportunityId)) || assignmentLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {assignmentLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Assign Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

