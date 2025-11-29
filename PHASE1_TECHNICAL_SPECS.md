# Phase 1: Foundation - Technical Specifications
**Date:** 2025-01-21  
**Status:** Implementation Ready  
**Timeline:** Weeks 1-2

---

## Table of Contents

1. [Database Schema](#database-schema)
2. [TypeScript Type Definitions](#typescript-type-definitions)
3. [API Specifications](#api-specifications)
4. [Agent Core Classes](#agent-core-classes)
5. [Outreach Agent Implementation](#outreach-agent-implementation)
6. [UI Component Specifications](#ui-component-specifications)
7. [LLM Integration](#llm-integration)
8. [Integration Points](#integration-points)
9. [Testing Specifications](#testing-specifications)

---

## Database Schema

### Migration File: `20250121000001_create_ai_agent_tables.sql`

```sql
-- Phase 1: AI Agent System - Core Tables
-- Migration: 20250121000001
-- Creates tables for multi-agent system foundation

-- ============================================================================
-- Core Agent Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('outreach', 'followup', 'planning', 'research')),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'waiting_approval', 'paused', 'error')),
  config JSONB NOT NULL DEFAULT '{}',
  capabilities JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  UNIQUE(user_id, agent_type)
);

-- Indexes for ai_agents
CREATE INDEX IF NOT EXISTS idx_ai_agents_user_id ON ai_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_type ON ai_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON ai_agents(status);
CREATE INDEX IF NOT EXISTS idx_ai_agents_user_type ON ai_agents(user_id, agent_type);

-- RLS policies for ai_agents
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agents" ON ai_agents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agents" ON ai_agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents" ON ai_agents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents" ON ai_agents
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Agent Tasks Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  input_data JSONB NOT NULL,
  output_data JSONB,
  requires_approval BOOLEAN DEFAULT false,
  approved_by_user BOOLEAN,
  approved_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for agent_tasks
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_requires_approval ON agent_tasks(requires_approval) WHERE requires_approval = true;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_assigned_at ON agent_tasks(assigned_at DESC);

-- RLS policies for agent_tasks
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent tasks" ON agent_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_tasks.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own agent tasks" ON agent_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_tasks.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own agent tasks" ON agent_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_tasks.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Agent Messages Table (for Phase 3, but created now for schema consistency)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  to_agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('request', 'response', 'notification', 'escalation')),
  payload JSONB NOT NULL,
  requires_response BOOLEAN DEFAULT false,
  response_to_id UUID REFERENCES agent_messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

-- Indexes for agent_messages
CREATE INDEX IF NOT EXISTS idx_agent_messages_from ON agent_messages(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_type ON agent_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_unread ON agent_messages(to_agent_id, read_at) WHERE read_at IS NULL;

-- RLS policies for agent_messages
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent messages" ON agent_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE (ai_agents.id = agent_messages.from_agent_id OR ai_agents.id = agent_messages.to_agent_id)
      AND ai_agents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Agent Outreach Drafts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_outreach_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES saved_speaker_profiles(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES user_opportunities(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'other')),
  subject TEXT,
  message_body TEXT NOT NULL,
  personalization_context JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  rejection_reason TEXT
);

-- Indexes for agent_outreach_drafts
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_agent_id ON agent_outreach_drafts(agent_id);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_contact_id ON agent_outreach_drafts(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_opportunity_id ON agent_outreach_drafts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_status ON agent_outreach_drafts(status);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_pending_approval ON agent_outreach_drafts(agent_id, status) WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_created ON agent_outreach_drafts(created_at DESC);

-- RLS policies for agent_outreach_drafts
ALTER TABLE agent_outreach_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own outreach drafts" ON agent_outreach_drafts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_outreach_drafts.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own outreach drafts" ON agent_outreach_drafts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_outreach_drafts.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own outreach drafts" ON agent_outreach_drafts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_outreach_drafts.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Agent Activity Log Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_activity_log
CREATE INDEX IF NOT EXISTS idx_activity_log_agent_id ON agent_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_task_id ON agent_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON agent_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON agent_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_agent_created ON agent_activity_log(agent_id, created_at DESC);

-- RLS policies for agent_activity_log
ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent activity" ON agent_activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_activity_log.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Agent Performance Metrics Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,
  response_rate DECIMAL(5,2),
  average_response_time_hours DECIMAL(10,2),
  opportunities_identified INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, metric_date)
);

-- Indexes for agent_performance_metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent_id ON agent_performance_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_date ON agent_performance_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent_date ON agent_performance_metrics(agent_id, metric_date DESC);

-- RLS policies for agent_performance_metrics
ALTER TABLE agent_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent metrics" ON agent_performance_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_performance_metrics.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to update agent last_active_at
CREATE OR REPLACE FUNCTION update_agent_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_agents
  SET last_active_at = NOW()
  WHERE id = NEW.agent_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_active_at on task creation/update
CREATE TRIGGER update_agent_last_active_on_task
  AFTER INSERT OR UPDATE ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_last_active();

-- Function to log agent activity
CREATE OR REPLACE FUNCTION log_agent_activity(
  p_agent_id UUID,
  p_task_id UUID,
  p_action_type TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO agent_activity_log (agent_id, task_id, action_type, description, metadata)
  VALUES (p_agent_id, p_task_id, p_action_type, p_description, p_metadata)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;
```

---

## TypeScript Type Definitions

### File: `src/lib/types/agents.ts`

```typescript
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
  config: Partial<AgentConfig>;
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
```

---

## API Specifications

### 1. Agent Management APIs

#### `POST /api/agents/create`
**Purpose:** Create a new AI agent instance

**Request:**
```typescript
{
  agentType: 'outreach' | 'followup' | 'planning' | 'research',
  name: string,
  config?: Partial<AgentConfig>
}
```

**Response:**
```typescript
{
  success: boolean,
  agent?: AIAgent,
  error?: string
}
```

**Implementation:** `src/app/api/agents/create/route.ts`

**Validation:**
- `agentType` must be valid AgentType
- `name` must be 1-100 characters
- User can only have one agent of each type
- Config must match agent type requirements

**Error Cases:**
- 400: Invalid agent type or config
- 409: Agent of this type already exists
- 401: Not authenticated

---

#### `GET /api/agents`
**Purpose:** Get all user's agents

**Response:**
```typescript
{
  success: boolean,
  agents: AIAgent[],
  error?: string
}
```

**Query Parameters:**
- `agentType?: AgentType` - Filter by type
- `status?: AgentStatus` - Filter by status

**Implementation:** `src/app/api/agents/route.ts`

---

#### `GET /api/agents/:agentId`
**Purpose:** Get specific agent details

**Response:**
```typescript
{
  success: boolean,
  agent?: AIAgent,
  error?: string
}
```

**Implementation:** `src/app/api/agents/[agentId]/route.ts`

---

#### `PATCH /api/agents/:agentId`
**Purpose:** Update agent configuration or status

**Request:**
```typescript
{
  name?: string,
  status?: AgentStatus,
  config?: Partial<AgentConfig>
}
```

**Response:**
```typescript
{
  success: boolean,
  agent?: AIAgent,
  error?: string
}
```

**Implementation:** `src/app/api/agents/[agentId]/route.ts`

---

#### `DELETE /api/agents/:agentId`
**Purpose:** Delete an agent (cascades to tasks, drafts, etc.)

**Response:**
```typescript
{
  success: boolean,
  error?: string
}
```

**Implementation:** `src/app/api/agents/[agentId]/route.ts`

---

### 2. Task Management APIs

#### `POST /api/agents/:agentId/tasks/assign`
**Purpose:** Assign a task to an agent

**Request:**
```typescript
{
  taskType: string,
  priority?: TaskPriority,
  inputData: Record<string, any>
}
```

**Response:**
```typescript
{
  success: boolean,
  task?: AgentTask,
  error?: string
}
```

**Implementation:** `src/app/api/agents/[agentId]/tasks/assign/route.ts`

**Task Types (Phase 1):**
- `draft_outreach` - Draft an outreach message
  - Input: `DraftOutreachTaskInput`
  - Output: `DraftOutreachTaskOutput`

**Validation:**
- Agent must exist and belong to user
- Agent status must be 'active' or 'idle'
- Task type must be supported by agent
- Input data must match task type requirements

---

#### `GET /api/agents/:agentId/tasks`
**Purpose:** Get agent's tasks

**Query Parameters:**
- `status?: TaskStatus` - Filter by status
- `limit?: number` - Limit results (default: 50)
- `offset?: number` - Pagination offset

**Response:**
```typescript
{
  success: boolean,
  tasks: AgentTask[],
  total: number,
  error?: string
}
```

**Implementation:** `src/app/api/agents/[agentId]/tasks/route.ts`

---

#### `GET /api/agents/tasks/pending`
**Purpose:** Get all pending tasks across all user's agents (for approval)

**Query Parameters:**
- `agentType?: AgentType` - Filter by agent type
- `limit?: number`
- `offset?: number`

**Response:**
```typescript
{
  success: boolean,
  tasks: (AgentTask & { agent: AIAgent })[],
  total: number,
  error?: string
}
```

**Implementation:** `src/app/api/agents/tasks/pending/route.ts`

---

#### `GET /api/agents/:agentId/status`
**Purpose:** Get comprehensive agent status

**Response:**
```typescript
{
  success: boolean,
  status?: {
    agent: AIAgent,
    currentTasks: AgentTask[],
    pendingApprovals: number,
    recentActivity: AgentActivityLog[],
    performance: {
      tasksCompleted: number,
      successRate: number,
      averageResponseTime: number
    }
  },
  error?: string
}
```

**Implementation:** `src/app/api/agents/[agentId]/status/route.ts`

---

### 3. Outreach Draft APIs

#### `GET /api/agents/outreach/drafts`
**Purpose:** Get all outreach drafts (pending approval)

**Query Parameters:**
- `status?: DraftStatus` - Filter by status (default: 'pending_approval')
- `agentId?: string` - Filter by agent
- `limit?: number`
- `offset?: number`

**Response:**
```typescript
{
  success: boolean,
  drafts: (AgentOutreachDraft & {
    agent: AIAgent,
    contact: SavedSpeakerProfile,
    opportunity?: UserOpportunity
  })[],
  total: number,
  error?: string
}
```

**Implementation:** `src/app/api/agents/outreach/drafts/route.ts`

---

#### `POST /api/agents/outreach/drafts/:draftId/approve`
**Purpose:** Approve and send an outreach draft

**Request:**
```typescript
{
  edits?: {
    subject?: string,
    messageBody?: string
  }
}
```

**Response:**
```typescript
{
  success: boolean,
  draft?: AgentOutreachDraft,
  error?: string
}
```

**Implementation:** `src/app/api/agents/outreach/drafts/[draftId]/approve/route.ts`

**Actions:**
1. Update draft status to 'approved'
2. If edits provided, update draft
3. Send message via appropriate channel (email/LinkedIn)
4. Update contact's outreach_status to 'contacted'
5. Create activity log entry
6. If configured, notify follow-up agent

---

#### `POST /api/agents/outreach/drafts/:draftId/reject`
**Purpose:** Reject a draft with feedback

**Request:**
```typescript
{
  reason: string
}
```

**Response:**
```typescript
{
  success: boolean,
  error?: string
}
```

**Implementation:** `src/app/api/agents/outreach/drafts/[draftId]/reject/route.ts`

**Actions:**
1. Update draft status to 'rejected'
2. Store rejection reason
3. Create activity log entry
4. Agent can learn from rejection (future enhancement)

---

### 4. Activity & Metrics APIs

#### `GET /api/agents/:agentId/activity`
**Purpose:** Get agent activity log

**Query Parameters:**
- `limit?: number` (default: 50)
- `offset?: number`
- `actionType?: string` - Filter by action type

**Response:**
```typescript
{
  success: boolean,
  activities: AgentActivityLog[],
  total: number,
  error?: string
}
```

**Implementation:** `src/app/api/agents/[agentId]/activity/route.ts`

---

#### `GET /api/agents/:agentId/metrics`
**Purpose:** Get agent performance metrics

**Query Parameters:**
- `startDate?: string` - ISO date string
- `endDate?: string` - ISO date string
- `groupBy?: 'day' | 'week' | 'month'`

**Response:**
```typescript
{
  success: boolean,
  metrics: AgentPerformanceMetrics[],
  summary: {
    totalTasksCompleted: number,
    totalTasksFailed: number,
    averageResponseRate: number,
    averageResponseTime: number
  },
  error?: string
}
```

**Implementation:** `src/app/api/agents/[agentId]/metrics/route.ts`

---

## Agent Core Classes

### File: `src/lib/agents/base-agent.ts`

```typescript
import { supabaseServer } from '@/lib/supabase-server';
import { 
  AIAgent, 
  AgentTask, 
  AgentType, 
  AgentStatus,
  TaskStatus 
} from '@/lib/types/agents';

/**
 * Base class for all AI agents
 * Provides common functionality for agent lifecycle, task processing, and logging
 */
export abstract class BaseAgent {
  protected agentId: string;
  protected agentType: AgentType;
  protected config: Record<string, any>;
  protected supabase: ReturnType<typeof supabaseServer>;

  constructor(agentId: string) {
    this.agentId = agentId;
    this.supabase = supabaseServer();
  }

  /**
   * Initialize agent (load from database)
   */
  async initialize(): Promise<void> {
    const { data: agent, error } = await this.supabase
      .from('ai_agents')
      .select('*')
      .eq('id', this.agentId)
      .single();

    if (error || !agent) {
      throw new Error(`Failed to load agent: ${error?.message}`);
    }

    this.agentType = agent.agent_type as AgentType;
    this.config = agent.config as Record<string, any>;
  }

  /**
   * Process a task (implemented by subclasses)
   */
  abstract processTask(task: AgentTask): Promise<{
    success: boolean;
    output?: Record<string, any>;
    requiresApproval?: boolean;
    error?: string;
  }>;

  /**
   * Update agent status
   */
  protected async updateStatus(status: AgentStatus): Promise<void> {
    const { error } = await this.supabase
      .from('ai_agents')
      .update({ status, last_active_at: new Date().toISOString() })
      .eq('id', this.agentId);

    if (error) {
      throw new Error(`Failed to update agent status: ${error.message}`);
    }
  }

  /**
   * Log agent activity
   */
  protected async logActivity(
    actionType: string,
    description: string,
    taskId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const { error } = await this.supabase.rpc('log_agent_activity', {
      p_agent_id: this.agentId,
      p_task_id: taskId || null,
      p_action_type: actionType,
      p_description: description,
      p_metadata: metadata || {}
    });

    if (error) {
      console.error('Failed to log activity:', error);
      // Don't throw - logging failure shouldn't break agent
    }
  }

  /**
   * Update task status
   */
  protected async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    output?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      ...(status === 'in_progress' && { started_at: new Date().toISOString() }),
      ...(status === 'completed' && { 
        completed_at: new Date().toISOString(),
        output_data: output 
      }),
      ...(status === 'failed' && { 
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
    };

    const { error } = await this.supabase
      .from('agent_tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }
  }

  /**
   * Get pending tasks for this agent
   */
  async getPendingTasks(): Promise<AgentTask[]> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('agent_id', this.agentId)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('assigned_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get pending tasks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Process next pending task
   */
  async processNextTask(): Promise<boolean> {
    const tasks = await this.getPendingTasks();
    if (tasks.length === 0) {
      return false;
    }

    const task = tasks[0];
    await this.updateTaskStatus(task.id, 'in_progress');
    await this.updateStatus('active');

    try {
      await this.logActivity('task_started', `Started processing task: ${task.task_type}`, task.id);
      
      const result = await this.processTask(task);
      
      if (result.success) {
        await this.updateTaskStatus(task.id, 'completed', result.output);
        await this.logActivity('task_completed', `Completed task: ${task.task_type}`, task.id, result.output);
        
        // Update metrics
        await this.updateMetrics('task_completed');
      } else {
        await this.updateTaskStatus(task.id, 'failed', undefined, result.error);
        await this.logActivity('task_failed', `Failed task: ${task.task_type} - ${result.error}`, task.id);
        await this.updateMetrics('task_failed');
      }

      // Check if more tasks
      const remainingTasks = await this.getPendingTasks();
      if (remainingTasks.length === 0) {
        await this.updateStatus('idle');
      }

      return true;
    } catch (error: any) {
      await this.updateTaskStatus(task.id, 'failed', undefined, error.message);
      await this.logActivity('task_error', `Error processing task: ${error.message}`, task.id);
      await this.updateStatus('error');
      throw error;
    }
  }

  /**
   * Update performance metrics
   */
  private async updateMetrics(event: 'task_completed' | 'task_failed' | 'message_sent' | 'response_received'): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get or create today's metrics
    const { data: existing } = await this.supabase
      .from('agent_performance_metrics')
      .select('*')
      .eq('agent_id', this.agentId)
      .eq('metric_date', today)
      .single();

    const updates: any = {};
    
    if (event === 'task_completed') {
      updates.tasks_completed = (existing?.tasks_completed || 0) + 1;
    } else if (event === 'task_failed') {
      updates.tasks_failed = (existing?.tasks_failed || 0) + 1;
    } else if (event === 'message_sent') {
      updates.messages_sent = (existing?.messages_sent || 0) + 1;
    } else if (event === 'response_received') {
      updates.responses_received = (existing?.responses_received || 0) + 1;
      // Calculate response rate
      const totalSent = (existing?.messages_sent || 0) + (event === 'message_sent' ? 1 : 0);
      if (totalSent > 0) {
        updates.response_rate = ((updates.responses_received || existing?.responses_received || 0) / totalSent) * 100;
      }
    }

    if (existing) {
      await this.supabase
        .from('agent_performance_metrics')
        .update(updates)
        .eq('id', existing.id);
    } else {
      await this.supabase
        .from('agent_performance_metrics')
        .insert({
          agent_id: this.agentId,
          metric_date: today,
          ...updates
        });
    }
  }
}
```

---

## Outreach Agent Implementation

### File: `src/lib/agents/outreach-agent.ts`

```typescript
import { BaseAgent } from './base-agent';
import { 
  AgentTask, 
  DraftOutreachTaskInput, 
  DraftOutreachTaskOutput,
  OutreachAgentConfig,
  OutreachChannel
} from '@/lib/types/agents';
import { SavedSpeakerProfile } from '@/lib/types/database';
import { LLMService } from '@/lib/services/llm-service';

/**
 * Outreach Agent
 * Handles drafting personalized outreach messages for contacts
 */
export class OutreachAgent extends BaseAgent {
  private llmService: LLMService;
  private config: OutreachAgentConfig;

  constructor(agentId: string) {
    super(agentId);
    this.llmService = new LLMService();
  }

  async initialize(): Promise<void> {
    await super.initialize();
    this.config = this.config as OutreachAgentConfig;
  }

  async processTask(task: AgentTask): Promise<{
    success: boolean;
    output?: DraftOutreachTaskOutput;
    requiresApproval?: boolean;
    error?: string;
  }> {
    if (task.task_type !== 'draft_outreach') {
      return {
        success: false,
        error: `Unsupported task type: ${task.task_type}`
      };
    }

    try {
      const input = task.input_data as DraftOutreachTaskInput;
      const draft = await this.draftOutreachMessage(input, task.id);
      
      return {
        success: true,
        output: {
          draftId: draft.id,
          subject: draft.subject || null,
          messageBody: draft.message_body,
          personalizationContext: draft.personalization_context || {}
        },
        requiresApproval: !this.config.autoApprove
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Draft an outreach message using LLM
   */
  private async draftOutreachMessage(
    input: DraftOutreachTaskInput,
    taskId: string
  ): Promise<any> {
    // Gather context
    const contact = await this.getContact(input.contactId);
    const opportunity = input.opportunityId 
      ? await this.getOpportunity(input.opportunityId)
      : null;
    const accountIntel = contact.speaker_data.org 
      ? await this.getAccountIntelligence(contact.speaker_data.org)
      : null;
    const historicalOutreach = await this.getHistoricalOutreach(input.contactId);

    // Build LLM prompt
    const prompt = this.buildOutreachPrompt({
      contact,
      opportunity,
      accountIntel,
      historicalOutreach,
      channel: input.channel,
      tone: this.config.messageTone
    });

    // Call LLM
    const llmResponse = await this.llmService.generateOutreachMessage(prompt);
    
    // Parse response
    const { subject, messageBody, reasoning } = this.parseLLMResponse(llmResponse, input.channel);

    // Store draft
    const { data: draft, error } = await this.supabase
      .from('agent_outreach_drafts')
      .insert({
        agent_id: this.agentId,
        task_id: taskId,
        contact_id: input.contactId,
        opportunity_id: input.opportunityId || null,
        channel: input.channel,
        subject: input.channel === 'email' ? subject : null,
        message_body: messageBody,
        personalization_context: {
          reasoning,
          keyPoints: this.extractKeyPoints(contact, opportunity, accountIntel),
          tone: this.config.messageTone,
          channel: input.channel
        },
        status: this.config.autoApprove ? 'approved' : 'pending_approval'
      })
      .select()
      .single();

    if (error || !draft) {
      throw new Error(`Failed to create draft: ${error?.message}`);
    }

    await this.logActivity(
      'draft_created',
      `Created outreach draft for ${contact.speaker_data.name}`,
      taskId,
      { draftId: draft.id, channel: input.channel }
    );

    // Update metrics
    await this.updateMetrics('message_sent');

    return draft;
  }

  /**
   * Build LLM prompt for outreach message
   */
  private buildOutreachPrompt(context: {
    contact: SavedSpeakerProfile;
    opportunity: any | null;
    accountIntel: any | null;
    historicalOutreach: any[];
    channel: OutreachChannel;
    tone: string;
  }): string {
    const { contact, opportunity, accountIntel, historicalOutreach, channel, tone } = context;
    
    let prompt = `Draft a personalized ${channel} outreach message for ${contact.speaker_data.name}.\n\n`;

    // Contact information
    prompt += `CONTACT INFORMATION:\n`;
    prompt += `- Name: ${contact.speaker_data.name}\n`;
    if (contact.enhanced_data.title) {
      prompt += `- Title: ${contact.enhanced_data.title}\n`;
    }
    if (contact.speaker_data.org) {
      prompt += `- Organization: ${contact.speaker_data.org}\n`;
    }
    if (contact.enhanced_data.bio) {
      prompt += `- Bio: ${contact.enhanced_data.bio.substring(0, 200)}...\n`;
    }
    prompt += `\n`;

    // Opportunity context
    if (opportunity) {
      prompt += `EVENT CONTEXT:\n`;
      prompt += `- Event: ${opportunity.event?.title || 'Unknown'}\n`;
      if (opportunity.event?.starts_at) {
        prompt += `- Date: ${new Date(opportunity.event.starts_at).toLocaleDateString()}\n`;
      }
      if (opportunity.event?.location) {
        prompt += `- Location: ${opportunity.event.location}\n`;
      }
      prompt += `\n`;
    }

    // Account intelligence
    if (accountIntel) {
      prompt += `ACCOUNT CONTEXT:\n`;
      if (accountIntel.recentActivity) {
        prompt += `- Recent activity: ${accountIntel.recentActivity}\n`;
      }
      if (accountIntel.industry) {
        prompt += `- Industry: ${accountIntel.industry}\n`;
      }
      prompt += `\n`;
    }

    // Historical outreach
    if (historicalOutreach.length > 0) {
      prompt += `PREVIOUS OUTREACH:\n`;
      historicalOutreach.slice(0, 3).forEach((outreach, idx) => {
        prompt += `${idx + 1}. ${outreach.channel} - ${outreach.status} on ${new Date(outreach.created_at).toLocaleDateString()}\n`;
      });
      prompt += `\n`;
    }

    // Requirements
    prompt += `REQUIREMENTS:\n`;
    prompt += `- Tone: ${tone}\n`;
    prompt += `- Channel: ${channel}\n`;
    if (channel === 'email') {
      prompt += `- Include a clear, compelling subject line\n`;
    }
    prompt += `- Reference specific context (event, role, company)\n`;
    prompt += `- Include clear value proposition\n`;
    prompt += `- Call-to-action for next step\n`;
    prompt += `- Keep message concise (2-3 paragraphs max)\n`;
    prompt += `- Professional but warm\n`;
    prompt += `\n`;

    prompt += `Generate the ${channel === 'email' ? 'subject line and ' : ''}message body. Format as JSON:\n`;
    prompt += `{\n`;
    if (channel === 'email') {
      prompt += `  "subject": "Subject line here",\n`;
    }
    prompt += `  "messageBody": "Message body here",\n`;
    prompt += `  "reasoning": "Brief explanation of personalization approach"\n`;
    prompt += `}\n`;

    return prompt;
  }

  /**
   * Parse LLM response
   */
  private parseLLMResponse(response: string, channel: OutreachChannel): {
    subject: string | null;
    messageBody: string;
    reasoning: string;
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        subject: channel === 'email' ? parsed.subject || null : null,
        messageBody: parsed.messageBody || response,
        reasoning: parsed.reasoning || 'Generated based on contact and event context'
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        subject: channel === 'email' ? 'Following up on event opportunity' : null,
        messageBody: response,
        reasoning: 'Generated based on contact and event context'
      };
    }
  }

  /**
   * Extract key points for personalization context
   */
  private extractKeyPoints(contact: SavedSpeakerProfile, opportunity: any | null, accountIntel: any | null): string[] {
    const points: string[] = [];
    
    if (contact.enhanced_data.title) {
      points.push(`Role: ${contact.enhanced_data.title}`);
    }
    if (opportunity?.event?.title) {
      points.push(`Event: ${opportunity.event.title}`);
    }
    if (accountIntel?.industry) {
      points.push(`Industry: ${accountIntel.industry}`);
    }
    
    return points;
  }

  /**
   * Helper methods to fetch data
   */
  private async getContact(contactId: string): Promise<SavedSpeakerProfile> {
    const { data, error } = await this.supabase
      .from('saved_speaker_profiles')
      .select('*')
      .eq('id', contactId)
      .single();

    if (error || !data) {
      throw new Error(`Contact not found: ${error?.message}`);
    }

    return data as SavedSpeakerProfile;
  }

  private async getOpportunity(opportunityId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('user_opportunities')
      .select(`
        *,
        event:collected_events(*)
      `)
      .eq('id', opportunityId)
      .single();

    if (error || !data) {
      throw new Error(`Opportunity not found: ${error?.message}`);
    }

    return data;
  }

  private async getAccountIntelligence(orgName: string): Promise<any | null> {
    // This would integrate with account intelligence system
    // For Phase 1, return null or basic data
    return null;
  }

  private async getHistoricalOutreach(contactId: string): Promise<any[]> {
    const { data } = await this.supabase
      .from('agent_outreach_drafts')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(5);

    return data || [];
  }
}
```

---

## LLM Integration

### File: `src/lib/services/llm-service.ts`

```typescript
/**
 * LLM Service
 * Handles communication with LLM providers (Gemini - default, OpenAI, Anthropic)
 */
export class LLMService {
  private apiKey: string;
  private provider: 'openai' | 'anthropic' | 'gemini';
  private model: string;
  private maxTokens: number;

  constructor() {
    // Support both LLM_API_KEY (generic) and GEMINI_API_KEY (existing pattern)
    this.apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || '';
    this.provider = (process.env.LLM_PROVIDER as 'openai' | 'anthropic' | 'gemini') || 'gemini';
    this.model = process.env.LLM_MODEL || this.getDefaultModel();
    this.maxTokens = parseInt(process.env.LLM_MAX_TOKENS || '1000');
  }

  private getDefaultModel(): string {
    switch (this.provider) {
      case 'openai':
        return 'gpt-4-turbo-preview';
      case 'anthropic':
        return 'claude-3-opus-20240229';
      case 'gemini':
        return process.env.GEMINI_MODEL_PATH?.replace(':generateContent', '') || 'gemini-2.5-flash';
      default:
        return 'gemini-2.5-flash';
    }
  }

  /**
   * Generate outreach message
   */
  async generateOutreachMessage(prompt: string): Promise<string> {
    if (this.provider === 'openai') {
      return await this.callOpenAI(prompt);
    } else if (this.provider === 'anthropic') {
      return await this.callAnthropic(prompt);
    } else {
      return await this.callGemini(prompt);
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert sales outreach specialist. Draft personalized, professional outreach messages that are warm, specific, and action-oriented.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async callGemini(prompt: string): Promise<string> {
    const apiKey = this.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const modelPath = process.env.GEMINI_MODEL_PATH || 'v1beta/models/gemini-2.5-flash:generateContent';
    const url = `https://generativelanguage.googleapis.com/${modelPath}?key=${apiKey}`;

    const systemInstruction = 'You are an expert sales outreach specialist. Draft personalized, professional outreach messages that are warm, specific, and action-oriented. Always respond with valid JSON when requested.';

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: this.maxTokens,
          topP: 0.8,
          topK: 10,
          responseMimeType: 'application/json'
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!content) {
      throw new Error('No content in Gemini response');
    }

    return content;
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        system: 'You are an expert sales outreach specialist. Draft personalized, professional outreach messages that are warm, specific, and action-oriented.'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }
}
```

---

## UI Component Specifications

### File: `src/components/agents/AgentDashboardPanel.tsx`

**Location:** Command Centre, below metrics section

**Props:**
```typescript
interface AgentDashboardPanelProps {
  userId: string;
}
```

**Features:**
- Display agent status cards (one per agent type)
- Show pending approval count
- Recent activity feed (last 10 activities)
- Quick actions (pause/resume agent, view details)

**Component Structure:**
```typescript
<AgentDashboardPanel>
  <AgentStatusGrid>
    <AgentStatusCard agentType="outreach" />
    <AgentStatusCard agentType="followup" />
    <AgentStatusCard agentType="planning" />
  </AgentStatusGrid>
  
  <PendingApprovalsBadge count={pendingCount} onClick={openApprovalsModal} />
  
  <RecentActivityFeed activities={recentActivities} />
</AgentDashboardPanel>
```

**State Management:**
- Use React Query for agent status fetching
- Real-time updates via polling or WebSocket (future)

---

### File: `src/components/agents/PendingApprovalsModal.tsx`

**Props:**
```typescript
interface PendingApprovalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (draftId: string, edits?: DraftEdits) => Promise<void>;
  onReject: (draftId: string, reason: string) => Promise<void>;
}
```

**Features:**
- List of all pending drafts
- Preview draft with context
- Edit capability before approval
- Bulk approve/reject
- Filter by agent, contact, opportunity

---

## Integration Points

### 1. Command Centre Integration
- Add `AgentDashboardPanel` to Command Centre layout
- Integrate with existing opportunity cards (add "Delegate to Agent" button)
- Show agent recommendations in opportunity details

### 2. Opportunity System Integration
- Link agent tasks to `user_opportunities` table
- Use opportunity data for context in outreach

### 3. Contact System Integration
- Link drafts to `saved_speaker_profiles`
- Update `outreach_status` when messages sent
- Use enhanced speaker data for personalization

### 4. Background Job Processing
- Set up job queue (Bull/BullMQ) for task processing
- Cron job to process pending tasks every 5 minutes
- Rate limiting for LLM API calls

---

## Testing Specifications

### Unit Tests
- BaseAgent class methods
- OutreachAgent message drafting
- LLM service response parsing
- API route handlers

### Integration Tests
- Agent creation flow
- Task assignment and processing
- Draft creation and approval
- Activity logging

### E2E Tests
- User creates agent → assigns task → approves draft → message sent
- Agent processes multiple tasks
- Error handling and recovery

---

This completes the Phase 1 technical specifications. Each component is ready for implementation with clear interfaces, error handling, and integration points.


