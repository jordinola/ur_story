const fs = require('node:fs');
const {
  STORIES_PREFIX,
  INDEX_KEY,
  validateStoryMeta,
  pickStoryMeta,
  buildIndexEntry,
  buildIndex,
  contentTypeFor,
  cacheControlFor,
} = require('./catalog');

const idOf = (key) => key.slice(STORIES_PREFIX.length).split('/')[0];

const groupKeysById = (keys) =>
  keys.reduce((groups, key) => {
    const id = idOf(key);
    groups.set(id, [...(groups.get(id) ?? []), key]);
    return groups;
  }, new Map());

const entryFromBucket = async (store, id, keys) => {
  const metaKey = `${STORIES_PREFIX}${id}/story.json`;
  if (!keys.includes(metaKey)) throw new Error('story.json is missing');
  let raw;
  try {
    raw = JSON.parse(await store.get(metaKey));
  } catch {
    throw new Error('story.json is not valid JSON');
  }
  const errors = validateStoryMeta(raw, id);
  if (!(raw?.durationSec > 0)) errors.push('durationSec must be a positive number');
  if (errors.length > 0) throw new Error(errors.join('; '));
  return buildIndexEntry({ ...pickStoryMeta(raw), durationSec: raw.durationSec }, keys);
};

const buildCatalog = async (store, { excludeId } = {}) => {
  const groups = groupKeysById(await store.list(STORIES_PREFIX));
  const entries = [];
  const failures = [];
  for (const [id, keys] of groups) {
    if (id === excludeId) continue;
    try {
      entries.push(await entryFromBucket(store, id, keys));
    } catch (error) {
      failures.push(error.message.startsWith(`${id}:`) ? error.message : `${id}: ${error.message}`);
    }
  }
  if (failures.length > 0) throw new Error(`Cannot build stories.json:\n${failures.join('\n')}`);
  return buildIndex(entries);
};

const uploadIndex = (store, entries) =>
  store.put(INDEX_KEY, `${JSON.stringify(buildIndex(entries), null, 2)}\n`, {
    contentType: contentTypeFor(INDEX_KEY),
    cacheControl: cacheControlFor(INDEX_KEY),
  });

const publishStory = async (store, folder, { dryRun = false } = {}) => {
  const uploaded = folder.uploads.map((upload) => upload.key);
  if (dryRun) {
    const others = await buildCatalog(store, { excludeId: folder.meta.id });
    return { uploaded, indexCount: others.length + 1 };
  }
  for (const upload of folder.uploads) {
    const body = upload.body ?? fs.readFileSync(upload.file);
    await store.put(upload.key, body, { contentType: upload.contentType, cacheControl: upload.cacheControl });
  }
  await store.delete(folder.staleKeys);
  const catalog = await buildCatalog(store);
  await uploadIndex(store, catalog);
  return { uploaded, indexCount: catalog.length };
};

const removeStory = async (store, id, { dryRun = false } = {}) => {
  const keys = await store.list(`${STORIES_PREFIX}${id}/`);
  if (keys.length === 0) throw new Error(`Story "${id}" not found in the bucket`);
  if (dryRun) return { deleted: keys };
  await uploadIndex(store, await buildCatalog(store, { excludeId: id }));
  await store.delete(keys);
  return { deleted: keys };
};

module.exports = { buildCatalog, uploadIndex, publishStory, removeStory };
