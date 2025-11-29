/**
 * AI Agent System Type Definitions
 * Phase 1: Foundation
 */

export type AgentType = 'outreach' | 'followup' | 'planning' | 'research';

export type AgentStatus = 'idle' | 'active' | 'waiting_approval' | 'paused' | 'error';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type MessageType = 'request' | 'response' | 'notification' | 'escalation';

export type OutreachChannel = 'email' | 'linkedin' | 'other';

export type DraftStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'rejected';

// ============================================================================
// Agent Configuration Types
// ============================================================================

export interface OutreachAgentConfig {
  autoApprove: boolean;
  maxDailyOutreach: number;
  messageTone: 'professional' | 'friendly' | 'casual';
  includeEventContext: boolean;
  includeAccountIntelligence: boolean;
  notifyFollowupAgent: boolean;
  defaultFollowupDelayDays: number;
}

export interface FollowupAgentConfig {
  defaultFollowupDelayDays: number;
  maxFollowups: number;
  escalationAfterAttempts: number;
  followupTypes: ('reminder' | 'value_add' | 'escalation' | 'check_in')[];
}

export interface PlanningAgentConfig {
  minRelevanceScore: number;
  maxOpportunitiesPerDay: number;
  prioritizeBySignalStrength: boolean;
  coordinateWithOutreach: boolean;
}

export type AgentConfig = OutreachAgentConfig | FollowupAgentConfig | PlanningAgentConfig;

// ============================================================================
// Database Entity Types
// ============================================================================

export interface AIAgent {
  id: string;
  user_id: string;
  agent_type: AgentType;
  name: string;
  status: AgentStatus;
  config: AgentConfig;
  capabilities: string[];
  created_at: string;
  last_active_at: string | null;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  task_type: string;
  status: TaskStatus;
  priority: TaskPriority;
  input_data: Record<string, any>;
  output_data: Record<string, any> | null;
  requires_approval: boolean;
  approved_by_user: boolean | null;
  approved_at: string | null;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
}

export interface AgentMessage {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  message_type: MessageType;
  payload: Record<string, any>;
  requires_response: boolean;
  response_to_id: string | null;
  created_at: string;
  read_at: string | null;
  responded_at: string | null;
}

export interface AgentOutreachDraft {
  id: string;
  agent_id: string;
  task_id: string | null;
  contact_id: string;
  opportunity_id: string | null;
  channel: OutreachChannel;
  subject: string | null;
  message_body: string;
  personalization_context: Record<string, any> | null;
  status: DraftStatus;
  created_at: string;
  approved_at: string | null;
  sent_at: string | null;
  rejection_reason: string | null;
}

export interface AgentActivityLog {
  id: string;
  agent_id: string;
  task_id: string | null;
  action_type: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AgentPerformanceMetrics {
  id: string;
  agent_id: string;
  metric_date: string;
  tasks_completed: number;
  tasks_failed: number;
  messages_sent: number;
  responses_received: number;
  response_rate: number | null;
  average_response_time_hours: number | null;
  opportunities_identified: number;
  created_at: string;
}

// ============================================================================
// Task Input/Output Types
// ============================================================================

export interface DraftOutreachTaskInput {
  contactId: string;
  opportunityId?: string;
  channel: OutreachChannel;
  context?: {
    eventTitle?: string;
    eventDate?: string;
    speakerRole?: string;
    accountName?: string;
    preferredLanguage?: string;
    preferredTone?: string;
  };
}

export interface DraftOutreachTaskOutput {
  draftId: string;
  subject: string | null;
  messageBody: string;
  personalizationContext: {
    reasoning: string;
    keyPoints: string[];
    tone: string;
  };
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateAgentRequest {
  agentType: AgentType;
  name: string;
  config?: Partial<AgentConfig>;
}

export interface CreateAgentResponse {
  success: boolean;
  agent?: AIAgent;
  error?: string;
}

export interface AssignTaskRequest {
  taskType: string;
  priority?: TaskPriority;
  inputData: Record<string, any>;
}

export interface AssignTaskResponse {
  success: boolean;
  task?: AgentTask;
  error?: string;
}

export interface GetAgentStatusResponse {
  agentId: string;
  status: AgentStatus;
  currentTasks: AgentTask[];
  pendingApprovals: number;
  recentActivity: AgentActivityLog[];
  performance: {
    tasksCompleted: number;
    successRate: number;
    averageResponseTime: number;
  };
}

export interface ApproveDraftRequest {
  draftId: string;
  edits?: {
    subject?: string;
    messageBody?: string;
  };
}

export interface RejectDraftRequest {
  draftId: string;
  reason: string;
}

// ============================================================================
// Agent State Types
// ============================================================================

export interface AgentState {
  agentId: string;
  agentType: AgentType;
  status: AgentStatus;
  currentTasks: AgentTask[];
  messageQueue: AgentMessage[];
  performance: {
    tasksCompleted: number;
    successRate: number;
    averageResponseTime: number;
  };
  lastActivity: string;
}


