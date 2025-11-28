# Phase 1 Implementation Checklist
**Status:** Ready to Begin  
**Timeline:** Weeks 1-2

---

## Database Setup ✅

- [x] Create migration file: `20250121000001_create_ai_agent_tables.sql`
- [ ] Run migration on development database
- [ ] Verify RLS policies work correctly
- [ ] Test helper functions (log_agent_activity, update_agent_last_active)

---

## Type Definitions

- [ ] Create `src/lib/types/agents.ts`
- [ ] Export all types for use across codebase
- [ ] Add JSDoc comments for all interfaces

---

## Core Agent Classes

- [ ] Create `src/lib/agents/base-agent.ts`
  - [ ] Implement `initialize()` method
  - [ ] Implement `processTask()` abstract method
  - [ ] Implement `updateStatus()` method
  - [ ] Implement `logActivity()` method
  - [ ] Implement `updateTaskStatus()` method
  - [ ] Implement `getPendingTasks()` method
  - [ ] Implement `processNextTask()` method
  - [ ] Implement `updateMetrics()` method

- [ ] Create `src/lib/agents/outreach-agent.ts`
  - [ ] Extend BaseAgent
  - [ ] Implement `processTask()` for 'draft_outreach'
  - [ ] Implement `draftOutreachMessage()` method
  - [ ] Implement `buildOutreachPrompt()` method
  - [ ] Implement `parseLLMResponse()` method
  - [ ] Implement helper methods (getContact, getOpportunity, etc.)

---

## LLM Service

- [ ] Create `src/lib/services/llm-service.ts`
  - [ ] Implement `generateOutreachMessage()` method
  - [ ] Implement `callOpenAI()` method
  - [ ] Implement `callAnthropic()` method
  - [ ] Add error handling and retry logic
  - [ ] Add rate limiting
  - [ ] Add cost tracking

---

## API Routes

### Agent Management
- [ ] `POST /api/agents/create`
  - [ ] Validate request body
  - [ ] Check for existing agent of same type
  - [ ] Create agent in database
  - [ ] Return agent object

- [ ] `GET /api/agents`
  - [ ] Fetch user's agents
  - [ ] Support filtering by type/status
  - [ ] Return agents array

- [ ] `GET /api/agents/[agentId]`
  - [ ] Verify ownership
  - [ ] Fetch agent details
  - [ ] Return agent object

- [ ] `PATCH /api/agents/[agentId]`
  - [ ] Verify ownership
  - [ ] Validate update data
  - [ ] Update agent
  - [ ] Return updated agent

- [ ] `DELETE /api/agents/[agentId]`
  - [ ] Verify ownership
  - [ ] Delete agent (cascades)
  - [ ] Return success

### Task Management
- [ ] `POST /api/agents/[agentId]/tasks/assign`
  - [ ] Verify agent ownership
  - [ ] Validate task type and input
  - [ ] Create task in database
  - [ ] Trigger task processing (async)
  - [ ] Return task object

- [ ] `GET /api/agents/[agentId]/tasks`
  - [ ] Verify agent ownership
  - [ ] Fetch tasks with filters
  - [ ] Support pagination
  - [ ] Return tasks array

- [ ] `GET /api/agents/tasks/pending`
  - [ ] Fetch all pending tasks across user's agents
  - [ ] Include agent info
  - [ ] Support pagination
  - [ ] Return tasks array

- [ ] `GET /api/agents/[agentId]/status`
  - [ ] Verify agent ownership
  - [ ] Fetch agent, tasks, activity, metrics
  - [ ] Calculate pending approvals
  - [ ] Return comprehensive status

### Outreach Drafts
- [ ] `GET /api/agents/outreach/drafts`
  - [ ] Fetch drafts with filters
  - [ ] Include contact and opportunity data
  - [ ] Support pagination
  - [ ] Return drafts array

- [ ] `POST /api/agents/outreach/drafts/[draftId]/approve`
  - [ ] Verify ownership
  - [ ] Apply edits if provided
  - [ ] Update draft status
  - [ ] Send message via channel
  - [ ] Update contact outreach_status
  - [ ] Create activity log
  - [ ] Notify follow-up agent (if configured)

- [ ] `POST /api/agents/outreach/drafts/[draftId]/reject`
  - [ ] Verify ownership
  - [ ] Update draft status
  - [ ] Store rejection reason
  - [ ] Create activity log

### Activity & Metrics
- [ ] `GET /api/agents/[agentId]/activity`
  - [ ] Verify ownership
  - [ ] Fetch activity log
  - [ ] Support pagination and filters
  - [ ] Return activities array

- [ ] `GET /api/agents/[agentId]/metrics`
  - [ ] Verify ownership
  - [ ] Fetch metrics for date range
  - [ ] Calculate summary statistics
  - [ ] Return metrics and summary

---

## UI Components

- [ ] Create `src/components/agents/AgentDashboardPanel.tsx`
  - [ ] Fetch agent status
  - [ ] Display agent status cards
  - [ ] Show pending approvals badge
  - [ ] Display recent activity feed
  - [ ] Add quick actions (pause/resume)

- [ ] Create `src/components/agents/AgentStatusCard.tsx`
  - [ ] Display agent type and name
  - [ ] Show status indicator
  - [ ] Display task count
  - [ ] Add click handler to view details

- [ ] Create `src/components/agents/PendingApprovalsModal.tsx`
  - [ ] Fetch pending drafts
  - [ ] Display draft list
  - [ ] Show draft preview
  - [ ] Implement approve/reject actions
  - [ ] Support editing before approval
  - [ ] Add bulk actions

- [ ] Create `src/components/agents/DraftPreview.tsx`
  - [ ] Display draft message
  - [ ] Show personalization context
  - [ ] Display contact and opportunity info
  - [ ] Add edit capability

---

## Command Centre Integration

- [ ] Add AgentDashboardPanel to CommandCentre layout
- [ ] Add "Delegate to Agent" button to opportunity cards
- [ ] Create delegation flow UI
- [ ] Show agent recommendations in opportunity details

---

## Background Job Processing

- [ ] Set up job queue (Bull/BullMQ with Redis)
- [ ] Create task processor worker
- [ ] Implement cron job to process tasks every 5 minutes
- [ ] Add error handling and retry logic
- [ ] Add rate limiting for LLM calls

---

## Testing

### Unit Tests
- [ ] BaseAgent class methods
- [ ] OutreachAgent message drafting
- [ ] LLM service response parsing
- [ ] API route handlers

### Integration Tests
- [ ] Agent creation flow
- [ ] Task assignment and processing
- [ ] Draft creation and approval
- [ ] Activity logging

### E2E Tests
- [ ] User creates agent → assigns task → approves draft → message sent
- [ ] Agent processes multiple tasks
- [ ] Error handling and recovery

---

## Documentation

- [ ] Update API documentation
- [ ] Create agent setup guide
- [ ] Document LLM configuration
- [ ] Add code comments and JSDoc

---

## Environment Setup

- [ ] Add LLM API key to environment variables
- [ ] Configure LLM provider (OpenAI/Anthropic)
- [ ] Set up Redis for job queue
- [ ] Configure rate limits

---

## Deployment Checklist

- [ ] Run migration on production database
- [ ] Deploy API routes
- [ ] Deploy background workers
- [ ] Configure production LLM API keys
- [ ] Set up monitoring and alerts
- [ ] Test end-to-end flow in production

---

## Success Criteria

- [ ] User can create an Outreach Agent
- [ ] User can assign a draft_outreach task
- [ ] Agent drafts a personalized message
- [ ] User can approve/reject draft
- [ ] Approved draft sends message
- [ ] Activity is logged correctly
- [ ] Metrics are tracked

---

**Next Steps After Phase 1:**
- Begin Phase 2: Follow-up Agent
- Enhance agent communication (Phase 3)
- Add Planning Agent (Phase 4)


