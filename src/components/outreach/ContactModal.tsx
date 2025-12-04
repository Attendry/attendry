import React, { useState, useEffect, useRef } from 'react';
import { Contact, OutreachStatus, OutreachType } from './types';
import { researchContact, generateEmailDraft, generateLinkedInBio, checkForUpdates, optimizeDraft } from '@/lib/outreach-gemini';
import { 
  X, ExternalLink, Sparkles, Send, Copy, Check, 
  Calendar, RotateCw, AlertCircle, Globe, MessageSquare, Bell, Eye, Loader2, Cloud, Share2, Target, Wand2, UserCheck
} from 'lucide-react';

interface ContactModalProps {
  contact: Contact;
  onClose: () => void;
  onUpdate: (updatedContact: Contact) => void;
  myCompanyUrl?: string;
}

export const ContactModal: React.FC<ContactModalProps> = ({ contact, onClose, onUpdate, myCompanyUrl }) => {
  const [localContact, setLocalContact] = useState<Contact>(contact);
  const [isLoading, setIsLoading] = useState(false);
  const [isBioLoading, setIsBioLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [bioCopySuccess, setBioCopySuccess] = useState(false);
  const [updateAlert, setUpdateAlert] = useState<string | null>(contact.newIntelSummary || null);

  // Draft configuration state - initialized from contact prefs
  const [draftLanguage, setDraftLanguage] = useState<'English' | 'German'>(contact.preferredLanguage || 'English');
  const [draftTone, setDraftTone] = useState<'Formal' | 'Informal'>(contact.preferredTone || 'Formal');
  const [draftType, setDraftType] = useState<OutreachType>(contact.preferredType || 'Email');

  // Refs for managing auto-save race conditions
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived state for saving indicator
  const isDirty = JSON.stringify(localContact) !== JSON.stringify(contact);

  // Sync prop changes safely
  useEffect(() => {
    // 1. If switching contacts (ID change), always update immediately and reset typing state
    if (localContact.id !== contact.id) {
        setLocalContact(contact);
        if (contact.newIntelSummary) setUpdateAlert(contact.newIntelSummary);
        setDraftLanguage(contact.preferredLanguage || 'English');
        setDraftTone(contact.preferredTone || 'Formal');
        setDraftType(contact.preferredType || 'Email');
        isTypingRef.current = false;
        return;
    }

    // 2. If user is typing (or recently typed), ignore prop updates to prevent "revert" bugs
    // where older parent state overwrites newer local state before the save round-trip completes.
    if (isTypingRef.current) return;

    // 3. Otherwise, if content differs, sync from parent (e.g. background update finished)
    if (JSON.stringify(contact) !== JSON.stringify(localContact)) {
        setLocalContact(contact);
    }
  }, [contact, localContact.id]); // Intentionally exclude localContact content to avoid loops

  // Auto-save logic
  useEffect(() => {
    if (isDirty) {
      const timer = setTimeout(() => {
        onUpdate(localContact);
      }, 1000); // 1 second debounce
      return () => clearTimeout(timer);
    }
  }, [localContact, isDirty, onUpdate]);

  const handleInputChange = (updates: Partial<Contact>) => {
    // Mark as typing
    isTypingRef.current = true;
    
    // Clear existing timeout to reset the "safe to sync" timer
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    // Set a "safe buffer" slightly longer than the auto-save debounce
    // After this time, if no more input, we allow props to sync again
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 2000);

    setLocalContact(prev => ({ ...prev, ...updates }));
  };

  const handleResearch = async () => {
    setIsLoading(true);
    setLoadingMessage("Analyzing web for background intel...");
    try {
      const result = await researchContact(localContact.name, localContact.company);
      const updated = {
        ...localContact,
        backgroundInfo: result.text,
        groundingLinks: result.chunks,
        lastResearchDate: new Date().toISOString(),
        status: localContact.status === OutreachStatus.NOT_STARTED ? OutreachStatus.RESEARCHING : localContact.status,
        hasNewIntel: false, 
        newIntelSummary: undefined
      };
      setLocalContact(updated);
      setUpdateAlert(null);
      onUpdate(updated); // Immediate save
      isTypingRef.current = false; // Allow sync
    } catch (e) {
      alert("Failed to research contact. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateBio = async () => {
    if (!localContact.backgroundInfo) return;
    setIsBioLoading(true);
    try {
       const bio = await generateLinkedInBio(localContact.name, localContact.company, localContact.backgroundInfo, draftLanguage);
       handleInputChange({ linkedInBio: bio });
    } catch (e) {
       alert("Failed to generate bio.");
    } finally {
       setIsBioLoading(false);
    }
  }

  const handleDraftEmail = async () => {
    if (!localContact.backgroundInfo) {
      alert("Please research the contact first to generate a personalized email.");
      return;
    }
    setIsLoading(true);
    setLoadingMessage(`Drafting ${draftTone} ${draftType}...`);
    try {
      const draft = await generateEmailDraft(
        localContact.name, 
        localContact.company, 
        localContact.backgroundInfo, 
        localContact.notes,
        draftLanguage,
        draftTone,
        draftType,
        myCompanyUrl,
        localContact.specificGoal // Pass specific goal
      );
      const updated = {
        ...localContact,
        emailDraft: draft,
        status: localContact.status === OutreachStatus.RESEARCHING ? OutreachStatus.DRAFTING : localContact.status,
        preferredLanguage: draftLanguage,
        preferredTone: draftTone,
        preferredType: draftType
      };
      setLocalContact(updated);
      onUpdate(updated); // Immediate save
      isTypingRef.current = false;
    } catch (e) {
      alert("Failed to generate draft.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptimize = async () => {
    if (!localContact.emailDraft) return;
    setIsLoading(true);
    setLoadingMessage("Polishing for maximum reply rate...");
    try {
        const optimized = await optimizeDraft(
            localContact.emailDraft,
            localContact.backgroundInfo || "",
            myCompanyUrl,
            localContact.specificGoal
        );
        handleInputChange({ emailDraft: optimized });
    } catch (e) {
        alert("Optimization failed.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleCheckUpdates = async () => {
    if (!localContact.backgroundInfo) return;
    setIsLoading(true);
    setLoadingMessage("Checking for new intel...");
    try {
       const newInfo = await checkForUpdates(localContact.name, localContact.company, localContact.backgroundInfo);
       if (newInfo) {
           setUpdateAlert(newInfo);
           const updated = {
             ...localContact,
             hasNewIntel: true,
             newIntelSummary: newInfo
           };
           setLocalContact(updated);
           onUpdate(updated); 
       } else {
           setUpdateAlert("No significant new updates found.");
           setTimeout(() => {
             if (!localContact.newIntelSummary) setUpdateAlert(null);
           }, 3000);
       }
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  }

  const handleStatusChange = (newStatus: OutreachStatus) => {
    const updated = { ...localContact, status: newStatus };
    if (newStatus === OutreachStatus.SENT) {
      updated.lastContactedDate = new Date().toISOString();
      if (!updated.reminderDate) {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        updated.reminderDate = nextWeek.toISOString().split('T')[0];
      }
    }
    handleInputChange(updated); // Treat as input
  };

  const copyToClipboard = () => {
    if (localContact.emailDraft) {
      navigator.clipboard.writeText(localContact.emailDraft);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };
  
  const copyBioToClipboard = () => {
    if (localContact.linkedInBio) {
      navigator.clipboard.writeText(localContact.linkedInBio);
      setBioCopySuccess(true);
      setTimeout(() => setBioCopySuccess(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{localContact.name}</h2>
            <p className="text-sm text-slate-500">{localContact.company} • {localContact.role || 'Contact'}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs font-medium flex items-center gap-1.5 transition-colors duration-300">
               {isDirty ? (
                 <span className="text-indigo-600 flex items-center gap-1">
                   <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                 </span>
               ) : (
                 <span className="text-slate-400 flex items-center gap-1">
                   <Cloud className="w-3 h-3" /> Saved
                 </span>
               )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Status Bar */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Current Status</label>
            <div className="flex items-center gap-3">
              <select 
                value={localContact.status}
                onChange={(e) => handleStatusChange(e.target.value as OutreachStatus)}
                className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
              >
                {Object.values(OutreachStatus).map(status => (
                  <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                ))}
              </select>
              {localContact.lastContactedDate && (
                <div className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                   <Calendar className="w-3 h-3" />
                   Last: {new Date(localContact.lastContactedDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Follow-up & Reminders Section */}
          <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100">
            <div className="flex items-center gap-2 mb-3">
               <Bell className="w-4 h-4 text-orange-600" />
               <h3 className="text-sm font-semibold text-orange-900">Reminders & Monitoring</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Time-based Reminder */}
              <div>
                <label className="block text-xs font-medium text-orange-800 mb-1">Time-based Follow Up</label>
                <input 
                  type="date"
                  className="w-full bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none"
                  value={localContact.reminderDate ? localContact.reminderDate.split('T')[0] : ''}
                  onChange={(e) => handleInputChange({ reminderDate: e.target.value })}
                />
              </div>

              {/* Info-based Monitoring */}
              <div>
                <label className="block text-xs font-medium text-orange-800 mb-1">Background Monitoring</label>
                <button
                  onClick={() => handleInputChange({ monitorUpdates: !localContact.monitorUpdates })}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border transition-colors ${
                    localContact.monitorUpdates 
                      ? 'bg-orange-100 border-orange-300 text-orange-800' 
                      : 'bg-white border-orange-200 text-slate-500'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    {localContact.monitorUpdates ? 'Monitoring Active' : 'Monitor Disabled'}
                  </span>
                  {localContact.monitorUpdates && <Check className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Research Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                 <Sparkles className="w-5 h-5 text-indigo-500" />
                 Background Intel
               </h3>
               <div className="flex gap-2">
                 {localContact.backgroundInfo && (
                   <button 
                    onClick={handleCheckUpdates}
                    disabled={isLoading}
                    className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 rounded-md transition-colors"
                   >
                     <RotateCw className="w-3 h-3" /> Check Updates
                   </button>
                 )}
                 <button 
                  onClick={handleResearch} 
                  disabled={isLoading}
                  className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                   {localContact.backgroundInfo ? 'Refresh Intel' : 'Generate Intel'}
                 </button>
               </div>
            </div>

            {updateAlert && (
               <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm flex gap-3 animate-fade-in">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold block mb-1">Update Alert</span>
                    {updateAlert}
                  </div>
               </div>
            )}

            {localContact.backgroundInfo ? (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                 <div className="prose prose-sm prose-slate max-w-none text-slate-600 whitespace-pre-wrap">
                   {localContact.backgroundInfo}
                 </div>
                 {localContact.groundingLinks && localContact.groundingLinks.length > 0 && (
                   <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                     {localContact.groundingLinks.map((link, idx) => (
                       <a 
                         key={idx} 
                         href={link.url} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md hover:bg-slate-200 transition-colors"
                       >
                         {link.title} <ExternalLink className="w-3 h-3" />
                       </a>
                     ))}
                   </div>
                 )}
                 {localContact.lastResearchDate && (
                   <p className="text-xs text-slate-400 mt-3 text-right">Intel updated: {new Date(localContact.lastResearchDate).toLocaleString()}</p>
                 )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                <p className="text-slate-400 text-sm">No background information yet. Click "Generate Intel" to start.</p>
              </div>
            )}
          </div>

          {/* New Professional Bio Section */}
          <div className="space-y-4">
             <div className="flex justify-between items-center">
               <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                 <UserCheck className="w-5 h-5 text-indigo-500" />
                 Professional Bio
               </h3>
               <div className="flex items-center gap-2">
                 {localContact.linkedInBio && (
                    <button 
                      onClick={copyBioToClipboard}
                      className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-600 px-3 py-1.5 bg-slate-50 rounded-md transition-colors"
                      title="Copy Bio"
                    >
                      {bioCopySuccess ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      {bioCopySuccess ? 'Copied' : 'Copy'}
                    </button>
                 )}
                 {localContact.backgroundInfo && (
                     <button 
                      onClick={handleRegenerateBio}
                      disabled={isBioLoading}
                      className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-600 px-3 py-1.5 bg-slate-50 rounded-md transition-colors"
                     >
                       {isBioLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                       Regenerate
                     </button>
                 )}
               </div>
             </div>
             
             {localContact.linkedInBio ? (
               <textarea
                 className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                 value={localContact.linkedInBio}
                 onChange={(e) => handleInputChange({ linkedInBio: e.target.value })}
               />
             ) : (
               <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-slate-400 text-sm">
                 Bio will be generated automatically after intel gathering.
               </div>
             )}
          </div>

          {/* Email Draft Section */}
          <div className="space-y-4">
             <div className="flex justify-between items-center">
               <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                 <Send className="w-5 h-5 text-indigo-500" />
                 Outreach Draft
               </h3>
               <div className="flex gap-2">
                 {localContact.emailDraft && (
                    <button
                      onClick={handleOptimize}
                      disabled={isLoading}
                      className="px-4 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
                      title="Improve reply rate with AI"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> Optimize
                    </button>
                 )}
                 <button 
                    onClick={handleDraftEmail} 
                    disabled={isLoading}
                    className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                 >
                   {localContact.emailDraft ? 'Regenerate Draft' : 'Create Draft'}
                 </button>
               </div>
             </div>

             {/* Specific Goal Input */}
             <div>
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <Target className="w-3 h-3" /> Specific Outreach Goal
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Schedule a demo, Get feedback on product, Intro partnership..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={localContact.specificGoal || ''}
                  onChange={(e) => handleInputChange({ specificGoal: e.target.value })}
                />
             </div>

             {/* Configuration Controls */}
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
               <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                 
                 {/* Language */}
                 <div className="sm:col-span-3">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      <Globe className="w-3 h-3" /> Language
                    </label>
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm h-9">
                      {['English', 'German'].map((lang) => (
                        <button 
                          key={lang}
                          onClick={() => setDraftLanguage(lang as 'English' | 'German')}
                          className={`flex-1 px-2 text-xs rounded-md transition-all font-medium ${
                            draftLanguage === lang 
                              ? 'bg-indigo-100 text-indigo-700 shadow-sm ring-1 ring-indigo-500 font-semibold' 
                              : 'text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                 </div>
                 
                 {/* Tone */}
                 <div className="sm:col-span-3">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      <MessageSquare className="w-3 h-3" /> Tone
                    </label>
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm h-9">
                      {['Formal', 'Informal'].map((t) => (
                        <button 
                          key={t}
                          onClick={() => setDraftTone(t as 'Formal' | 'Informal')}
                          className={`flex-1 px-2 text-xs rounded-md transition-all font-medium ${
                            draftTone === t 
                              ? 'bg-indigo-100 text-indigo-700 shadow-sm ring-1 ring-indigo-500 font-semibold' 
                              : 'text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                 </div>

                 {/* Channel */}
                 <div className="sm:col-span-6">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      <Share2 className="w-3 h-3" /> Channel
                    </label>
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm h-9">
                      {['Email', 'LinkedIn', 'Follow-up'].map((t) => (
                        <button 
                          key={t}
                          onClick={() => setDraftType(t as OutreachType)}
                          className={`flex-1 px-1 text-xs rounded-md transition-all font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                            draftType === t 
                              ? 'bg-indigo-100 text-indigo-700 shadow-sm ring-1 ring-indigo-500 font-semibold' 
                              : 'text-slate-500 hover:bg-slate-50'
                          }`}
                          title={t}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                 </div>
               </div>
             </div>

             {localContact.emailDraft ? (
               <div className="relative group">
                 <textarea 
                   value={localContact.emailDraft}
                   onChange={(e) => handleInputChange({ emailDraft: e.target.value })}
                   placeholder="Review and edit your generated draft here..."
                   className="w-full h-64 p-5 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y shadow-sm"
                   spellCheck={false}
                 />
                 <div className="absolute top-3 right-3 flex gap-2">
                   <button 
                     onClick={copyToClipboard}
                     className="p-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
                     title="Copy to clipboard"
                   >
                     {copySuccess ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                   </button>
                 </div>
               </div>
             ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                  <p className="text-slate-400 text-sm">No draft generated yet. Requires intel first.</p>
                </div>
             )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">My Notes</h3>
            <textarea
              className="w-full p-3 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
              placeholder="Add personal notes, specific goals for this contact..."
              value={localContact.notes || ''}
              onChange={(e) => handleInputChange({ notes: e.target.value })}
            />
          </div>

        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
             <div className="text-center">
               <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
               <p className="text-sm font-medium text-indigo-800 animate-pulse">{loadingMessage}</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

