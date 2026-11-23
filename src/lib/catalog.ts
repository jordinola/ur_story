import AsyncStorage from '@react-native-async-storage/async-storage';
import bundled from '../data/stories.json';
import type { Story } from '../types';

/**
 * Where your audio, covers and (optionally) stories.json are hosted,
 * e.g. a Cloudflare R2 public bucket: 'https://pub-xxxxxxxx.r2.dev'
 * Leave empty to use only the bundled catalog (audio will not play until set).
 */
export const ASSET_BASE_URL = '';

const CATALOG_CACHE_KEY = 'storytime:catalog:v1';

export function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = ASSET_BASE_URL.replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const stringsOnly = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

const parseAgeRange = (ageRange: unknown): { min: number; max: number } => {
  const match = typeof ageRange === 'string' ? /^(\d+)-(\d+)$/.exec(ageRange) : null;
  return match ? { min: Number(match[1]), max: Number(match[2]) } : { min: 0, max: 99 };
};

/** Fills in fields older catalogs lack; returns null when a story is unusable. */
export function normalizeStory(raw: unknown): Story | null {
  if (!isRecord(raw)) return null;
  const { id, title, audio } = raw;
  if (typeof id !== 'string' || typeof title !== 'string' || typeof audio !== 'string') return null;
  if (!id || !title || !audio) return null;
  const range = parseAgeRange(raw.ageRange);
  return {
    ...(raw as Story),
    ageMin: typeof raw.ageMin === 'number' ? raw.ageMin : range.min,
    ageMax: typeof raw.ageMax === 'number' ? raw.ageMax : range.max,
    genres: stringsOnly(raw.genres),
    tags: stringsOnly(raw.tags),
  };
}

const normalizeCatalog = (raw: unknown): Story[] =>
  Array.isArray(raw) ? raw.map(normalizeStory).filter((s): s is Story => s !== null) : [];

export const bundledCatalog = normalizeCatalog(bundled);

/**
 * Returns the cached/bundled catalog immediately via `onLocal`, then tries to
 * refresh from `${ASSET_BASE_URL}/stories.json` so you can publish new stories
 * without shipping an app update.
 */
export async function loadCatalog(onLocal: (stories: Story[]) => void): Promise<Story[]> {
  let current = bundledCatalog;
  try {
    const cached = await AsyncStorage.getItem(CATALOG_CACHE_KEY);
    if (cached) {
      const parsed = normalizeCatalog(JSON.parse(cached));
      if (parsed.length > 0) current = parsed;
    }
  } catch {
    // ignore cache errors, fall back to bundled
  }
  onLocal(current);

  if (!ASSET_BASE_URL) return current;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(resolveUrl('stories.json'), { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return current;
    const remote = normalizeCatalog(await res.json());
    if (remote.length > 0) {
      await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(remote));
      return remote;
    }
  } catch {
    // offline or bad JSON: keep what we have
  }
  return current;
}
