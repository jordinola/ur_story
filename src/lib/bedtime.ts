export const BEDTIME_DURATIONS = [15, 30, 45] as const;
export const BEDTIME_KEY = 'storytime:bedtime:v1';
export const BEDTIME_TIP_KEY = 'storytime:bedtime-tip:v1';

export function endsAtFor(minutes: number, now: number): number {
  return now + minutes * 60_000;
}

export function remainingSec(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function isExpired(endsAt: number, now: number): boolean {
  return now >= endsAt;
}

export function serializeSession(endsAt: number): string {
  return JSON.stringify({ endsAt });
}

// Saved data can be missing or corrupt; anything unusable means "no session".
export function parseStoredSession(raw: string | null): number | null {
  if (raw == null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const endsAt = (value as { endsAt?: unknown }).endsAt;
    return typeof endsAt === 'number' && Number.isFinite(endsAt) ? endsAt : null;
  } catch {
    return null;
  }
}
