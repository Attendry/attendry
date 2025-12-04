import React, { useState } from 'react';
import { Contact, OutreachStatus } from './types';
import { User, Building2, ChevronRight, RefreshCw, Mail, CheckCircle, Clock, Bell, Eye, Sparkles, Archive, RotateCcw, Copy, Check } from 'lucide-react';

interface ContactCardProps {
  contact: Contact;
  onClick: (contact: Contact) => void;
  onDelete: (id: string) => void;
  onArchive?: (contact: Contact) => void;
  onRestore?: (contact: Contact) => void;
}

const statusColors: Record<OutreachStatus, string> = {
  [OutreachStatus.NOT_STARTED]: 'bg-slate-100 text-slate-600',
  [OutreachStatus.RESEARCHING]: 'bg-blue-100 text-blue-600',
  [OutreachStatus.DRAFTING]: 'bg-indigo-100 text-indigo-600',
  [OutreachStatus.READY_TO_SEND]: 'bg-amber-100 text-amber-600',
  [OutreachStatus.SENT]: 'bg-purple-100 text-purple-600',
  [OutreachStatus.REPLIED]: 'bg-green-100 text-green-600',
  [OutreachStatus.CLOSED]: 'bg-gray-100 text-gray-500 line-through',
};

const statusIcons: Record<OutreachStatus, React.ReactNode> = {
  [OutreachStatus.NOT_STARTED]: <User className="w-4 h-4" />,
  [OutreachStatus.RESEARCHING]: <RefreshCw className="w-4 h-4 animate-spin" />,
  [OutreachStatus.DRAFTING]: <Mail className="w-4 h-4" />,
  [OutreachStatus.READY_TO_SEND]: <Mail className="w-4 h-4" />,
  [OutreachStatus.SENT]: <CheckCircle className="w-4 h-4" />,
  [OutreachStatus.REPLIED]: <CheckCircle className="w-4 h-4" />,
  [OutreachStatus.CLOSED]: <Clock className="w-4 h-4" />,
};

export const ContactCard: React.FC<ContactCardProps> = ({ contact, onClick, onDelete, onArchive, onRestore }) => {
  const [copied, setCopied] = useState(false);
  const isDue = contact.reminderDate && new Date(contact.reminderDate) <= new Date();
  const hasNewIntel = contact.hasNewIntel;
  const isArchived = contact.archived;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (contact.emailDraft) {
      navigator.clipboard.writeText(contact.emailDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div 
      onClick={() => onClick(contact)}
      className={`
        bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden
        ${isDue || hasNewIntel ? 'border-orange-300 ring-1 ring-orange-100' : 'border-slate-200'}
        ${isArchived ? 'opacity-75 hover:opacity-100 bg-slate-50' : ''}
      `}
    >
      <div className={`absolute top-0 left-0 w-1 h-full transition-opacity ${isArchived ? 'bg-slate-300' : 'bg-indigo-500 opacity-0 group-hover:opacity-100'}`} />
      
      <div className="flex justify-between items-start mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[contact.status]}`}>
          {statusIcons[contact.status]}
          {contact.status.replace(/_/g, ' ')}
        </span>
        <div className="flex items-center gap-1">
           {contact.emailDraft && !isArchived && (
             <button
               onClick={handleCopy}
               className={`p-1 rounded-full transition-colors ${copied ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'} opacity-0 group-hover:opacity-100`}
               title="Copy Draft"
             >
               {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
             </button>
           )}
           {onRestore && isArchived && (
            <button 
              onClick={(e) => { e.stopPropagation(); onRestore(contact); }}
              className="text-slate-400 hover:text-indigo-500 p-1 rounded-full hover:bg-indigo-50 transition-colors"
              title="Restore to Active"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {onArchive && !isArchived && (
            <button 
              onClick={(e) => { e.stopPropagation(); onArchive(contact); }}
              className="text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-indigo-50"
              title="Archive to History"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(contact.id); }}
            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-red-50"
            title="Delete"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
        {contact.name}
      </h3>
      <div className="flex items-center gap-2 text-slate-500 mt-1 mb-4 text-sm">
        <Building2 className="w-4 h-4" />
        {contact.company}
      </div>

      {/* Reminder / Monitoring Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {hasNewIntel && !isArchived && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
            <Sparkles className="w-3 h-3" /> New Intel
          </span>
        )}
        {isDue && !isArchived && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 px-2 py-0.5 rounded">
            <Clock className="w-3 h-3" /> Follow Up Due
          </span>
        )}
        {contact.monitorUpdates && !hasNewIntel && !isArchived && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
            <Eye className="w-3 h-3" /> Monitoring
          </span>
        )}
        {contact.reminderDate && !isDue && !isArchived && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
            <Bell className="w-3 h-3" /> {new Date(contact.reminderDate).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
        <span className="text-xs text-slate-400">
           {contact.lastContactedDate 
             ? `Contacted: ${new Date(contact.lastContactedDate).toLocaleDateString()}` 
             : `Added: ${contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : 'N/A'}`}
        </span>
        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
      </div>
    </div>
  );
};

