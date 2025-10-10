// Lightweight triage helpers for correlating suppression metrics across stages.

export type Reason = { key: string; count: number; samples: any[] };

declare global {
  // eslint-disable-next-line no-var
  var __corr: string | undefined;
}

const MAX_SAMPLES_PER_REASON = 3;

export function stageCounter(
  stage: string,
  input: any[],
  output: any[],
  reasons: Reason[]
) {
  const correlationId = globalThis.__corr;
  console.log(
    JSON.stringify(
      {
        correlationId,
        at: 'stage_counter',
        stage,
        in: input.length,
        out: output.length,
        reasons: reasons.map((reason) => ({
          key: reason.key,
          count: reason.count,
          samples: reason.samples.slice(0, MAX_SAMPLES_PER_REASON),
        })),
      },
      null,
      2
    )
  );
}

export function logSuppressedSamples(stage: string, reasons: Reason[]) {
  const correlationId = globalThis.__corr;
  const samples = reasons
    .flatMap((reason) =>
      reason.samples.slice(0, MAX_SAMPLES_PER_REASON).map((sample) => ({
        stage,
        reason: reason.key,
        sample,
      }))
    )
    .slice(0, 5);

  if (samples.length) {
    console.log(
      JSON.stringify(
        {
          correlationId,
          at: 'suppressed_samples',
          stage,
          samples,
        },
        null,
        2
      )
    );
  }
}

