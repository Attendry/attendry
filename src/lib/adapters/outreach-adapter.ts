import { SavedSpeakerProfile } from '@/lib/types/database';
import { Contact, OutreachStatus } from '../components/outreach/types';

/**
 * Maps Outreach Orbit status to saved_speaker_profiles outreach_status
 */
export function mapOutreachStatusToDb(status: OutreachStatus): 'not_started' | 'contacted' | 'responded' | 'meeting_scheduled' {
  switch (status) {
    case OutreachStatus.NOT_STARTED:
    case OutreachStatus.RESEARCHING:
    case OutreachStatus.DRAFTING:
    case OutreachStatus.READY_TO_SEND:
      return 'not_started';
    case OutreachStatus.SENT:
      return 'contacted';
    case OutreachStatus.REPLIED:
      return 'responded';
    case OutreachStatus.CLOSED:
      return 'meeting_scheduled';
    default:
      return 'not_started';
  }
}

/**
 * Maps saved_speaker_profiles outreach_status to Outreach Orbit status
 */
export function mapDbStatusToOutreach(dbStatus: string): OutreachStatus {
  // We'll need to check additional fields to determine the exact Outreach Orbit status
  // For now, map based on the DB status
  switch (dbStatus) {
    case 'not_started':
      return OutreachStatus.NOT_STARTED;
    case 'contacted':
      return OutreachStatus.SENT;
    case 'responded':
      return OutreachStatus.REPLIED;
    case 'meeting_scheduled':
      return OutreachStatus.CLOSED;
    default:
      return OutreachStatus.NOT_STARTED;
  }
}

/**
 * Converts SavedSpeakerProfile (with contact_research) to Contact
 */
export function savedProfileToContact(
  profile: SavedSpeakerProfile & { contact_research?: any }
): Contact {
  const speakerData = profile.speaker_data || {};
  const research = profile.contact_research;

  // Determine Outreach Orbit status based on DB status and other fields
  let status = mapDbStatusToOutreach(profile.outreach_status);
  
  // Refine status based on available data
  if (profile.email_draft && status === OutreachStatus.NOT_STARTED) {
    status = OutreachStatus.READY_TO_SEND;
  } else if (profile.email_draft && !profile.email_draft.trim()) {
    // If draft exists but is empty, might be in DRAFTING
    if (profile.contact_research?.background_info) {
      status = OutreachStatus.DRAFTING;
    }
  }

  return {
    id: profile.id,
    name: speakerData.name || '',
    company: speakerData.org || speakerData.organization || '',
    role: speakerData.title || profile.enhanced_data?.title || undefined,
    status,
    createdAt: profile.saved_at,
    archived: profile.archived || false,
    preferredLanguage: (profile.preferred_language as 'English' | 'German') || 'English',
    preferredTone: (profile.preferred_tone as 'Formal' | 'Informal') || 'Formal',
    preferredType: profile.preferred_channel === 'linkedin' ? 'LinkedIn' : 
                   profile.preferred_channel === 'email' ? 'Email' : 'Email',
    outreachStep: (profile as any).outreach_step ?? 0,
    lastCompletedDate: (profile as any).last_completed_date || undefined,
    lastContactedDate: profile.last_contacted_date || undefined,
    notes: profile.notes || undefined,
    backgroundInfo: research?.background_info || undefined,
    groundingLinks: research?.grounding_links || undefined,
    lastResearchDate: research?.last_research_date || undefined,
    linkedInBio: (profile as any).linkedin_bio || undefined,
    emailDraft: (profile as any).email_draft || undefined,
    specificGoal: (profile as any).specific_goal || undefined,
    reminderDate: profile.reminder_date ? new Date(profile.reminder_date).toISOString().split('T')[0] : undefined,
    monitorUpdates: profile.monitor_updates || false,
    hasNewIntel: research?.has_new_intel || false,
    newIntelSummary: research?.new_intel_summary || undefined,
  };
}

/**
 * Converts Contact to update payload for saved_speaker_profiles
 */
export function contactToUpdatePayload(contact: Contact): {
  speaker_data?: any;
  notes?: string;
  outreach_status?: string;
  preferred_language?: string;
  preferred_tone?: string;
  preferred_channel?: string;
  reminder_date?: string;
  monitor_updates?: boolean;
  archived?: boolean;
  last_contacted_date?: string;
  outreach_step?: number;
  last_completed_date?: string;
  email_draft?: string;
  linkedin_bio?: string;
  specific_goal?: string;
} {
  return {
    speaker_data: {
      name: contact.name,
      org: contact.company,
      title: contact.role,
    },
    notes: contact.notes,
    outreach_status: mapOutreachStatusToDb(contact.status),
    preferred_language: contact.preferredLanguage,
    preferred_tone: contact.preferredTone,
    preferred_channel: contact.preferredType === 'LinkedIn' ? 'linkedin' : 
                      contact.preferredType === 'Email' ? 'email' : 'email',
    reminder_date: contact.reminderDate ? new Date(contact.reminderDate).toISOString() : null,
    monitor_updates: contact.monitorUpdates,
    archived: contact.archived,
    last_contacted_date: contact.lastContactedDate || null,
    outreach_step: contact.outreachStep,
    last_completed_date: contact.lastCompletedDate || null,
    email_draft: contact.emailDraft,
    linkedin_bio: contact.linkedInBio,
    specific_goal: contact.specificGoal,
  };
}

