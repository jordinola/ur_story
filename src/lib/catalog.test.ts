import AsyncStorage from '@react-native-async-storage/async-storage';
import { ASSET_BASE_URL, bundledCatalog, loadCatalog, normalizeStory, resolveUrl } from './catalog';
import { INTEREST_TAGS, STORY_GENRES } from './tags';

describe('resolveUrl', () => {
  it('returns absolute http(s) URLs unchanged', () => {
    expect(resolveUrl('https://cdn.example.com/a.mp3')).toBe('https://cdn.example.com/a.mp3');
    expect(resolveUrl('HTTP://cdn.example.com/a.mp3')).toBe('HTTP://cdn.example.com/a.mp3');
  });

  it('strips leading slashes from relative paths', () => {
    expect(resolveUrl('audio/moon.mp3', 'https://cdn.example.com/')).toBe(
      'https://cdn.example.com/audio/moon.mp3',
    );
    expect(resolveUrl('///audio/moon.mp3', 'https://cdn.example.com')).toBe(
      'https://cdn.example.com/audio/moon.mp3',
    );
  });

  it('uses the configured R2 base URL by default', () => {
    expect(ASSET_BASE_URL).toMatch(/^https:\/\//);
    expect(resolveUrl('audio/moon.mp3')).toBe(`${ASSET_BASE_URL}/audio/moon.mp3`);
  });
});

describe('bundledCatalog', () => {
  it('has at least one story', () => {
    expect(bundledCatalog.length).toBeGreaterThan(0);
  });

  it('has enough stories to scroll the library grid in portrait and landscape', () => {
    expect(bundledCatalog.length).toBeGreaterThanOrEqual(8);
  });

  it('includes long titles so title overflow is exercised', () => {
    const long = bundledCatalog.filter((s) => s.title.length > 35);
    expect(long.length).toBeGreaterThanOrEqual(2);
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
    const result = await loadCatalog(onLocal, '');

    expect(onLocal).toHaveBeenCalledWith(bundledCatalog);
    expect(result).toBe(bundledCatalog);
  });

  it('prefers a cached catalog over the bundled one', async () => {
    const cached = [{ ...bundledCatalog[0], title: 'Cached title' }];
    await AsyncStorage.setItem('storytime:catalog:v1', JSON.stringify(cached));

    const onLocal = jest.fn();
    const result = await loadCatalog(onLocal, '');

    expect(onLocal).toHaveBeenCalledWith(cached);
    expect(result).toEqual(cached);
  });

  it('falls back to the bundled catalog when the cache is corrupt', async () => {
    await AsyncStorage.setItem('storytime:catalog:v1', '{not json');

    const result = await loadCatalog(jest.fn(), '');

    expect(result).toBe(bundledCatalog);
  });

  it('does not hit the network when no base URL is set', async () => {
    await loadCatalog(jest.fn(), '');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('normalizeStory', () => {
  const raw = {
    id: 'a',
    title: 'T',
    description: 'D',
    durationSec: 10,
    ageRange: '3-6',
    language: 'en',
    audio: 'audio/a.mp3',
    color: '#000000',
    emoji: 'x',
  };

  it('derives ageMin/ageMax from ageRange', () => {
    expect(normalizeStory(raw)).toMatchObject({ ageMin: 3, ageMax: 6 });
  });

  it('falls back to 0-99 for an unparsable ageRange', () => {
    expect(normalizeStory({ ...raw, ageRange: 'all ages' })).toMatchObject({ ageMin: 0, ageMax: 99 });
  });

  it('defaults missing genres and tags to empty arrays', () => {
    expect(normalizeStory(raw)).toMatchObject({ genres: [], tags: [] });
  });

  it('drops non-string entries', () => {
    const story = normalizeStory({ ...raw, genres: ['Bedtime', 3, null], tags: [1, 'Magic'] });
    expect(story?.genres).toEqual(['Bedtime']);
    expect(story?.tags).toEqual(['Magic']);
  });

  it.each(['id', 'title', 'audio'])('returns null when %s is missing', (key) => {
    expect(normalizeStory({ ...raw, [key]: undefined })).toBeNull();
  });

  it('returns null for non-objects', () => {
    expect(normalizeStory(null)).toBeNull();
    expect(normalizeStory('x')).toBeNull();
  });

  it('keeps explicit ageMin/ageMax', () => {
    expect(normalizeStory({ ...raw, ageMin: 1, ageMax: 2 })).toMatchObject({ ageMin: 1, ageMax: 2 });
  });
});

describe('loadCatalog normalization', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('normalizes a cached catalog lacking the new fields', async () => {
    const legacy = [{
      id: 'old', title: 'Old', description: 'd', durationSec: 5, ageRange: '2-4',
      language: 'en', audio: 'audio/old.mp3', color: '#111111', emoji: 'o',
    }];
    await AsyncStorage.setItem('storytime:catalog:v1', JSON.stringify(legacy));

    const result = await loadCatalog(jest.fn());

    expect(result[0]).toMatchObject({ id: 'old', ageMin: 2, ageMax: 4, genres: [], tags: [] });
  });
});

describe('bundled catalog metadata', () => {
  it.each(bundledCatalog.map((s) => [s.id, s] as const))('story %s has genres, tags and an age span', (_id, s) => {
    expect(s.genres.length).toBeGreaterThan(0);
    expect(s.tags.length).toBeGreaterThan(0);
    expect(s.ageMin).toBeLessThanOrEqual(s.ageMax);
    s.tags.forEach((t) => expect(INTEREST_TAGS).toContain(t));
    s.genres.forEach((g) => expect(STORY_GENRES).toContain(g));
  });

  it('uses every listed genre in at least one bundled story', () => {
    const used = new Set(bundledCatalog.flatMap((s) => s.genres));
    STORY_GENRES.forEach((g) => expect(used).toContain(g));
  });
});
