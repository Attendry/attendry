type LogPayload = Record<string, unknown>;

export function logSynthetic(message: string, payload: LogPayload = {}): void {
  const entry = {
    msg: message,
    ts: new Date().toISOString(),
    ...payload,
  };

  // eslint-disable-next-line no-console
  console.info(JSON.stringify(entry));
}
