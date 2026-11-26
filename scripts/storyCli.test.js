/** @jest-environment node */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs, run } = require('./storyCli');
const { createMemoryStore } = require('./stories/memoryStore');

describe('parseArgs', () => {
  it('parses publish with a folder and --dry-run', () => {
    expect(parseArgs(['publish', 'content/stories/a', '--dry-run'])).toEqual({
      command: 'publish',
      folders: ['content/stories/a'],
      all: false,
      dryRun: true,
    });
  });

  it('parses publish --all, remove and index', () => {
    expect(parseArgs(['publish', '--all'])).toMatchObject({ command: 'publish', all: true, folders: [] });
    expect(parseArgs(['remove', 'a'])).toMatchObject({ command: 'remove', id: 'a' });
    expect(parseArgs(['index'])).toMatchObject({ command: 'index' });
  });

  it.each([[[]], [['publish']], [['remove']], [['publish', '--nope']], [['explode']]])('rejects %j', (argv) => {
    expect(() => parseArgs(argv)).toThrow();
  });
});

describe('run', () => {
  let root;
  const readDuration = async () => 90;
  const log = jest.fn();

  const writeStory = (id, { audio = 'audio' } = {}) => {
    const dir = path.join(root, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'story.json'),
      JSON.stringify({
        id,
        title: `Story ${id}`,
        description: 'd',
        ageRange: '3-6',
        genres: ['Bedtime'],
        tags: ['Space'],
        language: 'en',
        color: '#7C83FD',
        emoji: '🌙',
      }),
    );
    fs.writeFileSync(path.join(dir, 'audio.mp3'), audio);
    fs.writeFileSync(path.join(dir, 'cover.jpg'), 'img');
    return dir;
  };

  const deps = (store, extra = {}) => ({ store, readDuration, contentRoot: root, log, ...extra });
  const indexIds = (store) => JSON.parse(store.objects.get('stories.json').body).map((e) => e.id);

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'story-cli-'));
    log.mockClear();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('publishes every folder with --all into one catalog', async () => {
    writeStory('a');
    writeStory('b');
    const store = createMemoryStore();
    await run(['publish', '--all'], deps(store));
    expect(indexIds(store)).toEqual(['a', 'b']);
    expect(store.objects.get('stories/a/audio.mp3').body).toBe('audio');
  });

  it('uploads nothing when any folder is invalid', async () => {
    writeStory('a');
    writeStory('b', { audio: '' });
    const store = createMemoryStore();
    await expect(run(['publish', '--all'], deps(store))).rejects.toThrow(/b/);
    expect(store.calls).toEqual([]);
  });

  it('publishes a single folder and prints its public URLs', async () => {
    const dir = writeStory('a');
    const store = createMemoryStore();
    await run(['publish', dir], deps(store, { publicBaseUrl: 'https://cdn.example' }));
    const output = log.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('https://cdn.example/stories/a/audio.mp3');
    expect(output).toContain('https://cdn.example/stories.json');
  });

  it('does not write on a dry run', async () => {
    writeStory('a');
    const store = createMemoryStore();
    await run(['publish', '--all', '--dry-run'], deps(store));
    expect(store.calls).toEqual([]);
  });

  it('rebuilds only the index with the index command', async () => {
    const store = createMemoryStore({
      'stories/a/audio.mp3': 'x',
      'stories/a/cover.jpg': 'x',
      'stories/a/story.json': JSON.stringify({
        id: 'a',
        title: 't',
        description: 'd',
        ageRange: '3-6',
        genres: [],
        tags: [],
        language: 'en',
        color: '#7C83FD',
        emoji: '🌙',
        durationSec: 5,
      }),
    });
    await run(['index'], deps(store));
    expect(store.calls).toEqual(['put:stories.json']);
    expect(indexIds(store)).toEqual(['a']);
  });

  it('removes a story', async () => {
    writeStory('a');
    writeStory('b');
    const store = createMemoryStore();
    await run(['publish', '--all'], deps(store));
    await run(['remove', 'a'], deps(store));
    expect(indexIds(store)).toEqual(['b']);
    expect(store.objects.has('stories/a/audio.mp3')).toBe(false);
  });
});
