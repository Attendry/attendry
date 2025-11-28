'use client';

import { useState, useEffect } from 'react';
import { AgentOutreachDraft } from '@/lib/types/agents';
import { SavedSpeakerProfile } from '@/lib/types/database';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Copy, 
  Check,
  User,
  Building2,
  Mail,
  Linkedin,
  Globe,
  MessageSquare,
  Share2,
  Sparkles,
  Calendar,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface DraftReviewModalProps {
  draft: AgentOutreachDraft & {
    contact?: SavedSpeakerProfile;
    opportunity?: any;
    agent?: { name: string; id: string };
  };
  isOpen: boolean;
  onClose: () => void;
  onApprove: (draftId: string, edits?: { subject?: string; messageBody?: string }) => Promise<void>;
  onReject: (draftId: string, reason: string) => Promise<void>;
}

type OutreachChannel = 'email' | 'linkedin' | 'other';

export function DraftReviewModal({
  draft,
  isOpen,
  onClose,
  onApprove,
  onReject
}: DraftReviewModalProps) {
  const [subject, setSubject] = useState(draft.subject || '');
  const [messageBody, setMessageBody] = useState(draft.message_body || '');
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Reset state when draft changes
  useEffect(() => {
    if (isOpen && draft) {
      setSubject(draft.subject || '');
      setMessageBody(draft.message_body || '');
      setRejectReason('');
      setShowRejectModal(false);
    }
  }, [isOpen, draft]);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const edits = {
        subject: subject !== draft.subject ? subject : undefined,
        messageBody: messageBody !== draft.message_body ? messageBody : undefined
      };
      await onApprove(draft.id, Object.keys(edits).length > 0 ? edits : undefined);
      toast.success('Draft approved successfully');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve draft');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setLoading(true);
    try {
      await onReject(draft.id, rejectReason);
      toast.success('Draft rejected');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject draft');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(messageBody);
      setCopySuccess(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  if (!isOpen || !draft) return null;

  const contact = draft.contact;
  const opportunity = draft.opportunity;
  const personalizationContext = draft.personalization_context || {};
  const channel = draft.channel as OutreachChannel;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Review Draft</h2>
              <p className="mt-1 text-sm text-slate-600">
                Review and approve or reject this outreach draft
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Contact Card */}
            {contact && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="rounded-full bg-indigo-100 p-2">
                        <User className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {contact.speaker_data?.name || 'Unknown'}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Building2 className="h-4 w-4" />
                          {contact.speaker_data?.org || contact.speaker_data?.organization || 'No company'}
                        </div>
                        {contact.speaker_data?.title && (
                          <p className="text-xs text-slate-500 mt-1">{contact.speaker_data.title}</p>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/contacts?contactId=${contact.id}`}
                      className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      View full profile →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Opportunity Details */}
            {opportunity && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <h4 className="text-sm font-semibold text-slate-900">Linked Opportunity</h4>
                </div>
                <p className="text-sm text-slate-700">{opportunity.title || opportunity.name || 'Opportunity'}</p>
                {opportunity.event_date && (
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(opportunity.event_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* Personalization Reasoning */}
            {personalizationContext.reasoning && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-sm font-semibold text-indigo-900">Why this approach?</h4>
                </div>
                <p className="text-sm text-indigo-800">{personalizationContext.reasoning}</p>
                {personalizationContext.keyPoints && Array.isArray(personalizationContext.keyPoints) && (
                  <ul className="mt-2 space-y-1">
                    {personalizationContext.keyPoints.map((point: string, idx: number) => (
                      <li key={idx} className="text-xs text-indigo-700 flex items-start gap-2">
                        <span className="text-indigo-500 mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Channel Indicator */}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              {channel === 'email' && <Mail className="h-4 w-4" />}
              {channel === 'linkedin' && <Linkedin className="h-4 w-4" />}
              <span className="font-medium">Channel: {channel}</span>
              {draft.agent && (
                <>
                  <span className="text-slate-400">•</span>
                  <span>Created by {draft.agent.name}</span>
                </>
              )}
            </div>

            {/* Subject Line */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-900">
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Message Body */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-900">
                  Message
                </label>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {copySuccess ? (
                    <>
                      <Check className="h-3 w-3 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  rows={12}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                  placeholder="Message content..."
                />
              </div>
            </div>

            {/* Message Preview */}
            {channel === 'email' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-2 text-sm font-semibold text-slate-900">Email Preview</h4>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-2 border-b border-slate-200 pb-2">
                    <p className="text-xs text-slate-500">To: {contact?.speaker_data?.name || 'Contact'}</p>
                    <p className="text-xs text-slate-500">Subject: {subject || '(No subject)'}</p>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-slate-700">
                    {messageBody || '(No message)'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={loading || !messageBody.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve & Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Reject Draft</h3>
            <p className="mb-4 text-sm text-slate-600">
              Please provide a reason for rejecting this draft. This feedback will help improve future drafts.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="e.g., Tone is too casual, missing key information, incorrect contact details..."
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={loading}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={loading || !rejectReason.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Reject Draft
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

