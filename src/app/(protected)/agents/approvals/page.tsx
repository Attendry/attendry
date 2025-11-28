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

export default function AgentApprovalsPage() {
  const router = useRouter();
  const { drafts, loading, approveDraft, rejectDraft } = useOutreachDrafts({ 
    status: 'pending_approval' 
  });
  const [authReady, setAuthReady] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

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

  const handleApprove = async (draftId: string) => {
    setProcessing(draftId);
    try {
      await approveDraft(draftId);
      toast.success('Draft approved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve draft');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (draftId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    setProcessing(draftId);
    try {
      await rejectDraft(draftId, reason);
      toast.success('Draft rejected');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject draft');
    } finally {
      setProcessing(null);
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
            href="/command-centre"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Command Centre
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
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-slate-600">
                        Pending Approval
                      </span>
                    </div>
                    {draft.subject && (
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {draft.subject}
                      </h3>
                    )}
                    <p className="mt-1 text-sm text-slate-500">
                      Channel: {draft.channel} • Created: {new Date(draft.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mb-4 rounded-lg bg-slate-50 p-4">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {draft.message_body}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleApprove(draft.id)}
                    disabled={processing === draft.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {processing === draft.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleReject(draft.id)}
                    disabled={processing === draft.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

