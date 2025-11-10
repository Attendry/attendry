import { z } from "zod";

const localeEnum = z.enum(["de", "en"]);

export const eventsSearchRequestSchema = z.object({
  userText: z.string().trim().min(1, "userText is required"),
  country: z.string().trim().min(2).max(5).optional().nullable(),
  dateFrom: z.string().trim().min(8).optional().nullable(),
  dateTo: z.string().trim().min(8).optional().nullable(),
  locale: localeEnum.optional(),
  location: z.string().trim().optional().nullable(),
  timeframe: z.string().trim().optional().nullable(),
  includeDebug: z.boolean().optional(),
});

export type EventsSearchRequest = z.infer<typeof eventsSearchRequestSchema>;

export interface EventsSearchResponseEvent {
  id: string;
  title: string | null;
  source_url: string;
  starts_at: string | null;
  country: string | null;
  city: string | null;
  location: string | null;
  venue: string | null;
  description: string | null;
  confidence: number | null;
  confidence_reason?: string | null;
  sessions: Array<Record<string, unknown>>;
  speakers: Array<{
    name: string | null;
    title: string | null;
    org: string | null;
    bio: string | null;
    confidence: number;
  }>;
  sponsors: Array<Record<string, unknown>>;
  countrySource?: string | null;
  citySource?: string | null;
  locationSource?: string | null;
  relatedUrls?: string[];
  acceptedByCountryGate?: boolean;
  [key: string]: unknown;
}

export interface EventsSearchResponse {
  count: number;
  events: EventsSearchResponseEvent[];
  country: string | null;
  provider: string;
  effectiveQ: string;
  searchRetriedWithBase: boolean;
  [key: string]: unknown;
}

export async function fetchEvents(
  payload: EventsSearchRequest,
  init?: RequestInit
): Promise<EventsSearchResponse> {
  const body = eventsSearchRequestSchema.parse(payload);

  const res = await fetch("/api/events/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
    ...init,
  });

  // Read response body once and reuse
  const responseText = await res.text();
  
  if (!res.ok) {
    try {
      const error = JSON.parse(responseText);
      throw new Error(typeof error?.error === 'string' ? error.error : "Search failed");
    } catch {
      throw new Error(`Search failed with status ${res.status}`);
    }
  }

  try {
    const data = JSON.parse(responseText);
    return data as EventsSearchResponse;
  } catch {
    throw new Error("Invalid response format");
  }
}

// Removed safeReadJson - response body is now read once in fetchEvents

