const {
  STORIES_PREFIX,
  INDEX_KEY,
  storyKey,
  parseAgeRange,
  validateStoryMeta,
  pickStoryMeta,
  buildIndexEntry,
  buildIndex,
  contentTypeFor,
  cacheControlFor,
} = require('./catalog');

const meta = {
  id: 'moon-tiger',
  title: 'Moon Tiger',
  description: 'A tiger visits the moon.',
  ageRange: '3-6',
  genres: ['Bedtime'],
  tags: ['Space'],
  language: 'en',
  color: '#7C83FD',
  emoji: '🌙',
};

describe('keys', () => {
  it('builds story keys under the stories prefix', () => {
    expect(STORIES_PREFIX).toBe('stories/');
    expect(INDEX_KEY).toBe('stories.json');
    expect(storyKey('a', 'audio.mp3')).toBe('stories/a/audio.mp3');
  });
});

describe('parseAgeRange', () => {
  it('parses a valid range', () => {
    expect(parseAgeRange('3-6')).toEqual({ min: 3, max: 6 });
  });

  it.each(['6-3', 'all', undefined, 5])('returns null for %p', (value) => {
    expect(parseAgeRange(value)).toBeNull();
  });
});

describe('validateStoryMeta', () => {
  it('accepts a complete story whose id matches the folder', () => {
    expect(validateStoryMeta(meta, 'moon-tiger')).toEqual([]);
  });

  it.each(Object.keys(meta))('reports a missing %s', (field) => {
    const errors = validateStoryMeta({ ...meta, [field]: undefined }, 'moon-tiger');
    expect(errors.join(' ')).toContain(field);
  });

  it.each(['Moon Tiger', '../x', 'MoonTiger', 'a/b', ''])('rejects the id %p', (id) => {
    expect(validateStoryMeta({ ...meta, id }, id).length).toBeGreaterThan(0);
  });

  it('rejects an id that differs from the folder name', () => {
    expect(validateStoryMeta(meta, 'other-folder').join(' ')).toContain('folder');
  });

  it('rejects bad field shapes', () => {
    expect(validateStoryMeta({ ...meta, genres: 'x' }, 'moon-tiger').join(' ')).toContain('genres');
    expect(validateStoryMeta({ ...meta, color: 'red' }, 'moon-tiger').join(' ')).toContain('color');
    expect(validateStoryMeta({ ...meta, language: 'english' }, 'moon-tiger').join(' ')).toContain('language');
    expect(validateStoryMeta({ ...meta, ageRange: '6-3' }, 'moon-tiger').join(' ')).toContain('ageRange');
  });

  it('rejects a non-object', () => {
    expect(validateStoryMeta(null, 'moon-tiger').length).toBeGreaterThan(0);
  });
});

describe('pickStoryMeta', () => {
  it('keeps only the owner fields', () => {
    const picked = pickStoryMeta({
      ...meta,
      audio: 'x',
      cover: 'y',
      durationSec: 1,
      ageMin: 1,
      ageMax: 2,
      extra: true,
    });
    expect(picked).toEqual(meta);
  });
});

describe('buildIndexEntry', () => {
  const keys = ['stories/moon-tiger/audio.mp3', 'stories/moon-tiger/cover.png', 'stories/moon-tiger/story.json'];

  it('derives paths and ages and copies the rest', () => {
    expect(buildIndexEntry({ ...meta, durationSec: 420 }, keys)).toEqual({
      id: 'moon-tiger',
      title: 'Moon Tiger',
      description: 'A tiger visits the moon.',
      durationSec: 420,
      ageRange: '3-6',
      ageMin: 3,
      ageMax: 6,
      genres: ['Bedtime'],
      tags: ['Space'],
      language: 'en',
      audio: 'stories/moon-tiger/audio.mp3',
      cover: 'stories/moon-tiger/cover.png',
      color: '#7C83FD',
      emoji: '🌙',
    });
  });

  it('throws naming the story when the audio is missing', () => {
    expect(() => buildIndexEntry({ ...meta, durationSec: 1 }, keys.slice(1))).toThrow(/moon-tiger.*audio/);
  });

  it('throws naming the story when the cover is missing', () => {
    expect(() => buildIndexEntry({ ...meta, durationSec: 1 }, [keys[0], keys[2]])).toThrow(/moon-tiger.*cover/);
  });
});

describe('buildIndex', () => {
  it('sorts by id', () => {
    expect(buildIndex([{ id: 'b' }, { id: 'a' }]).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('allows an empty index', () => {
    expect(buildIndex([])).toEqual([]);
  });
});

describe('headers', () => {
  it.each(['stories/a/audio.mp3', 'stories/a/cover.jpg', 'stories/a/cover.png'])(
    'caches media %s for a day',
    (key) => {
      expect(cacheControlFor(key)).toBe('public, max-age=86400');
    },
  );

  it.each(['stories.json', 'stories/a/story.json'])('caches %s for a minute', (key) => {
    expect(cacheControlFor(key)).toBe('public, max-age=60');
  });

  it('maps extensions to content types', () => {
    expect(contentTypeFor('a/audio.mp3')).toBe('audio/mpeg');
    expect(contentTypeFor('a/cover.jpg')).toBe('image/jpeg');
    expect(contentTypeFor('a/cover.png')).toBe('image/png');
    expect(contentTypeFor('stories.json')).toBe('application/json');
  });
});
