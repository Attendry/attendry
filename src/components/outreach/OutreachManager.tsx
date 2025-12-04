'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Contact, OutreachStatus, OutreachType } from './types';
import { ContactCard } from './ContactCard';
import { ContactModal } from './ContactModal';
import { Plus, Rocket, LayoutGrid, Check, RefreshCw, Zap, History, Settings, Globe, Search, Filter, Calendar, List, Target, X, Copy, Loader2 } from 'lucide-react';
import { 
  researchContact, 
  generateEmailDraft, 
  generateLinkedInBio, 
  checkForUpdates 
} from '@/lib/services/contact-research-service';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { toast } from 'sonner';
import { savedProfileToContact, contactToUpdatePayload, mapOutreachStatusToDb } from '@/lib/adapters/outreach-adapter';

// Helper to get ISO week number for goal tracking
const getWeekNumber = (d: Date) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const OutreachManager = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'focus' | 'history'>('focus');
  const [isAdding, setIsAdding] = useState(false);
  
  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [myCompanyUrl, setMyCompanyUrl] = useState('');
  const [weeklyGoalTarget, setWeeklyGoalTarget] = useState(4);

  // Table Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDue, setFilterDue] = useState(false);

  // New Contact State
  const [newContactName, setNewContactName] = useState('');
  const [newContactCompany, setNewContactCompany] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactLang, setNewContactLang] = useState<'English' | 'German'>('English');
  const [newContactTone, setNewContactTone] = useState<'Formal' | 'Informal'>('Formal');
  
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  
  // UI State for Copy Feedback
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const supabase = supabaseBrowser();

  // Initialize Auth & Load Data
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        await loadContacts(session.user.id);
        loadSettings();
      }
      setIsLoaded(true);
    };
    init();
  }, []);

  const loadSettings = () => {
    const savedUrl = localStorage.getItem('outreach-my-url');
    const savedGoal = localStorage.getItem('outreach-weekly-goal');
    if (savedUrl) setMyCompanyUrl(savedUrl);
    if (savedGoal) setWeeklyGoalTarget(parseInt(savedGoal));
  };

  // Persistence for Settings only (Contacts are DB now)
  useEffect(() => {
    if (isLoaded) localStorage.setItem('outreach-my-url', myCompanyUrl);
  }, [myCompanyUrl, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('outreach-weekly-goal', weeklyGoalTarget.toString());
  }, [weeklyGoalTarget, isLoaded]);

  const loadContacts = async (uid: string) => {
    // Fetch profiles from saved_speaker_profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('saved_speaker_profiles')
      .select('*, contact_research(*)')
      .eq('user_id', uid);

    if (profilesError) {
      console.error('Error loading profiles:', profilesError);
      toast.error('Failed to load contacts');
      return;
    }

    const mapped: Contact[] = profiles.map(row => savedProfileToContact({
      ...row,
      contact_research: Array.isArray(row.contact_research) ? row.contact_research[0] : row.contact_research
    }));

    // Resurfacing Logic
    const today = new Date().toISOString().split('T')[0];
    const updates: Promise<void>[] = [];
    
    const processed = mapped.map(c => {
        if (c.archived && c.reminderDate) {
            // Normalize reminderDate to ISO date string (YYYY-MM-DD)
            const reminderDateStr = c.reminderDate.includes('T') 
              ? c.reminderDate.split('T')[0] 
              : c.reminderDate;
            
            if (reminderDateStr <= today) {
                // Auto-restore (fire and forget - errors logged but don't block)
                updates.push(
                  updateProfileInDb(c.id, { archived: false })
                    .catch(err => console.error('Failed to resurface contact:', err))
                );
                return { ...c, archived: false };
            }
        }
        return c;
    });

    if (updates.length > 0) {
        await Promise.all(updates);
        toast.success(`Resurfaced ${updates.length} due contacts`);
    }

    setContacts(processed);
  };

  const updateProfileInDb = async (id: string, updates: Partial<Contact>): Promise<{ success: boolean; error?: string }> => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Split updates between saved_speaker_profiles and contact_research
    const profileUpdates: Record<string, any> = {};
    const researchUpdates: Record<string, any> = {};
    let hasProfileUpdates = false;
    let hasResearchUpdates = false;

    // Map to saved_speaker_profiles
    if (updates.status !== undefined) { 
      profileUpdates.outreach_status = mapOutreachStatusToDb(updates.status); 
      hasProfileUpdates = true; 
    }
    if (updates.archived !== undefined) { profileUpdates.archived = updates.archived; hasProfileUpdates = true; }
    if (updates.monitorUpdates !== undefined) { profileUpdates.monitor_updates = updates.monitorUpdates; hasProfileUpdates = true; }
    if (updates.reminderDate !== undefined) { 
      profileUpdates.reminder_date = updates.reminderDate ? new Date(updates.reminderDate).toISOString() : null; 
      hasProfileUpdates = true; 
    }
    if (updates.lastContactedDate !== undefined) { profileUpdates.last_contacted_date = updates.lastContactedDate; hasProfileUpdates = true; }
    if (updates.lastCompletedDate !== undefined) { profileUpdates.last_completed_date = updates.lastCompletedDate; hasProfileUpdates = true; }
    if (updates.preferredLanguage !== undefined) { profileUpdates.preferred_language = updates.preferredLanguage; hasProfileUpdates = true; }
    if (updates.preferredTone !== undefined) { profileUpdates.preferred_tone = updates.preferredTone; hasProfileUpdates = true; }
    if (updates.preferredType !== undefined) { 
        profileUpdates.preferred_channel = updates.preferredType === 'LinkedIn' ? 'linkedin' : 
                                           updates.preferredType === 'Follow-up' ? 'other' : 'email';
        hasProfileUpdates = true; 
    }
    if (updates.notes !== undefined) { profileUpdates.notes = updates.notes; hasProfileUpdates = true; }
    if (updates.outreachStep !== undefined) { profileUpdates.outreach_step = updates.outreachStep; hasProfileUpdates = true; }
    if (updates.emailDraft !== undefined) { profileUpdates.email_draft = updates.emailDraft; hasProfileUpdates = true; }
    if (updates.linkedInBio !== undefined) { profileUpdates.linkedin_bio = updates.linkedInBio; hasProfileUpdates = true; }
    if (updates.specificGoal !== undefined) { profileUpdates.specific_goal = updates.specificGoal; hasProfileUpdates = true; }

    // Map to contact_research
    if (updates.backgroundInfo !== undefined) { researchUpdates.background_info = updates.backgroundInfo; hasResearchUpdates = true; }
    if (updates.groundingLinks !== undefined) { researchUpdates.grounding_links = updates.groundingLinks; hasResearchUpdates = true; }
    if (updates.lastResearchDate !== undefined) { researchUpdates.last_research_date = updates.lastResearchDate; hasResearchUpdates = true; }
    if (updates.hasNewIntel !== undefined) { researchUpdates.has_new_intel = updates.hasNewIntel; hasResearchUpdates = true; }
    if (updates.newIntelSummary !== undefined) { researchUpdates.new_intel_summary = updates.newIntelSummary; hasResearchUpdates = true; }

    let profileError: Error | null = null;
    let researchError: Error | null = null;

    if (hasProfileUpdates) {
        const { error } = await supabase.from('saved_speaker_profiles').update(profileUpdates).eq('id', id);
        if (error) {
          console.error('Error updating profile:', error);
          profileError = new Error(error.message);
        }
    }

    if (hasResearchUpdates) {
        // Upsert research record
        const { error } = await supabase.from('contact_research').upsert({
            contact_id: id,
            user_id: userId,
            ...researchUpdates
        }, { onConflict: 'contact_id' });
        if (error) {
          console.error('Error updating research:', error);
          researchError = new Error(error.message);
        }
    }

    if (profileError || researchError) {
      const errorMsg = [profileError?.message, researchError?.message].filter(Boolean).join('; ');
      return { success: false, error: errorMsg };
    }

    return { success: true };
  };

  // Focus name input when add mode is toggled
  useEffect(() => {
    if (isAdding && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isAdding]);

  const processNewContact = async (contact: Contact) => {
    // 1. Set to Researching
    const c1 = { ...contact, status: OutreachStatus.RESEARCHING };
    setContacts(prev => prev.map(c => c.id === contact.id ? c1 : c));
    const statusResult = await updateProfileInDb(contact.id, { status: OutreachStatus.RESEARCHING });
    if (!statusResult.success) {
      console.error('Failed to update status:', statusResult.error);
    }

    try {
      const researchResult = await researchContact(
        contact.name, 
        contact.company,
        {
          userId: userId!,
          contactId: contact.id,
          autoSave: true  // Automatically save to contact_research table
        }
      );
      
      // 2. Save Research
      const c2 = {
        ...c1,
        backgroundInfo: researchResult.text,
        groundingLinks: researchResult.chunks,
        lastResearchDate: new Date().toISOString(),
        status: OutreachStatus.DRAFTING
      };
      setContacts(prev => prev.map(c => c.id === contact.id ? c2 : c));
      const researchResult_db = await updateProfileInDb(contact.id, {
        backgroundInfo: researchResult.text,
        groundingLinks: researchResult.chunks,
        lastResearchDate: new Date().toISOString(),
        status: OutreachStatus.DRAFTING
      });
      if (!researchResult_db.success) {
        console.error('Failed to save research:', researchResult_db.error);
      }

      // 3. Generate Bio
      const lang = contact.preferredLanguage || "English";
      const bio = await generateLinkedInBio(contact.name, contact.company, researchResult.text, lang);

      const c3 = { ...c2, linkedInBio: bio };
      setContacts(prev => prev.map(c => c.id === contact.id ? c3 : c));
      await updateProfileInDb(contact.id, { linkedInBio: bio });

      // 4. Generate Draft
      const contextNotes = contact.role ? `Role: ${contact.role}` : undefined;
      const tone = contact.preferredTone || "Formal";
      const type = contact.preferredType || "Email";

      const draft = await generateEmailDraft(
        contact.name, 
        contact.company, 
        researchResult.text, 
        contextNotes,
        lang,
        tone,
        type,
        myCompanyUrl,
        undefined
      );

      const c4 = {
        ...c3,
        emailDraft: draft,
        status: OutreachStatus.READY_TO_SEND
      };
      setContacts(prev => prev.map(c => c.id === contact.id ? c4 : c));
      const draftResult = await updateProfileInDb(contact.id, {
        status: OutreachStatus.READY_TO_SEND,
        emailDraft: draft
      });
      if (!draftResult.success) {
        console.error('Failed to save draft:', draftResult.error);
        toast.error('Draft generated but failed to save. Please copy it now.');
      }

    } catch (error) {
      console.error("Automated workflow failed:", error);
      setContacts(prev => prev.map(c => 
        c.id === contact.id ? { ...c, status: OutreachStatus.NOT_STARTED } : c
      ));
      const errorResult = await updateProfileInDb(contact.id, { status: OutreachStatus.NOT_STARTED });
      if (!errorResult.success) {
        console.error('Failed to reset status:', errorResult.error);
      }
      toast.error("Automated research failed. Please try manually.");
    }
  };

  const handleRunDailyBriefing = async () => {
    setIsBriefingLoading(true);
    let updatesFound = 0;
    let movedToFocus = 0;

    const updatedContacts = await Promise.all(contacts.map(async (contact) => {
      if (contact.monitorUpdates && contact.backgroundInfo) {
        try {
          const newIntel = await checkForUpdates(contact.name, contact.company, contact.backgroundInfo);
          if (newIntel) {
            updatesFound++;
            if (contact.archived) movedToFocus++;
            
            const updates: Partial<Contact> = {
              hasNewIntel: true,
              newIntelSummary: newIntel,
              archived: false // Automatically move to Focus
            };
            
            const updateResult = await updateProfileInDb(contact.id, updates);
            if (!updateResult.success) {
              console.error(`Failed to update contact ${contact.id}:`, updateResult.error);
              return contact; // Return unchanged on error
            }
            
            return { ...contact, ...updates };
          }
        } catch (e) {
          console.error(`Failed to check updates for ${contact.name}`, e);
        }
      }
      return contact;
    }));

    setContacts(updatedContacts);
    setIsBriefingLoading(false);
    
    if (updatesFound > 0) {
      const moveMsg = movedToFocus > 0 ? ` and moved ${movedToFocus} back to Focus` : '';
      toast.success(`Daily Briefing: Found new updates for ${updatesFound} contact(s)${moveMsg}!`);
    } else {
      toast.info("Daily Briefing: No significant new updates found.");
    }
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactCompany.trim() || !userId) return;

    // Use the existing API for consistency
    try {
        const response = await fetch("/api/profiles/saved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              speaker_data: {
                name: newContactName,
                org: newContactCompany,
                organization: newContactCompany,
                title: newContactRole || null,
              },
              enhanced_data: {
                name: newContactName,
                organization: newContactCompany,
                title: newContactRole || null,
              },
            }),
        });
    
        const data = await response.json();
    
        if (!response.ok || !data.success) {
            throw new Error(data.error || "Failed to add contact");
        }

        // The API creates the profile. Now we update it with outreach specific fields.
        const newId = data.data?.id || data.profile?.id;
        if (!newId) {
          throw new Error("Failed to get new contact ID");
        }
        
        // Update with outreach-specific fields in one call
        await updateProfileInDb(newId, {
            status: OutreachStatus.NOT_STARTED,
            monitorUpdates: true,
            preferredLanguage: newContactLang,
            preferredTone: newContactTone,
            preferredType: 'Email' as OutreachType,
            outreachStep: 0
        });

        // Fetch the newly created contact once
        const { data: newProfile, error: fetchError } = await supabase
          .from('saved_speaker_profiles')
          .select('*, contact_research(*)')
          .eq('id', newId)
          .single();
        
        if (fetchError || !newProfile) {
          throw new Error(fetchError?.message || "Failed to fetch new contact");
        }

        const newContact = savedProfileToContact({
          ...newProfile,
          contact_research: Array.isArray(newProfile.contact_research) 
            ? newProfile.contact_research[0] 
            : newProfile.contact_research
        });
        
        // Add to local state immediately for better UX
        setContacts(prev => [...prev, newContact]);
        
        // Start async research process (doesn't block UI)
        processNewContact(newContact);

        // Reset Form
        setNewContactName('');
        setNewContactCompany('');
        setNewContactRole('');
        if (nameInputRef.current) nameInputRef.current.focus();

    } catch (error) {
        console.error("Failed to add contact", error);
        toast.error("Failed to add contact");
    }
  };

  const handleCompleteOutreach = async (contact: Contact) => {
    // 3-7-30 CADENCE LOGIC
    let nextDays = 3;
    if (contact.outreachStep === 1) nextDays = 7;
    if (contact.outreachStep >= 2) nextDays = 30;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + nextDays);
    const reminderDate = nextDate.toISOString().split('T')[0];

    const updates: Partial<Contact> = {
      status: OutreachStatus.SENT,
      archived: true, // Move to history/waiting
      lastContactedDate: new Date().toISOString(),
      lastCompletedDate: new Date().toISOString(),
      outreachStep: contact.outreachStep + 1,
      reminderDate: reminderDate,
      // Update preferences for next time based on step
      preferredType: contact.outreachStep === 1 ? 'Follow-up' : (contact.outreachStep === 2 ? 'Email' : contact.preferredType)
    };

    setContacts(contacts.map(c => c.id === contact.id ? { ...c, ...updates } : c));
    const result = await updateProfileInDb(contact.id, updates);
    if (result.success) {
      toast.success("Outreach marked complete. Contact snoozed.");
    } else {
      toast.error(result.error || "Failed to update contact");
      // Reload to get correct state
      if (userId) await loadContacts(userId);
    }
  };
  
  const handleCopyDraft = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopySuccessId(id);
    setTimeout(() => setCopySuccessId(null), 2000);
    toast.success("Draft copied to clipboard");
  };

  const handleUpdateContact = async (updated: Contact) => {
    // Optimistic update
    setContacts(contacts.map(c => c.id === updated.id ? updated : c));
    if (selectedContact?.id === updated.id) {
        setSelectedContact(updated);
    }
    
    // Persist to DB
    const result = await updateProfileInDb(updated.id, updated);
    if (!result.success) {
      // Rollback on error - reload from DB
      if (userId) {
        await loadContacts(userId);
      }
      toast.error(result.error || 'Failed to update contact');
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (window.confirm("Delete this contact permanently?")) {
      setContacts(contacts.filter(c => c.id !== id));
      if (selectedContact?.id === id) setSelectedContact(null);
      
      await supabase.from('saved_speaker_profiles').delete().eq('id', id);
      toast.success("Contact deleted");
    }
  };

  const handleArchiveContact = async (contact: Contact) => {
    const updates = { archived: true, monitorUpdates: false };
    handleUpdateContact({ ...contact, ...updates });
  };

  const handleRestoreContact = async (contact: Contact) => {
    const updates = { archived: false, monitorUpdates: true };
    handleUpdateContact({ ...contact, ...updates });
  };

  // FILTERING & SORTING
  const activeContacts = contacts
    .filter(c => !c.archived)
    .filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.company.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (filterDue) {
        const today = new Date().toISOString().split('T')[0];
        if (c.reminderDate) {
          const reminderDateStr = c.reminderDate.includes('T') 
            ? c.reminderDate.split('T')[0] 
            : c.reminderDate;
          return reminderDateStr <= today || c.hasNewIntel;
        }
        return c.hasNewIntel;
      }
      return true;
    });

  const archivedContacts = contacts.filter(c => c.archived);
  
  // Sorting: Due items first, then by creation
  activeContacts.sort((a, b) => {
    const dateA = a.reminderDate ? a.reminderDate : '9999-12-31';
    const dateB = b.reminderDate ? b.reminderDate : '9999-12-31';
    
    const isADue = (dateA <= new Date().toISOString().split('T')[0]) || a.hasNewIntel;
    const isBDue = (dateB <= new Date().toISOString().split('T')[0]) || b.hasNewIntel;
    
    if (isADue && !isBDue) return -1;
    if (!isADue && isBDue) return 1;
    return 0; // Keep add order otherwise
  });

  // History Grouping
  archivedContacts.sort((a, b) => (new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()));
  const groupedHistory = archivedContacts.reduce((acc, contact) => {
    const date = contact.createdAt ? new Date(contact.createdAt) : new Date();
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    const key = `Week of ${startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(contact);
    return acc;
  }, {} as Record<string, Contact[]>);

  // WEEKLY GOAL
  const currentWeekNumber = getWeekNumber(new Date());
  const completedThisWeek = contacts.filter(c => {
    if (!c.lastCompletedDate) return false;
    const completedWeek = getWeekNumber(new Date(c.lastCompletedDate));
    return completedWeek === currentWeekNumber;
  }).length;

  const progress = Math.min((completedThisWeek / weeklyGoalTarget) * 100, 100);

  // Step Labels
  const getStepLabel = (step: number) => {
    switch(step) {
      case 0: return "Initial";
      case 1: return "Bump";
      case 2: return "Value Add";
      case 3: return "Nurture";
      default: return `Step ${step}`;
    }
  };

  if (!isLoaded) return (
    <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-8">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out forwards; }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
      `}} />
      
      {/* Header Section within the Module */}
      <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-sm shadow-indigo-200">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Outreach Orbit</h2>
              <p className="text-sm text-slate-500">AI-powered contact research and engagement</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {activeTab === 'focus' && (
              <div className="flex items-center gap-4 text-sm text-slate-500 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Weekly Goal</span>
                  <span className="text-indigo-600 font-bold">{completedThisWeek} / {weeklyGoalTarget} Actions</span>
                </div>
                <div className="w-10 h-10 relative flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-200" />
                      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="transparent" 
                        strokeDasharray={100} 
                        strokeDashoffset={100 - (100 * progress) / 100} 
                        className="text-indigo-600 transition-all duration-1000 ease-out" 
                      />
                    </svg>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="text-slate-400 hover:text-indigo-600 transition-colors p-2 hover:bg-slate-50 rounded-full"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
      </div>

        
        {/* Tab Navigation */}
        <div className="flex gap-6 border-b border-slate-200 mb-8">
           <button 
             onClick={() => setActiveTab('focus')}
             className={`pb-4 px-2 text-sm font-medium transition-all relative ${activeTab === 'focus' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
           >
             Active Contacts
             {activeTab === 'focus' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />}
           </button>
           <button 
             onClick={() => setActiveTab('history')}
             className={`pb-4 px-2 text-sm font-medium transition-all relative ${activeTab === 'history' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
           >
             History & Archives
             {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />}
           </button>
        </div>

        {/* ACTIVE FOCUS TAB */}
        {activeTab === 'focus' && (
          <div className="animate-fade-in">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Filter contacts..." 
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setFilterDue(!filterDue)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 ${filterDue ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  <Filter className="w-4 h-4" /> Due Only
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunDailyBriefing}
                  disabled={isBriefingLoading}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-all text-sm font-medium disabled:opacity-50"
                >
                  {isBriefingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {isBriefingLoading ? 'Scanning...' : 'Briefing'}
                </button>

                <button 
                  onClick={() => setIsAdding(!isAdding)}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all shadow-sm text-sm font-medium ${isAdding ? 'bg-slate-200 text-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {isAdding ? 'Close' : 'Add Contact'}
                </button>
              </div>
            </div>

            {/* Quick Add Row */}
            {isAdding && (
               <div className="mb-6 bg-indigo-50/50 rounded-xl border border-indigo-100 p-4 animate-fade-in-down">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-3 flex items-center gap-2">
                     <Plus className="w-4 h-4" /> Quick Add New Contact
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                     <div className="md:col-span-3">
                        <input ref={nameInputRef} type="text" placeholder="Name" className="w-full px-3 py-2 text-sm border rounded-md" value={newContactName} onChange={e => setNewContactName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddContact()} />
                     </div>
                     <div className="md:col-span-3">
                        <input type="text" placeholder="Company" className="w-full px-3 py-2 text-sm border rounded-md" value={newContactCompany} onChange={e => setNewContactCompany(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddContact()} />
                     </div>
                     <div className="md:col-span-2">
                        <select className="w-full px-3 py-2 text-sm border rounded-md" value={newContactLang} onChange={(e: any) => setNewContactLang(e.target.value)}><option>English</option><option>German</option></select>
                     </div>
                     <div className="md:col-span-2">
                        <select className="w-full px-3 py-2 text-sm border rounded-md" value={newContactTone} onChange={(e: any) => setNewContactTone(e.target.value)}><option>Formal</option><option>Informal</option></select>
                     </div>
                     <div className="md:col-span-2">
                        <button onClick={handleAddContact} className="w-full py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">Add</button>
                     </div>
                  </div>
               </div>
            )}

            {/* Main Table View */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Status / Step</th>
                      <th className="px-6 py-4">Next Action</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeContacts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                           <LayoutGrid className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                           <p>No active contacts found. Add one to get started!</p>
                        </td>
                      </tr>
                    ) : (
                      activeContacts.map(contact => {
                         // @ts-ignore
                         const isDue = (contact.reminderDate && contact.reminderDate.split('T')[0] <= new Date().toISOString().split('T')[0]) || contact.hasNewIntel;
                         
                         return (
                          <tr key={contact.id} onClick={() => setSelectedContact(contact)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900">{contact.name}</div>
                              <div className="text-slate-500 text-xs flex items-center gap-1"><Globe className="w-3 h-3" /> {contact.company}</div>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex flex-col gap-1.5 items-start">
                                 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${isDue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {isDue ? <Calendar className="w-3 h-3" /> : <List className="w-3 h-3" />}
                                    {getStepLabel(contact.outreachStep)}
                                 </span>
                                 {contact.status === OutreachStatus.DRAFTING && <span className="text-[10px] text-indigo-600">Drafting...</span>}
                                 {contact.status === OutreachStatus.RESEARCHING && <span className="text-[10px] text-indigo-600">Researching...</span>}
                                 {contact.hasNewIntel && <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1"><Zap className="w-3 h-3" /> New Intel</span>}
                               </div>
                            </td>
                            <td className="px-6 py-4">
                               <div className="text-slate-600 text-xs">
                                  {isDue ? (
                                    <span className="text-red-600 font-medium">Due Today</span>
                                  ) : contact.reminderDate ? (
                                    <span>Due {new Date(contact.reminderDate).toLocaleDateString()}</span>
                                  ) : (
                                    <span>No date set</span>
                                  )}
                               </div>
                               <div className="text-slate-400 text-[10px] mt-0.5">
                                 {contact.emailDraft ? 'Draft ready' : 'Needs draft'}
                               </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                               {contact.emailDraft && (
                                  <button
                                    onClick={(e) => handleCopyDraft(e, contact.emailDraft!, contact.id)}
                                    className={`p-2 rounded-full border transition-all ${
                                       copySuccessId === contact.id
                                       ? 'border-green-500 text-green-600 bg-green-50'
                                       : 'border-slate-200 text-slate-400 hover:border-indigo-500 hover:text-indigo-500 hover:bg-white'
                                    }`}
                                    title="Copy Draft"
                                  >
                                     {copySuccessId === contact.id ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                  </button>
                               )}
                               <button
                                 onClick={(e) => { e.stopPropagation(); handleCompleteOutreach(contact); }}
                                 className={`p-2 rounded-full border transition-all ${
                                    isDue 
                                    ? 'border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white bg-indigo-50' 
                                    : 'border-slate-300 text-slate-300 hover:border-indigo-500 hover:text-indigo-500'
                                }`}
                                 title="Mark Complete & Snooze"
                               >
                                 <Check className="w-5 h-5" />
                               </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
           <div className="animate-fade-in">
             <div className="mb-6 flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Outreach History</h1>
                  <p className="text-slate-500 text-sm">Archived contacts waiting for next steps.</p>
                </div>
             </div>

             {Object.keys(groupedHistory).length === 0 ? (
               <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="w-12 h-12 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <History className="w-6 h-6" />
                  </div>
                  <p className="text-slate-500">No archived contacts yet.</p>
               </div>
             ) : (
               <div className="space-y-8">
                 {Object.entries(groupedHistory).map(([week, weekContacts]) => (
                   <div key={week}>
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">{week}</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {(weekContacts as Contact[]).map(contact => (
                         <ContactCard 
                           key={contact.id} 
                           contact={contact} 
                           onClick={setSelectedContact}
                           onDelete={handleDeleteContact}
                           onRestore={handleRestoreContact}
                         />
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>
        )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
           <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-fade-in-down">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                   <Settings className="w-5 h-5 text-indigo-600" /> Settings
                 </h2>
                 <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                   <X className="w-5 h-5" />
                 </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">My Company Website</label>
                  <div className="relative">
                    <Globe className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="e.g. https://mycompany.com" 
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      value={myCompanyUrl}
                      onChange={(e) => setMyCompanyUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Weekly Goal Target</label>
                  <div className="relative">
                    <Target className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input 
                      type="number" 
                      min="1"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      value={weeklyGoalTarget}
                      onChange={(e) => setWeeklyGoalTarget(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Total completed actions per week.</p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                >
                  Save & Close
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Contact Details Modal */}
      {selectedContact && (
        <ContactModal 
          contact={selectedContact} 
          onClose={() => setSelectedContact(null)} 
          onUpdate={handleUpdateContact}
          myCompanyUrl={myCompanyUrl}
        />
      )}
    </div>
  );
};
