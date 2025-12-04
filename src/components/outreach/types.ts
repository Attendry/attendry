export enum OutreachStatus {
  NOT_STARTED = 'NOT_STARTED',
  RESEARCHING = 'RESEARCHING',
  DRAFTING = 'DRAFTING',
  READY_TO_SEND = 'READY_TO_SEND',
  SENT = 'SENT',
  REPLIED = 'REPLIED',
  CLOSED = 'CLOSED', // Either successful or not relevant
}

export type OutreachType = 'Email' | 'LinkedIn' | 'Follow-up';

export interface GroundingChunk {
  title: string;
  url: string;
}

export interface Contact {
  id: string;
  name: string;
  company: string;
  role?: string;
  status: OutreachStatus;
  
  // Metadata
  createdAt?: string; // ISO date string
  archived?: boolean; // If true, moves to History tab (Snoozed/Waiting)

  // Preferences
  preferredLanguage?: 'English' | 'German';
  preferredTone?: 'Formal' | 'Informal';
  preferredType?: OutreachType;

  // Cadence & Tracking
  outreachStep: number; // 0=Initial, 1=Bump, 2=Value, 3=Nurture
  lastCompletedDate?: string; // ISO date string, used for weekly goal tracking
  lastContactedDate?: string;
  notes?: string;

  // Research Data
  backgroundInfo?: string; // Markdown supported
  groundingLinks?: GroundingChunk[];
  lastResearchDate?: string; // ISO date string

  // Content
  linkedInBio?: string; // Dedicated Bio field
  emailDraft?: string;
  specificGoal?: string; // Specific goal for the outreach
  
  // Reminders & Monitoring
  reminderDate?: string; // ISO date string (Time-based trigger)
  monitorUpdates?: boolean; // If true, AI checks for new info (Info-based trigger)
  hasNewIntel?: boolean; // Flag if AI found something new during a scan
  newIntelSummary?: string; // The summary of the new info found
}

export interface SearchResult {
  text: string;
  chunks: GroundingChunk[];
}

