'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAgents } from '@/lib/hooks/useAgents';
import { AgentType, CreateAgentRequest } from '@/lib/types/agents';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { 
  Bot, 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  Sparkles,
  Mail,
  MessageSquare,
  Calendar,
  Search
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const AGENT_TYPES: Array<{
  type: AgentType;
  label: string;
  description: string;
  icon: typeof Bot;
}> = [
  {
    type: 'outreach',
    label: 'Outreach Agent',
    description: 'Drafts personalized outreach messages for contacts',
    icon: Mail
  },
  {
    type: 'followup',
    label: 'Follow-up Agent',
    description: 'Manages follow-up sequences and reminders',
    icon: MessageSquare
  },
  {
    type: 'planning',
    label: 'Planning Agent',
    description: 'Analyzes and prioritizes opportunities',
    icon: Calendar
  },
  {
    type: 'research',
    label: 'Research Agent',
    description: 'Researches contacts and opportunities',
    icon: Search
  }
];

export default function CreateAgentPage() {
  const router = useRouter();
  const { createAgent, agents } = useAgents();
  const [authReady, setAuthReady] = useState(false);
  const [selectedType, setSelectedType] = useState<AgentType | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Check if agent type already exists (only show warning, don't block)
  const checkIfTypeExists = (type: AgentType | null): boolean => {
    if (!type || agents.length === 0) return false;
    return agents.some(a => a.agent_type === type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedType) {
      setError('Please select an agent type');
      return;
    }

    // Check if this type already exists
    if (checkIfTypeExists(selectedType)) {
      setError(`You already have a ${AGENT_TYPES.find(t => t.type === selectedType)?.label}. Only one agent of each type is allowed.`);
      return;
    }

    if (!name.trim()) {
      setError('Please enter an agent name');
      return;
    }

    if (name.trim().length > 100) {
      setError('Agent name must be 100 characters or less');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: CreateAgentRequest = {
        agentType: selectedType,
        name: name.trim()
      };

      const agent = await createAgent(request);

      if (agent) {
        toast.success('Agent created successfully!');
        router.push('/dashboard');
      } else {
        setError('Failed to create agent. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create agent');
    } finally {
      setLoading(false);
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
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Create AI Agent</h1>
              <p className="mt-1 text-slate-600">
                Set up an AI agent to automate your outreach and follow-up tasks
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Agent Type Selection */}
          <div>
            <label className="mb-4 block text-sm font-semibold text-slate-900">
              Select Agent Type
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {AGENT_TYPES.map((agentType) => {
                const Icon = agentType.icon;
                const exists = checkIfTypeExists(agentType.type);
                const isSelected = selectedType === agentType.type;

                return (
                  <button
                    key={agentType.type}
                    type="button"
                    onClick={() => {
                      if (!exists) {
                        setSelectedType(agentType.type);
                        setError(null);
                      }
                    }}
                    disabled={exists}
                    className={`rounded-xl border-2 p-6 text-left transition-all ${
                      exists
                        ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`rounded-lg p-2 ${
                          isSelected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{agentType.label}</h3>
                          {exists && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                              Already exists
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{agentType.description}</p>
                      </div>
                      {isSelected && !exists && (
                        <div className="rounded-full bg-blue-600 p-1">
                          <svg
                            className="h-4 w-4 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agent Name */}
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-900">
              Agent Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Outreach Assistant"
              maxLength={100}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              {name.length}/100 characters
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={loading || !selectedType || !name.trim() || !!error}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Bot className="h-5 w-5" />
                  Create Agent
                </>
              )}
            </button>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

