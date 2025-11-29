# Migration File Links

**Repository:** https://github.com/Attendry/attendry  
**Branch:** `feat/proactive-discovery`

---

## Migration Files

### 1. Agent Outreach Sent Table
**File:** `supabase/migrations/20250226000002_add_agent_outreach_sent_table.sql`

**GitHub Link:**
https://github.com/Attendry/attendry/blob/feat/proactive-discovery/supabase/migrations/20250226000002_add_agent_outreach_sent_table.sql

**Raw SQL Link (for easy copy):**
https://raw.githubusercontent.com/Attendry/attendry/feat/proactive-discovery/supabase/migrations/20250226000002_add_agent_outreach_sent_table.sql

---

### 2. Agent Follow-up Schedule Table ⚠️ (The one causing your error)
**File:** `supabase/migrations/20250226000003_add_agent_followup_schedule_table.sql`

**GitHub Link:**
https://github.com/Attendry/attendry/blob/feat/proactive-discovery/supabase/migrations/20250226000003_add_agent_followup_schedule_table.sql

**Raw SQL Link (for easy copy):**
https://raw.githubusercontent.com/Attendry/attendry/feat/proactive-discovery/supabase/migrations/20250226000003_add_agent_followup_schedule_table.sql

---

### 3. Fix Log Agent Activity RLS
**File:** `supabase/migrations/20250226000004_fix_log_agent_activity_rls.sql`

**GitHub Link:**
https://github.com/Attendry/attendry/blob/feat/proactive-discovery/supabase/migrations/20250226000004_fix_log_agent_activity_rls.sql

**Raw SQL Link (for easy copy):**
https://raw.githubusercontent.com/Attendry/attendry/feat/proactive-discovery/supabase/migrations/20250226000004_fix_log_agent_activity_rls.sql

---

### 4. Enable Realtime Agent Tasks
**File:** `supabase/migrations/20250226000005_enable_realtime_agent_tasks.sql`

**GitHub Link:**
https://github.com/Attendry/attendry/blob/feat/proactive-discovery/supabase/migrations/20250226000005_enable_realtime_agent_tasks.sql

**Raw SQL Link (for easy copy):**
https://raw.githubusercontent.com/Attendry/attendry/feat/proactive-discovery/supabase/migrations/20250226000005_enable_realtime_agent_tasks.sql

---

## Quick Access

### All Migrations Directory
https://github.com/Attendry/attendry/tree/feat/proactive-discovery/supabase/migrations

---

## How to Use

1. **Click the "Raw SQL Link"** for any migration
2. **Copy all the SQL** (Ctrl+A, Ctrl+C)
3. **Paste into Supabase SQL Editor**
4. **Run the migration**

---

## Migration Order

Run them in this order:

1. ✅ `20250226000002_add_agent_outreach_sent_table.sql`
2. ✅ `20250226000003_add_agent_followup_schedule_table.sql` ← **This fixes your error**
3. ✅ `20250226000004_fix_log_agent_activity_rls.sql`
4. ✅ `20250226000005_enable_realtime_agent_tasks.sql` (Optional - you already enabled real-time manually)

---

## Note

The **Raw SQL Links** are best for copying directly into Supabase SQL Editor - they show just the SQL without GitHub formatting.

