import { INTEREST_TAGS } from './tags';
import type { Profile } from '../types';

export const MAX_PROFILES = 6;
export const MIN_AGE = 2;
export const MAX_AGE = 12;
export const MAX_NAME_LENGTH = 20;

type EditableFields = { name: string; age: number; tags: string[]; languages: string[] };
type ValidationErrors = Partial<Record<'name' | 'age' | 'languages', string>>;

export type ProfileValidation =
  | { ok: true; value: EditableFields }
  | { ok: false; errors: ValidationErrors };

export function validateProfileInput(input: EditableFields): ProfileValidation {
  const errors: ValidationErrors = {};
  const name = input.name.trim();
  const languages = input.languages.map((l) => l.trim()).filter(Boolean);

  if (name.length === 0) errors.name = 'Enter a name';
  else if (name.length > MAX_NAME_LENGTH) errors.name = `Use ${MAX_NAME_LENGTH} characters or fewer`;
  if (!Number.isInteger(input.age) || input.age < MIN_AGE || input.age > MAX_AGE) {
    errors.age = `Age must be a whole number from ${MIN_AGE} to ${MAX_AGE}`;
  }
  if (languages.length === 0) errors.languages = 'Pick at least one language';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const tags = [...new Set(input.tags)].filter((t) => INTEREST_TAGS.includes(t));
  return { ok: true, value: { name, age: input.age, tags, languages: [...new Set(languages)] } };
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function toStoredProfile(entry: unknown): Profile | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const { id, name, age, tags, languages, color } = entry as Record<string, unknown>;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof color !== 'string' || color === '') return null;
  if (typeof name !== 'string' || typeof age !== 'number') return null;
  if (!isStringArray(tags) || !isStringArray(languages)) return null;
  const result = validateProfileInput({ name, age, tags, languages });
  return result.ok ? { id, color, ...result.value } : null;
}

export function parseStoredProfiles(raw: string | null): { profiles: Profile[]; activeId: string | null } {
  const empty = { profiles: [], activeId: null };
  if (!raw) return empty;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (typeof data !== 'object' || data === null) return empty;
  const { profiles: entries, activeId } = data as Record<string, unknown>;
  if (!Array.isArray(entries)) return empty;

  const seen = new Set<string>();
  const profiles: Profile[] = [];
  for (const entry of entries) {
    const profile = toStoredProfile(entry);
    if (!profile || seen.has(profile.id)) continue;
    seen.add(profile.id);
    profiles.push(profile);
  }
  const kept = profiles.slice(0, MAX_PROFILES);
  const active = kept.find((p) => p.id === activeId) ?? kept[0];
  return { profiles: kept, activeId: active?.id ?? null };
}
