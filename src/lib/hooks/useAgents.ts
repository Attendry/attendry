'use client';

import { useState, useEffect, useCallback } from 'react';
import { AIAgent, AgentStatus, CreateAgentRequest, AssignTaskRequest } from '@/lib/types/agents';

interface UseAgentsOptions {
  enabled?: boolean;
}

interface UseAgentsReturn {
  agents: AIAgent[];
  loading: boolean;
  error: string | null;
  createAgent: (request: CreateAgentRequest) => Promise<AIAgent | null>;
  updateAgent: (agentId: string, updates: { name?: string; status?: AgentStatus; config?: any }) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAgents(options: UseAgentsOptions = {}): UseAgentsReturn {
  const { enabled = true } = options;
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agents');
      const data = await response.json();

      if (!response.ok || !data.success) {
        // Ensure error is always a string
        const errorMessage = typeof data.error === 'string' 
          ? data.error 
          : data.error?.message || 'Failed to fetch agents';
        throw new Error(errorMessage);
      }

      // Ensure agents is always an array
      setAgents(Array.isArray(data.agents) ? data.agents : []);
    } catch (err: any) {
      // Ensure error message is always a string
      const errorMessage = err?.message || (typeof err === 'string' ? err : 'Failed to load agents');
      setError(errorMessage);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const createAgent = useCallback(async (request: CreateAgentRequest): Promise<AIAgent | null> => {
    try {
      const response = await fetch('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create agent');
      }

      await fetchAgents();
      return data.agent || null;
    } catch (err: any) {
      setError(err.message || 'Failed to create agent');
      return null;
    }
  }, [fetchAgents]);

  const updateAgent = useCallback(async (
    agentId: string,
    updates: { name?: string; status?: AgentStatus; config?: any }
  ): Promise<void> => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update agent');
      }

      await fetchAgents();
    } catch (err: any) {
      setError(err.message || 'Failed to update agent');
      throw err;
    }
  }, [fetchAgents]);

  const deleteAgent = useCallback(async (agentId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete agent');
      }

      await fetchAgents();
    } catch (err: any) {
      setError(err.message || 'Failed to delete agent');
      throw err;
    }
  }, [fetchAgents]);

  return {
    agents,
    loading,
    error,
    createAgent,
    updateAgent,
    deleteAgent,
    refresh: fetchAgents
  };
}


