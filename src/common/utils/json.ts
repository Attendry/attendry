export async function tryJsonRepair(raw: string | null | undefined): Promise<string | null> {
  if (!raw) return null;

  try {
    const jsonrepairModule = await import('jsonrepair');
    const repairFn = jsonrepairModule?.jsonrepair;
    if (typeof repairFn === 'function') {
      return repairFn(raw);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[json] jsonrepair unavailable or failed', error);
    }
  }

  return null;
}
