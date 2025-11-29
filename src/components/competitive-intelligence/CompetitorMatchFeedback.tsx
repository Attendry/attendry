/**
 * Competitor Match Feedback Component
 * 
 * Enhancement 1: Allows users to provide feedback on competitor matches
 */

'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, MessageSquare } from 'lucide-react';
import { CompetitorMatch } from '@/lib/services/competitive-intelligence-service';
import { toast } from 'sonner';

interface CompetitorMatchFeedbackProps {
  match: CompetitorMatch;
  eventId: string;
  onFeedbackSubmitted?: () => void;
}

export function CompetitorMatchFeedback({
  match,
  eventId,
  onFeedbackSubmitted
}: CompetitorMatchFeedbackProps) {
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correction, setCorrection] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleFeedback = async (correct: boolean) => {
    if (submitted) return;
    
    setIsCorrect(correct);
    if (!correct) {
      setShowDetails(true);
    } else {
      await submitFeedback(correct);
    }
  };

  const submitFeedback = async (correct: boolean) => {
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/competitive-intelligence/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventId,
          competitorName: match.competitorName,
          matchedName: match.matchDetails.organization || match.matchDetails.speakerName || '',
          matchType: match.matchType,
          isCorrect: correct,
          correction: correction || undefined,
          reason: reason || undefined
        })
      });

      if (response.ok) {
        setSubmitted(true);
        onFeedbackSubmitted?.();
      } else {
        const error = await response.json();
        console.error('Failed to submit feedback:', error);
        toast.error("Failed to submit feedback", {
          description: "Please try again."
        });
        setIsCorrect(null);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error("Error submitting feedback", {
        description: "An error occurred. Please try again."
      });
      setIsCorrect(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (isCorrect === null) return;
    submitFeedback(isCorrect);
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600">
        <CheckCircle2 className="h-3 w-3" />
        <span>Thank you for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600">Is this correct?</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleFeedback(true)}
            disabled={submitting || submitted}
            className={`p-1 rounded transition-colors ${
              isCorrect === true
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } ${submitting || submitted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title="This is correct"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleFeedback(false)}
            disabled={submitting || submitted}
            className={`p-1 rounded transition-colors ${
              isCorrect === false
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } ${submitting || submitted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title="This is not correct"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showDetails && isCorrect === false && (
        <div className="space-y-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              What should this be? (optional)
            </label>
            <input
              type="text"
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              placeholder="Correct company name"
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this not a match?"
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <MessageSquare className="h-3 w-3" />
                  Submit Feedback
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowDetails(false);
                setIsCorrect(null);
                setCorrection('');
                setReason('');
              }}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

