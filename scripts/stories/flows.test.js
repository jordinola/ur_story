const { createMemoryStore } = require('./memoryStore');
const { buildCatalog, publishStory, removeStory } = require('./flows');

const metaFor = (id) => ({
  id,
  title: `Story ${id}`,
  description: 'd',
  ageRange: '3-6',
  genres: ['Bedtime'],
  tags: ['Space'],
  language: 'en',
  color: '#7C83FD',
  emoji: '🌙',
  durationSec: 60,
});

const objectsFor = (id, { audio = true, cover = true, story = JSON.stringify(metaFor(id)) } = {}) => ({
  ...(audio ? { [`stories/${id}/audio.mp3`]: 'a' } : {}),
  ...(cover ? { [`stories/${id}/cover.jpg`]: 'c' } : {}),
  ...(story === null ? {} : { [`stories/${id}/story.json`]: story }),
});

const folderFor = (id) => ({
  meta: metaFor(id),
  uploads: [
    { key: `stories/${id}/audio.mp3`, body: 'a', contentType: 'audio/mpeg', cacheControl: 'public, max-age=86400' },
    { key: `stories/${id}/cover.jpg`, body: 'c', contentType: 'image/jpeg', cacheControl: 'public, max-age=86400' },
    {
      key: `stories/${id}/story.json`,
      body: JSON.stringify(metaFor(id)),
      contentType: 'application/json',
      cacheControl: 'public, max-age=60',
    },
  ],
  staleKeys: [`stories/${id}/cover.png`],
});

const indexIds = (store) => JSON.parse(store.objects.get('stories.json').body).map((entry) => entry.id);

describe('publishStory', () => {
  it('uploads the story files, then the index last, on an empty bucket', async () => {
    const store = createMemoryStore();
    const result = await publishStory(store, folderFor('a'), {});

    expect(store.calls.filter((c) => c.startsWith('put:'))).toEqual([
      'put:stories/a/audio.mp3',
      'put:stories/a/cover.jpg',
      'put:stories/a/story.json',
      'put:stories.json',
    ]);
    expect(store.objects.get('stories/a/audio.mp3')).toEqual({
      body: 'a',
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=86400',
    });
    expect(store.objects.get('stories.json')).toMatchObject({
      contentType: 'application/json',
      cacheControl: 'public, max-age=60',
    });
    expect(indexIds(store)).toEqual(['a']);
    expect(result).toEqual({ uploaded: expect.arrayContaining(['stories/a/audio.mp3']), indexCount: 1 });
  });

  it('keeps other stories in the index, sorted, without duplicating a republished one', async () => {
    const store = createMemoryStore(objectsFor('b'));
    await publishStory(store, folderFor('a'), {});
    expect(indexIds(store)).toEqual(['a', 'b']);
    await publishStory(store, folderFor('a'), {});
    expect(indexIds(store)).toEqual(['a', 'b']);
  });

  it('deletes the stale cover after the uploads and before the index', async () => {
    const store = createMemoryStore({ 'stories/a/cover.png': 'old' });
    await publishStory(store, folderFor('a'), {});
    expect(store.objects.has('stories/a/cover.png')).toBe(false);
    expect(store.calls.indexOf('delete:stories/a/cover.png')).toBeGreaterThan(store.calls.indexOf('put:stories/a/story.json'));
    expect(store.calls.indexOf('delete:stories/a/cover.png')).toBeLessThan(store.calls.indexOf('put:stories.json'));
  });

  it.each([
    ['an invalid story.json', objectsFor('bad', { story: '{}' })],
    ['an unreadable story.json', objectsFor('bad', { story: '{nope' })],
    ['a missing audio.mp3', objectsFor('bad', { audio: false })],
    ['a missing cover', objectsFor('bad', { cover: false })],
  ])('does not upload the index when another story has %s', async (_name, objects) => {
    const store = createMemoryStore(objects);
    await expect(publishStory(store, folderFor('a'), {})).rejects.toThrow(/bad/);
    expect(store.calls).not.toContain('put:stories.json');
  });

  it('touches nothing on a dry run and reports what it would do', async () => {
    const store = createMemoryStore(objectsFor('b'));
    const result = await publishStory(store, folderFor('a'), { dryRun: true });
    expect(store.calls).toEqual([]);
    expect(result.uploaded).toEqual(folderFor('a').uploads.map((u) => u.key));
    expect(result.indexCount).toBe(2);
  });
});

describe('removeStory', () => {
  it('writes the index without the story before deleting its files', async () => {
    const store = createMemoryStore({ ...objectsFor('a'), ...objectsFor('b') });
    const result = await removeStory(store, 'a', {});
    expect(indexIds(store)).toEqual(['b']);
    expect(store.calls.indexOf('put:stories.json')).toBeLessThan(store.calls.indexOf('delete:stories/a/audio.mp3'));
    expect([...store.objects.keys()].some((key) => key.startsWith('stories/a/'))).toBe(false);
    expect(result.deleted).toEqual(expect.arrayContaining(['stories/a/audio.mp3']));
  });

  it('writes an empty index when the last story is removed', async () => {
    const store = createMemoryStore(objectsFor('a'));
    await removeStory(store, 'a', {});
    expect(JSON.parse(store.objects.get('stories.json').body)).toEqual([]);
  });

  it('fails with "not found" and changes nothing for an unknown id', async () => {
    const store = createMemoryStore(objectsFor('b'));
    await expect(removeStory(store, 'nope', {})).rejects.toThrow(/not found/);
    expect(store.calls).toEqual([]);
  });

  it('does not touch the bucket on a dry run', async () => {
    const store = createMemoryStore(objectsFor('a'));
    await removeStory(store, 'a', { dryRun: true });
    expect(store.calls).toEqual([]);
  });
});

describe('buildCatalog', () => {
  it('omits the excluded story', async () => {
    const store = createMemoryStore({ ...objectsFor('a'), ...objectsFor('b') });
    expect((await buildCatalog(store, { excludeId: 'a' })).map((e) => e.id)).toEqual(['b']);
  });

  it('lists every broken story in one error', async () => {
    const store = createMemoryStore({ ...objectsFor('x', { audio: false }), ...objectsFor('y', { cover: false }) });
    await expect(buildCatalog(store)).rejects.toThrow(/x.*\n?.*y|y.*\n?.*x/s);
  });

  it('returns an empty catalog for an empty bucket', async () => {
    expect(await buildCatalog(createMemoryStore())).toEqual([]);
  });
});
