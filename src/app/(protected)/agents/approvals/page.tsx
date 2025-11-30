'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOutreachDrafts } from '@/lib/hooks/useOutreachDrafts';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Mail,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DraftReviewModal } from '@/components/agents/DraftReviewModal';
import { AgentOutreachDraft } from '@/lib/types/agents';

export default function AgentApprovalsPage() {
  const router = useRouter();
  const { drafts, loading, approveDraft, rejectDraft, refresh } = useOutreachDrafts({ 
    status: 'pending_approval' 
  });
  const [authReady, setAuthReady] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<(AgentOutreachDraft & { contact?: any; opportunity?: any; agent?: any }) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setAuthReady(!!data.session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!cancelled) setAuthReady(!!session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleApprove = async (draftId: string, edits?: { subject?: string; messageBody?: string }) => {
    try {
      await approveDraft(draftId, edits);
      await refresh();
    } catch (error: any) {
      throw error; // Let modal handle the error display
    }
  };

  const handleReject = async (draftId: string, reason: string) => {
    try {
      await rejectDraft(draftId, reason);
      await refresh();
    } catch (error: any) {
      throw error; // Let modal handle the error display
    }
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-3">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Pending Approvals</h1>
              <p className="mt-1 text-slate-600">
                Review and approve outreach drafts from your AI agents
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Empty State */}
        {!loading && drafts.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">All caught up!</h3>
            <p className="mt-2 text-sm text-slate-600">
              You have no pending approvals at the moment.
            </p>
          </div>
        )}

        {/* Drafts List */}
        {!loading && drafts.length > 0 && (
          <div className="space-y-4">
            {drafts.map((draft) => {
              const contact = (draft as any).contact;
              const opportunity = (draft as any).opportunity;
              const agent = (draft as any).agent;
              
              return (
                <div
                  key={draft.id}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedDraft({ ...draft, contact, opportunity, agent })}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium text-slate-600">
                          Pending Approval
                        </span>
                        {agent && (
                          <>
                            <span className="text-slate-400">•</span>
                            <span className="text-sm text-slate-500">{agent.name}</span>
                          </>
                        )}
                      </div>
                      {contact && (
                        <div className="mb-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {contact.speaker_data?.name || 'Unknown Contact'}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {contact.speaker_data?.org || contact.speaker_data?.organization || 'No company'}
                          </p>
                        </div>
                      )}
                      {draft.subject && (
                        <p className="text-sm font-medium text-slate-700 mb-1">
                          {draft.subject}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        Channel: {draft.channel} • Created: {new Date(draft.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 rounded-lg bg-slate-50 p-4">
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-slate-700">
                      {draft.message_body}
                    </p>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDraft({ ...draft, contact, opportunity, agent });
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      Review & Approve →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Draft Review Modal */}
      {selectedDraft && (
        <DraftReviewModal
          draft={selectedDraft}
          isOpen={!!selectedDraft}
          onClose={() => setSelectedDraft(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

