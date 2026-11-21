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

export const bundledCatalog = bundled as Story[];

/**
 * Returns the cached/bundled catalog immediately via `onLocal`, then tries to
 * refresh from `${ASSET_BASE_URL}/stories.json` so you can publish new stories
 * without shipping an app update.
 */
export async function loadCatalog(onLocal: (stories: Story[]) => void): Promise<Story[]> {
  let current = bundledCatalog;
  try {
    const cached = await AsyncStorage.getItem(CATALOG_CACHE_KEY);
    if (cached) current = JSON.parse(cached) as Story[];
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
    const remote = (await res.json()) as Story[];
    if (Array.isArray(remote) && remote.length > 0) {
      await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(remote));
      return remote;
    }
  } catch {
    // offline or bad JSON: keep what we have
  }
  return current;
}
