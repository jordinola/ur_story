import AsyncStorage from '@react-native-async-storage/async-storage';
import { bundledCatalog, loadCatalog, resolveUrl } from './catalog';

describe('resolveUrl', () => {
  it('returns absolute http(s) URLs unchanged', () => {
    expect(resolveUrl('https://cdn.example.com/a.mp3')).toBe('https://cdn.example.com/a.mp3');
    expect(resolveUrl('HTTP://cdn.example.com/a.mp3')).toBe('HTTP://cdn.example.com/a.mp3');
  });

  it('strips leading slashes from relative paths', () => {
    expect(resolveUrl('audio/moon.mp3')).toBe('/audio/moon.mp3');
    expect(resolveUrl('///audio/moon.mp3')).toBe('/audio/moon.mp3');
  });
});

describe('bundledCatalog', () => {
  it('has at least one story', () => {
    expect(bundledCatalog.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const ids = bundledCatalog.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(bundledCatalog.map((s) => [s.id, s] as const))('story %s has all required fields', (_id, s) => {
    expect(s.title).toBeTruthy();
    expect(s.description).toBeTruthy();
    expect(s.durationSec).toBeGreaterThan(0);
    expect(s.ageRange).toMatch(/^\d+-\d+$/);
    expect(s.language).toBeTruthy();
    expect(s.audio).toBeTruthy();
    expect(s.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(s.emoji).toBeTruthy();
  });
});

describe('loadCatalog (no ASSET_BASE_URL configured)', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');

  beforeEach(async () => {
    await AsyncStorage.clear();
    fetchSpy.mockClear();
  });

  it('delivers the bundled catalog locally and resolves with it', async () => {
    const onLocal = jest.fn();
    const result = await loadCatalog(onLocal);

    expect(onLocal).toHaveBeenCalledWith(bundledCatalog);
    expect(result).toBe(bundledCatalog);
  });

  it('prefers a cached catalog over the bundled one', async () => {
    const cached = [{ ...bundledCatalog[0], title: 'Cached title' }];
    await AsyncStorage.setItem('storytime:catalog:v1', JSON.stringify(cached));

    const onLocal = jest.fn();
    const result = await loadCatalog(onLocal);

    expect(onLocal).toHaveBeenCalledWith(cached);
    expect(result).toEqual(cached);
  });

  it('falls back to the bundled catalog when the cache is corrupt', async () => {
    await AsyncStorage.setItem('storytime:catalog:v1', '{not json');

    const result = await loadCatalog(jest.fn());

    expect(result).toBe(bundledCatalog);
  });

  it('does not hit the network when no base URL is set', async () => {
    await loadCatalog(jest.fn());

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
