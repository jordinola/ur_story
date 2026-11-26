const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readStoryFolder, StoryValidationError } = require('./storyFolder');

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

const readDuration = async () => 420.4;
let root;

const makeFolder = ({ name = 'moon-tiger', story = meta, audio = 'audio', cover = 'cover.jpg' } = {}) => {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  if (story !== null) {
    fs.writeFileSync(path.join(dir, 'story.json'), typeof story === 'string' ? story : JSON.stringify(story));
  }
  if (audio !== null) fs.writeFileSync(path.join(dir, 'audio.mp3'), audio);
  if (cover !== null) fs.writeFileSync(path.join(dir, cover), 'img');
  return dir;
};

const errorsOf = async (dir, duration = readDuration) => {
  try {
    await readStoryFolder(dir, duration);
  } catch (error) {
    expect(error).toBeInstanceOf(StoryValidationError);
    return error.errors.join(' | ');
  }
  throw new Error('expected a StoryValidationError');
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'story-folder-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('readStoryFolder', () => {
  it('returns the meta with a rounded duration, the uploads and the stale cover key', async () => {
    const dir = makeFolder();
    const result = await readStoryFolder(dir, readDuration);

    expect(result.meta).toEqual({ ...meta, durationSec: 420 });
    expect(result.uploads.map((u) => u.key)).toEqual([
      'stories/moon-tiger/audio.mp3',
      'stories/moon-tiger/cover.jpg',
      'stories/moon-tiger/story.json',
    ]);
    expect(result.uploads[0]).toMatchObject({
      file: path.join(dir, 'audio.mp3'),
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=86400',
    });
    expect(result.uploads[2]).toMatchObject({ contentType: 'application/json', cacheControl: 'public, max-age=60' });
    expect(JSON.parse(result.uploads[2].body)).toEqual({ ...meta, durationSec: 420 });
    expect(result.staleKeys).toEqual(['stories/moon-tiger/cover.png']);
  });

  it('uses a png cover and marks the jpg as stale', async () => {
    const result = await readStoryFolder(makeFolder({ cover: 'cover.png' }), readDuration);
    expect(result.uploads[1].key).toBe('stories/moon-tiger/cover.png');
    expect(result.staleKeys).toEqual(['stories/moon-tiger/cover.jpg']);
  });

  it('ignores derived fields the owner wrote', async () => {
    const dir = makeFolder({ story: { ...meta, audio: 'x', durationSec: 1, ageMin: 9 } });
    const result = await readStoryFolder(dir, readDuration);
    expect(result.meta).toEqual({ ...meta, durationSec: 420 });
  });
});

describe('readStoryFolder problems', () => {
  it('reports a missing story.json', async () => {
    expect(await errorsOf(makeFolder({ story: null }))).toContain('story.json');
  });

  it('reports invalid JSON', async () => {
    expect(await errorsOf(makeFolder({ story: '{nope' }))).toContain('story.json');
  });

  it('reports a missing audio.mp3', async () => {
    expect(await errorsOf(makeFolder({ audio: null }))).toContain('audio.mp3');
  });

  it('reports an empty audio.mp3', async () => {
    expect(await errorsOf(makeFolder({ audio: '' }))).toContain('audio.mp3');
  });

  it('reports a missing cover', async () => {
    expect(await errorsOf(makeFolder({ cover: null }))).toContain('cover');
  });

  it('reports both a jpg and a png cover', async () => {
    const dir = makeFolder();
    fs.writeFileSync(path.join(dir, 'cover.png'), 'img');
    expect(await errorsOf(dir)).toContain('both');
  });

  it('reports a zero or unreadable duration', async () => {
    expect(await errorsOf(makeFolder(), async () => 0)).toContain('duration');
    fs.rmSync(path.join(root, 'moon-tiger'), { recursive: true });
    expect(await errorsOf(makeFolder(), async () => Promise.reject(new Error('bad mp3')))).toContain('duration');
  });

  it('reports a folder name that differs from the id', async () => {
    expect(await errorsOf(makeFolder({ name: 'other' }))).toContain('folder');
  });

  it('reports every problem in one error', async () => {
    const message = await errorsOf(makeFolder({ audio: null, cover: null }));
    expect(message).toContain('audio.mp3');
    expect(message).toContain('cover');
  });
});
