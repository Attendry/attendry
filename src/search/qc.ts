import type { ParsedDoc } from './inference';
import { normaliseCountry } from './geography';
import { resolveVenueCountry } from './location';
import type { QcContext, QcResult } from './types';
import { logSynthetic } from './log';
import { metrics } from './metrics';

export async function evaluateLocation(doc: ParsedDoc, ctx: QcContext): Promise<QcResult> {
  const requested = normaliseCountry(ctx.requestedCountry);
  const eventCountry = normaliseCountry(doc.country);
  const venue = await resolveVenueCountry(doc.venueText, doc.tld, doc.country, doc.url);

  if (eventCountry && requested && eventCountry !== requested) {
    metrics.qcDropsGeo.inc();
    logSynthetic('qc_drop', {
      reason: 'geo_mismatch',
      requested,
      eventCountry,
      url: doc.url,
      correlationId: ctx.correlationId,
    });
    return { accepted: false, reason: 'geo_mismatch' };
  }

  if (!eventCountry && requested && venue.country === requested) {
    return {
      accepted: true,
      country: requested,
      city: venue.city ?? doc.city ?? undefined,
      flags: { countryHeuristic: venue.confidence === 'low' },
    };
  }

  if (!eventCountry && requested && venue.country === 'EU') {
    return {
      accepted: true,
      country: requested,
      flags: { multiCountry: true },
    };
  }

  return {
    accepted: true,
    country: eventCountry ?? requested ?? undefined,
    city: doc.city ?? venue.city ?? undefined,
    flags: {},
  };
}
