'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Contact, OutreachStatus, OutreachType } from './types';
import { ContactCard } from './ContactCard';
import { ContactModal } from './ContactModal';
import { Plus, Rocket, LayoutGrid, Info, Check, RefreshCw, Zap, Archive, History, Settings, Globe, Search, Filter, Calendar, List, MoreHorizontal, ArrowRight, Target, X, Copy } from 'lucide-react';
import { researchContact, generateEmailDraft, generateLinkedInBio, checkForUpdates } from '@/lib/outreach-gemini';

// Simple UUID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

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

  // Load from localStorage on mount
  useEffect(() => {
    const savedContacts = localStorage.getItem('outreach-contacts');
    const savedUrl = localStorage.getItem('outreach-my-url');
    const savedGoal = localStorage.getItem('outreach-weekly-goal');

    if (savedContacts) {
        try {
            const parsed = JSON.parse(savedContacts);
            // Ensure legacy data has required fields
            const migrated = parsed.map((c: any) => ({
                ...c,
                createdAt: c.createdAt || new Date().toISOString(),
                archived: c.archived || false,
                outreachStep: c.outreachStep || 0
            }));
            setContacts(migrated);
        } catch (e) {
            console.error("Failed to parse contacts", e);
        }
    }
    if (savedUrl) setMyCompanyUrl(savedUrl);
    if (savedGoal) setWeeklyGoalTarget(parseInt(savedGoal));
    
    setIsLoaded(true);
  }, []);

  // Persistence
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('outreach-contacts', JSON.stringify(contacts));
  }, [contacts, isLoaded]);
  
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('outreach-my-url', myCompanyUrl);
  }, [myCompanyUrl, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('outreach-weekly-goal', weeklyGoalTarget.toString());
  }, [weeklyGoalTarget, isLoaded]);

  // RESURFACING LOGIC: Check for due items on mount and move them to Active
  useEffect(() => {
    if (!isLoaded) return;
    const today = new Date().toISOString().split('T')[0];
    let resurrectedCount = 0;

    setContacts(prev => prev.map(c => {
      // If archived (waiting) AND has a reminder date that is today or past
      if (c.archived && c.reminderDate && c.reminderDate <= today) {
        resurrectedCount++;
        return { ...c, archived: false }; // Move back to active
      }
      return c;
    }));
  }, [isLoaded]);

  // Focus name input when add mode is toggled
  useEffect(() => {
    if (isAdding && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isAdding]);

  const processNewContact = async (contact: Contact) => {
    setContacts(prev => prev.map(c => 
      c.id === contact.id ? { ...c, status: OutreachStatus.RESEARCHING } : c
    ));

    try {
      const researchResult = await researchContact(contact.name, contact.company);
      
      setContacts(prev => prev.map(c => {
        if (c.id === contact.id) {
          return {
            ...c,
            backgroundInfo: researchResult.text,
            groundingLinks: researchResult.chunks,
            lastResearchDate: new Date().toISOString(),
            status: OutreachStatus.DRAFTING
          };
        }
        return c;
      }));

      // Generate Bio immediately after research
      const lang = contact.preferredLanguage || "English";
      const bio = await generateLinkedInBio(contact.name, contact.company, researchResult.text, lang);

      // Store bio
      setContacts(prev => prev.map(c => {
        if (c.id === contact.id) {
          return { ...c, linkedInBio: bio };
        }
        return c;
      }));

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

      setContacts(prev => prev.map(c => {
        if (c.id === contact.id) {
          return {
            ...c,
            emailDraft: draft,
            status: OutreachStatus.READY_TO_SEND
          };
        }
        return c;
      }));

    } catch (error) {
      console.error("Automated workflow failed:", error);
      setContacts(prev => prev.map(c => 
        c.id === contact.id ? { ...c, status: OutreachStatus.NOT_STARTED } : c
      ));
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
            return {
              ...contact,
              hasNewIntel: true,
              newIntelSummary: newIntel,
              archived: false // Automatically move to Focus
            };
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
      alert(`Daily Briefing Complete: Found new updates for ${updatesFound} contact(s)${moveMsg}!`);
    } else {
      setTimeout(() => alert("Daily Briefing Complete: No significant new updates found."), 100);
    }
  };

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactCompany.trim()) return;

    const newContact: Contact = {
      id: generateId(),
      name: newContactName,
      company: newContactCompany,
      role: newContactRole,
      status: OutreachStatus.NOT_STARTED,
      monitorUpdates: true,
      createdAt: new Date().toISOString(),
      archived: false,
      preferredLanguage: newContactLang,
      preferredTone: newContactTone,
      preferredType: 'Email',
      outreachStep: 0,
    };

    setContacts(prev => [...prev, newContact]);
    processNewContact(newContact);

    setNewContactName('');
    setNewContactCompany('');
    setNewContactRole('');
    
    if (nameInputRef.current) {
        nameInputRef.current.focus();
    }
  };

  const handleCompleteOutreach = (contact: Contact) => {
    // 3-7-30 CADENCE LOGIC
    let nextDays = 3;
    if (contact.outreachStep === 1) nextDays = 7;
    if (contact.outreachStep >= 2) nextDays = 30;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + nextDays);
    const reminderDate = nextDate.toISOString().split('T')[0];

    const updated: Contact = {
      ...contact,
      status: OutreachStatus.SENT,
      archived: true, // Move to history/waiting
      lastContactedDate: new Date().toISOString(),
      lastCompletedDate: new Date().toISOString(),
      outreachStep: contact.outreachStep + 1,
      reminderDate: reminderDate
    };

    // Update preferences for next time based on step
    if (updated.outreachStep === 1) updated.preferredType = 'Follow-up'; // Bump
    if (updated.outreachStep === 2) updated.preferredType = 'Email'; // Value Add

    setContacts(contacts.map(c => c.id === contact.id ? updated : c));
  };
  
  const handleCopyDraft = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopySuccessId(id);
    setTimeout(() => setCopySuccessId(null), 2000);
  };

  const handleUpdateContact = (updated: Contact) => {
    setContacts(contacts.map(c => c.id === updated.id ? updated : c));
    if (selectedContact?.id === updated.id) {
        setSelectedContact(updated);
    }
  };

  const handleDeleteContact = (id: string) => {
    if (window.confirm("Delete this contact permanently?")) {
      setContacts(contacts.filter(c => c.id !== id));
      if (selectedContact?.id === id) setSelectedContact(null);
    }
  };

  const handleArchiveContact = (contact: Contact) => {
    handleUpdateContact({ ...contact, archived: true, monitorUpdates: false });
  };

  const handleRestoreContact = (contact: Contact) => {
    handleUpdateContact({ ...contact, archived: false, monitorUpdates: true });
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
        return (c.reminderDate && new Date(c.reminderDate) <= new Date()) || c.hasNewIntel;
      }
      return true;
    });

  const archivedContacts = contacts.filter(c => c.archived);
  
  // Sorting: Due items first, then by creation
  activeContacts.sort((a, b) => {
    const isADue = (a.reminderDate && new Date(a.reminderDate) <= new Date()) || a.hasNewIntel;
    const isBDue = (b.reminderDate && new Date(b.reminderDate) <= new Date()) || b.hasNewIntel;
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

  if (!isLoaded) return null;

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
                         const isDue = (contact.reminderDate && new Date(contact.reminderDate) <= new Date()) || contact.hasNewIntel;
                         
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

