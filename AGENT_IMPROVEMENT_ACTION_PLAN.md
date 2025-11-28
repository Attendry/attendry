# Agent System Improvement Action Plan
**Date:** 2025-02-26  
**Based on:** AGENT_ARCHITECTURE_AUDIT_REPORT.md  
**Priority:** High

---

## Quick Summary

**Current State:** Phase 1 complete, Outreach Agent functional, but critical gaps prevent production use.

**Critical Blockers:**
1. ❌ No background job processing (tasks processed synchronously)
2. ❌ No message sending (drafts created but never sent)
3. ❌ No Follow-up Agent (incomplete workflow)

**Timeline to Production:** 4-6 weeks with focused effort

---

## Priority 1: Critical Fixes (Week 1-2)

### 1.1 Background Job Queue ⚡
**Status:** Blocking  
**Effort:** 2-3 days  
**Impact:** High

**Tasks:**
- [ ] Set up Redis (local or cloud instance)
- [ ] Install BullMQ: `npm install bullmq ioredis`
- [ ] Create `src/lib/services/job-queue.ts`
- [ ] Create worker process: `src/lib/workers/agent-task-worker.ts`
- [ ] Update task assignment API to use queue
- [ ] Add retry logic (exponential backoff)
- [ ] Create cron job for task processing
- [ ] Test with multiple concurrent tasks

**Files to Create:**
```
src/lib/services/job-queue.ts
src/lib/workers/agent-task-worker.ts
src/app/api/cron/process-agent-tasks/route.ts
```

**Code Example:**
```typescript
// src/lib/services/job-queue.ts
import { Queue, Worker } from 'bullmq';
import { OutreachAgent } from '@/lib/agents/outreach-agent';

export const agentTaskQueue = new Queue('agent-tasks', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const agentTaskWorker = new Worker('agent-tasks', async (job) => {
  const { agentId, taskId, agentType } = job.data;
  
  let agent;
  if (agentType === 'outreach') {
    agent = new OutreachAgent(agentId);
    await agent.initialize();
    await agent.processNextTask();
  }
  // Add other agent types as implemented
});
```

---

### 1.2 Email Integration 📧
**Status:** Blocking  
**Effort:** 2-3 days  
**Impact:** High

**Tasks:**
- [ ] Choose email provider (Resend recommended)
- [ ] Install SDK: `npm install resend`
- [ ] Create `src/lib/services/email-service.ts`
- [ ] Update approve endpoint to send email
- [ ] Add delivery status tracking
- [ ] Handle bounces/errors
- [ ] Test end-to-end flow

**Files to Create:**
```
src/lib/services/email-service.ts
```

**Environment Variables:**
```env
RESEND_API_KEY=re_xxxxx
EMAIL_FROM_ADDRESS=noreply@attendry.com
EMAIL_FROM_NAME=Attendry
```

**Code Example:**
```typescript
// src/lib/services/email-service.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOutreachEmail(
  to: string,
  subject: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      html: body,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

**Update Approve Endpoint:**
```typescript
// src/app/api/agents/outreach/drafts/[draftId]/approve/route.ts
// After approving draft:
if (draft.channel === 'email' && contact.email) {
  const emailResult = await sendOutreachEmail(
    contact.email,
    draft.subject || 'Follow-up',
    draft.message_body
  );
  
  if (emailResult.success) {
    // Update draft status to 'sent'
    // Track delivery
  }
}
```

---

### 1.3 Database Migration for Sent Messages
**Status:** Required  
**Effort:** 1 hour  
**Impact:** Medium

**Tasks:**
- [ ] Create `agent_outreach_sent` table
- [ ] Track sent messages, delivery status, responses
- [ ] Link to original draft

**Migration:**
```sql
CREATE TABLE IF NOT EXISTS agent_outreach_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES agent_outreach_drafts(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES saved_speaker_profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  recipient_email TEXT,
  subject TEXT,
  message_body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivery_status TEXT DEFAULT 'pending',
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);
```

---

## Priority 2: Follow-up Agent (Week 3-4)

### 2.1 FollowupAgent Implementation
**Status:** High Priority  
**Effort:** 4-5 days  
**Impact:** High

**Tasks:**
- [ ] Create `src/lib/agents/followup-agent.ts`
- [ ] Extend BaseAgent
- [ ] Implement follow-up scheduling logic
- [ ] Create follow-up message drafting
- [ ] Integrate with Outreach Agent notifications
- [ ] Add follow-up execution cron job
- [ ] Create UI components

**Files to Create:**
```
src/lib/agents/followup-agent.ts
src/app/api/cron/execute-followups/route.ts
src/components/agents/FollowupSchedulePanel.tsx
```

**Key Features:**
- Monitor outreach status
- Identify contacts needing follow-up
- Schedule follow-ups based on timing rules
- Draft follow-up messages
- Execute scheduled follow-ups
- Escalate to user if needed

---

### 2.2 Follow-up Scheduling Logic
**Tasks:**
- [ ] Calculate optimal follow-up timing
- [ ] Respect event dates (don't follow up day before event)
- [ ] Handle multiple follow-up attempts
- [ ] Escalation logic after max attempts

---

## Priority 3: Integration Improvements (Week 5-6)

### 3.1 Opportunity Integration
**Status:** Medium Priority  
**Effort:** 2-3 days  
**Impact:** Medium

**Tasks:**
- [ ] Add "Delegate to Agent" button to OpportunityCard
- [ ] Implement agent recommendation logic
- [ ] Auto-create tasks for high-signal opportunities
- [ ] Show agent activity on opportunities

**Files to Modify:**
```
src/components/OpportunityCard.tsx
src/lib/services/agent-recommendations.ts (new)
```

---

### 3.2 Real-time Updates
**Status:** Medium Priority  
**Effort:** 3-4 days  
**Impact:** Medium

**Tasks:**
- [ ] Implement Supabase real-time subscriptions
- [ ] Update UI components reactively
- [ ] Add notification system
- [ ] Test with multiple users

**Code Example:**
```typescript
// In AgentDashboardPanel
useEffect(() => {
  const subscription = supabase
    .channel('agent-tasks')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'agent_tasks',
      filter: `agent_id=in.(${agentIds.join(',')})`
    }, (payload) => {
      // Refresh agent status
      refreshAgents();
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [agentIds]);
```

---

## Priority 4: Agent Communication (Week 7-8)

### 4.1 Agent Messaging System
**Status:** Medium Priority  
**Effort:** 5-7 days  
**Impact:** Medium

**Tasks:**
- [ ] Implement message sending in BaseAgent
- [ ] Create message routing logic
- [ ] Add message handlers
- [ ] Build communication UI
- [ ] Test communication patterns

**Files to Create:**
```
src/lib/services/agent-messaging.ts
src/components/agents/AgentMessagesPanel.tsx
```

---

## Priority 5: Planning Agent (Week 9-10)

### 5.1 PlanningAgent Implementation
**Status:** Low Priority  
**Effort:** 5-7 days  
**Impact:** Low-Medium

**Tasks:**
- [ ] Create PlanningAgent class
- [ ] Integrate with proactive discovery
- [ ] Build opportunity prioritization
- [ ] Create recommendations
- [ ] Add planning UI

---

## Testing Checklist

### Unit Tests
- [ ] BaseAgent methods
- [ ] OutreachAgent message drafting
- [ ] LLM service
- [ ] Email service
- [ ] Job queue

### Integration Tests
- [ ] Task assignment → processing → completion
- [ ] Draft creation → approval → sending
- [ ] Follow-up scheduling → execution
- [ ] Agent communication

### E2E Tests
- [ ] Full outreach workflow
- [ ] Follow-up workflow
- [ ] Error handling
- [ ] User approval flow

---

## Environment Setup

### Required Environment Variables
```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# Email
RESEND_API_KEY=re_xxxxx
EMAIL_FROM_ADDRESS=noreply@attendry.com
EMAIL_FROM_NAME=Attendry

# LLM (already configured)
GEMINI_API_KEY=xxxxx
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=xxxxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

### Dependencies to Install
```bash
npm install bullmq ioredis resend
npm install --save-dev @types/bullmq
```

---

## Success Criteria

### Phase 1 Complete ✅
- [x] Database schema
- [x] BaseAgent class
- [x] OutreachAgent
- [x] API endpoints
- [x] Basic UI

### Phase 2: Production Ready
- [ ] Background job queue working
- [ ] Email sending functional
- [ ] Follow-up Agent implemented
- [ ] End-to-end workflow tested
- [ ] Error handling comprehensive
- [ ] Basic monitoring in place

### Phase 3: Full Vision
- [ ] All agents implemented
- [ ] Agent communication working
- [ ] Real-time updates
- [ ] Advanced analytics
- [ ] Performance optimized

---

## Risk Mitigation

### High Risks
1. **Job Queue Failure**
   - Monitor queue health
   - Alert on failures
   - Implement dead letter queue

2. **Email Delivery Issues**
   - Track delivery status
   - Handle bounces
   - Retry failed sends

3. **LLM API Costs**
   - Rate limiting
   - Cost tracking
   - Budget alerts

---

## Next Steps

1. **This Week:**
   - Set up Redis
   - Implement job queue
   - Integrate email sending

2. **Next Week:**
   - Test end-to-end flow
   - Fix any issues
   - Start Follow-up Agent

3. **Week 3-4:**
   - Complete Follow-up Agent
   - Integration improvements
   - Testing and polish

---

**Last Updated:** 2025-02-26  
**Owner:** Development Team  
**Review Frequency:** Weekly

