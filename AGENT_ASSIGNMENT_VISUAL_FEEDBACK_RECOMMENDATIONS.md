# Agent Assignment Visual Feedback - Recommendations

**Date:** 2025-02-26  
**Issue:** No visual indication when an agent is assigned to a contact  
**Current State:** Only toast notification, no persistent visual feedback

---

## Current Behavior Analysis

### What Works
- ✅ Toast notification appears when task is assigned
- ✅ "Draft Pending" badge shows on ContactCard for `pending_approval` drafts
- ✅ AssignTaskModal allows task assignment
- ✅ ContactModal has agent integration

### What's Missing
- ❌ No visual indicator of **active/pending tasks** (only checks drafts)
- ❌ No indication of **which agent** is working on the contact
- ❌ No **task status** display (pending, in_progress, completed, failed)
- ❌ No **real-time updates** when task status changes
- ❌ No **task history** visible in ContactModal
- ❌ No visual distinction between different task types

---

## Recommended Solutions

### Option 1: Enhanced Badge System (Quick Win) ⚡
**Effort:** Low | **Impact:** High

Add task status badges to ContactCard and ContactModal:

**ContactCard:**
- Show badge for active tasks: "Agent Working" (blue, animated spinner)
- Show badge for pending tasks: "Task Queued" (yellow)
- Show badge for completed tasks: "Draft Ready" (green)
- Show badge for failed tasks: "Task Failed" (red)

**Visual Design:**
```
[Bot icon] Agent Working
[Clock icon] Task Queued  
[CheckCircle icon] Draft Ready
[AlertCircle icon] Task Failed
```

**Implementation:**
- Query `agent_tasks` table for contact's tasks
- Filter by status: `pending`, `in_progress`
- Show most recent/active task status
- Update on task status changes

---

### Option 2: Task Status Indicator in ContactModal (Medium Effort) 🎯
**Effort:** Medium | **Impact:** High

Add a dedicated "Agent Activity" section in ContactModal:

**Features:**
- **Active Tasks Panel:**
  - List of current tasks for this contact
  - Task type, status, assigned agent name
  - Progress indicator for in_progress tasks
  - Time since assignment
  
- **Task History:**
  - Recent completed tasks
  - Failed tasks with error messages
  - Quick links to view drafts/outputs

**Visual Design:**
```
┌─────────────────────────────────────┐
│ Agent Activity                      │
├─────────────────────────────────────┤
│ [Bot] Outreach Agent                │
│ Drafting outreach message...        │
│ Status: In Progress • 2m ago        │
│ [Progress bar: 60%]                 │
└─────────────────────────────────────┘
```

---

### Option 3: Real-time Task Status Updates (Advanced) 🚀
**Effort:** High | **Impact:** Very High

Implement real-time updates using Supabase subscriptions:

**Features:**
- Real-time badge updates when task status changes
- Live progress indicators
- Automatic refresh when tasks complete
- Push notifications for task completion

**Implementation:**
- Use Supabase real-time subscriptions on `agent_tasks`
- Filter by `contact_id` in `input_data`
- Update UI automatically when status changes

---

### Option 4: Agent Assignment History (Comprehensive) 📊
**Effort:** Medium-High | **Impact:** Medium

Show full assignment history and agent relationship:

**Features:**
- **Assigned Agents List:**
  - Which agents have worked on this contact
  - Last assignment date
  - Success rate for this contact
  
- **Quick Actions:**
  - "Re-assign to same agent" button
  - "View all drafts from agent" link
  - "Agent performance for this contact" stats

---

## Recommended Implementation Plan

### Phase 1: Quick Visual Feedback (Immediate)
1. ✅ Add task status query to ContactCard
2. ✅ Show active task badge (pending/in_progress)
3. ✅ Show agent name in badge
4. ✅ Add task status to ContactModal header

**Visual Indicators:**
- **Pending:** Yellow badge with clock icon - "Task Queued"
- **In Progress:** Blue badge with spinner - "Agent Working"
- **Completed:** Green badge with check - "Draft Ready"
- **Failed:** Red badge with alert - "Task Failed"

### Phase 2: Enhanced Modal View (Short-term)
1. ✅ Add "Agent Activity" section to ContactModal
2. ✅ List active tasks with details
3. ✅ Show task history (last 5 tasks)
4. ✅ Add refresh button to manually update

### Phase 3: Real-time Updates (Long-term)
1. ⏳ Implement Supabase real-time subscriptions
2. ⏳ Auto-refresh task status
3. ⏳ Push notifications for completion

---

## Specific UI Recommendations

### ContactCard Enhancements

**Add to badge section:**
```tsx
{activeTask && (
  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
    activeTask.status === 'in_progress' ? 'bg-blue-100 text-blue-700 animate-pulse' :
    activeTask.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
    activeTask.status === 'completed' ? 'bg-green-100 text-green-700' :
    'bg-red-100 text-red-700'
  }`}>
    {activeTask.status === 'in_progress' && <Loader2 className="w-3 h-3 animate-spin" />}
    {activeTask.status === 'pending' && <Clock className="w-3 h-3" />}
    {activeTask.status === 'completed' && <CheckCircle className="w-3 h-3" />}
    {activeTask.status === 'failed' && <AlertCircle className="w-3 h-3" />}
    {activeTask.status === 'in_progress' ? 'Agent Working' :
     activeTask.status === 'pending' ? 'Task Queued' :
     activeTask.status === 'completed' ? 'Draft Ready' : 'Task Failed'}
  </span>
)}
```

### ContactModal Enhancements

**Add Agent Activity section:**
```tsx
{/* Agent Activity Section */}
<div className="space-y-2">
  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
    Agent Activity
  </h3>
  
  {activeTasks.length > 0 ? (
    <div className="space-y-2">
      {activeTasks.map((task) => (
        <div key={task.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">{task.agent_name}</span>
            </div>
            <span className={`text-xs font-medium ${
              task.status === 'in_progress' ? 'text-blue-600' :
              task.status === 'pending' ? 'text-yellow-600' :
              task.status === 'completed' ? 'text-green-600' :
              'text-red-600'
            }`}>
              {task.status.replace('_', ' ')}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {task.task_type.replace('_', ' ')} • {formatTimeAgo(task.assigned_at)}
          </p>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-sm text-slate-400">No active agent tasks</p>
  )}
</div>
```

---

## Data Queries Needed

### ContactCard Query
```typescript
// Get active tasks for contact
const { data: activeTasks } = await supabase
  .from('agent_tasks')
  .select(`
    id,
    status,
    task_type,
    assigned_at,
    agent:ai_agents(id, name, agent_type)
  `)
  .eq('input_data->>contactId', contact.id)
  .in('status', ['pending', 'in_progress'])
  .order('assigned_at', { ascending: false })
  .limit(1);
```

### ContactModal Query
```typescript
// Get all tasks for contact (active + recent)
const { data: allTasks } = await supabase
  .from('agent_tasks')
  .select(`
    *,
    agent:ai_agents(id, name, agent_type, status)
  `)
  .eq('input_data->>contactId', contact.id)
  .order('assigned_at', { ascending: false })
  .limit(10);
```

---

## Success Metrics

### Before
- ❌ No visual indication of agent assignment
- ❌ User must remember which contacts have tasks
- ❌ No way to see task progress
- ❌ Confusion about task status

### After
- ✅ Clear visual indicators on contact cards
- ✅ Immediate feedback when task is assigned
- ✅ Real-time status updates
- ✅ Easy to see which contacts have active agent work
- ✅ Reduced cognitive load

---

## Implementation Priority

1. **High Priority (Do First):**
   - Add task status badge to ContactCard
   - Show active task indicator
   - Display agent name in badge

2. **Medium Priority:**
   - Add Agent Activity section to ContactModal
   - Show task history
   - Add manual refresh

3. **Low Priority (Nice to Have):**
   - Real-time subscriptions
   - Push notifications
   - Agent performance metrics

---

## Notes

- Task statuses: `pending`, `in_progress`, `completed`, `failed`, `cancelled`
- Tasks are linked to contacts via `input_data->>contactId`
- Need to join with `ai_agents` to get agent name
- Consider polling vs. real-time based on usage patterns
- Mobile experience needs separate consideration

