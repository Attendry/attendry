# Database Field Mapping Review

## Issue
Some elements from OutreachManager and ContactModal are not being saved, causing error messages. This document reviews the field mappings and ensures all fields exist in the database.

## Database Schema

### Base Table: `saved_speaker_profiles`
Created in: `20250218000000_create_saved_speaker_profiles.sql`

**Base Fields:**
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, FK to auth.users)
- `speaker_data` (JSONB)
- `enhanced_data` (JSONB)
- `notes` (TEXT)
- `tags` (TEXT[])
- `outreach_status` (TEXT, CHECK constraint)
- `saved_at` (TIMESTAMPTZ)
- `last_updated` (TIMESTAMPTZ)

### Migration: `20250226000001_add_contact_research_and_preferences.sql`
**Added Fields:**
- `preferred_language` (TEXT, CHECK: 'English' | 'German')
- `preferred_tone` (TEXT, CHECK: 'Formal' | 'Informal')
- `preferred_channel` (TEXT, CHECK: 'email' | 'linkedin' | 'other')
- `reminder_date` (TIMESTAMPTZ)
- `monitor_updates` (BOOLEAN, DEFAULT false)
- `archived` (BOOLEAN, DEFAULT false)
- `last_contacted_date` (TIMESTAMPTZ)

### Migration: `20251204000002_add_outreach_orbit_fields.sql`
**Added Fields:**
- `outreach_step` (INTEGER, DEFAULT 0)
- `last_completed_date` (TIMESTAMPTZ)
- `email_draft` (TEXT)
- `linkedin_bio` (TEXT)
- `specific_goal` (TEXT)

### Additional Migrations (Not Used by Outreach Orbit)
- `20250226000004_add_gdpr_compliance.sql`: Adds `consent_given`, `consent_date`, `data_source`, `deleted_at`
- `20250226000005_add_auto_save_feedback.sql`: Adds `auto_saved_at`, `auto_save_event_id`, etc.

## Field Mapping: Contact → Database

| Contact Field | Database Column | Migration | Status |
|--------------|----------------|----------|--------|
| `status` | `outreach_status` | Base | ✅ |
| `archived` | `archived` | 20250226000001 | ✅ |
| `monitorUpdates` | `monitor_updates` | 20250226000001 | ✅ |
| `reminderDate` | `reminder_date` | 20250226000001 | ✅ |
| `lastContactedDate` | `last_contacted_date` | 20250226000001 | ✅ |
| `lastCompletedDate` | `last_completed_date` | 20251204000002 | ✅ |
| `preferredLanguage` | `preferred_language` | 20250226000001 | ✅ |
| `preferredTone` | `preferred_tone` | 20250226000001 | ✅ |
| `preferredType` | `preferred_channel` | 20250226000001 | ✅ |
| `notes` | `notes` | Base | ✅ |
| `outreachStep` | `outreach_step` | 20251204000002 | ✅ |
| `emailDraft` | `email_draft` | 20251204000002 | ✅ |
| `linkedInBio` | `linkedin_bio` | 20251204000002 | ✅ |
| `specificGoal` | `specific_goal` | 20251204000002 | ✅ |
| `backgroundInfo` | `contact_research.background_info` | 20250226000001 | ✅ |
| `groundingLinks` | `contact_research.grounding_links` | 20250226000001 | ✅ |
| `lastResearchDate` | `contact_research.last_research_date` | 20250226000001 | ✅ |
| `hasNewIntel` | `contact_research.has_new_intel` | 20250226000001 | ✅ |
| `newIntelSummary` | `contact_research.new_intel_summary` | 20250226000001 | ✅ |

## Fixes Applied

### 1. Field Validation ✅
- Added whitelist of allowed fields in `updateProfileInDb`
- Filters out any unknown fields before database update
- Logs warnings for filtered fields

### 2. Error Handling ✅
- Detects "column does not exist" errors
- Provides helpful error messages with migration hints
- Handles CHECK constraint violations
- Logs attempted fields for debugging

### 3. Error Messages ✅
- Clear error messages indicating which migration needs to be run
- Specific column names in error messages
- Logs all attempted updates for debugging

## Verification Steps

To verify migrations have been run:

1. **Check Supabase Dashboard:**
   - Go to Table Editor → `saved_speaker_profiles`
   - Verify columns exist: `outreach_step`, `last_completed_date`, `email_draft`, `linkedin_bio`, `specific_goal`

2. **Run SQL Query:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'saved_speaker_profiles'
   ORDER BY ordinal_position;
   ```

3. **Check Migration Status:**
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations 
   WHERE name LIKE '%outreach%' OR name LIKE '%contact_research%'
   ORDER BY version;
   ```

## Common Errors and Solutions

### Error: "column X does not exist"
**Solution:** Run the missing migration:
- For Outreach Orbit fields: `20251204000002_add_outreach_orbit_fields.sql`
- For preferences: `20250226000001_add_contact_research_and_preferences.sql`

### Error: "new row violates check constraint"
**Solution:** Check the value being saved matches the CHECK constraint:
- `preferred_language`: Must be 'English' or 'German'
- `preferred_tone`: Must be 'Formal' or 'Informal'
- `preferred_channel`: Must be 'email', 'linkedin', or 'other'

### Error: Silent failures
**Solution:** Check browser console for warnings about filtered fields. All unknown fields are now logged.

## Testing

After applying fixes:
1. Add a new contact → Should save without errors
2. Update contact preferences → Should save without errors
3. Generate draft → Should save to `email_draft` column
4. Mark complete → Should update `last_completed_date`
5. Check browser console → Should see successful update logs

## Notes

- All fields used by OutreachManager and ContactModal are now validated
- Unknown fields are filtered out with warnings
- Error messages include migration hints
- Database errors are logged with full context

