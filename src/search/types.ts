export type FirecrawlClientConfig = {
  timeoutMs: number;
  maxRetries: number;
  openThreshold: number;
  halfOpenAfterMs: number;
};

export type QcFlags = {
  countryHeuristic?: boolean;
  multiCountry?: boolean;
};

export type QcResult = {
  accepted: boolean;
  reason?: string;
  country?: string;
  city?: string;
  flags?: QcFlags;
};

export type QcContext = {
  requestedCountry: string;
  correlationId?: string;
};
