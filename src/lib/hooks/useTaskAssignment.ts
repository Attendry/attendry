'use client';

import { useState, useCallback } from 'react';
import { AssignTaskRequest, AssignTaskResponse, AgentTask, TaskPriority } from '@/lib/types/agents';

interface UseTaskAssignmentOptions {
  agentId: string;
}

interface UseTaskAssignmentReturn {
  assignTask: (request: Omit<AssignTaskRequest, 'taskType'> & { taskType: string }) => Promise<AgentTask | null>;
  loading: boolean;
  error: string | null;
}

export function useTaskAssignment(options: UseTaskAssignmentOptions): UseTaskAssignmentReturn {
  const { agentId } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignTask = useCallback(async (
    request: Omit<AssignTaskRequest, 'taskType'> & { taskType: string }
  ): Promise<AgentTask | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agents/${agentId}/tasks/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      const data: AssignTaskResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to assign task');
      }

      return data.task || null;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to assign task';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  return {
    assignTask,
    loading,
    error
  };
}

