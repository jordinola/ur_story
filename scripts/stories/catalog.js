const STORIES_PREFIX = 'stories/';
const INDEX_KEY = 'stories.json';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MEDIA_CACHE = 'public, max-age=86400';
const JSON_CACHE = 'public, max-age=60';
const OWNER_FIELDS = ['id', 'title', 'description', 'ageRange', 'genres', 'tags', 'language', 'color', 'emoji'];

const storyKey = (id, file) => `${STORIES_PREFIX}${id}/${file}`;

const parseAgeRange = (ageRange) => {
  const match = typeof ageRange === 'string' ? /^(\d+)-(\d+)$/.exec(ageRange) : null;
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  return min <= max ? { min, max } : null;
};

const isStringList = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isText = (value) => typeof value === 'string' && value.trim() !== '';

const validateStoryMeta = (raw, folderName) => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return ['story.json must be a JSON object'];
  }
  const errors = [];
  if (!ID_PATTERN.test(String(raw.id ?? ''))) {
    errors.push('id must be a lowercase slug like "moon-tiger"');
  } else if (raw.id !== folderName) {
    errors.push(`id "${raw.id}" must match the folder name "${folderName}"`);
  }
  ['title', 'description', 'emoji'].forEach((field) => {
    if (!isText(raw[field])) errors.push(`${field} is required`);
  });
  if (!parseAgeRange(raw.ageRange)) errors.push('ageRange must look like "3-6" with min not above max');
  ['genres', 'tags'].forEach((field) => {
    if (!isStringList(raw[field])) errors.push(`${field} must be a list of strings`);
  });
  if (!/^[a-z]{2}$/.test(String(raw.language ?? ''))) errors.push('language must be a 2-letter code like "en"');
  if (!/^#[0-9a-fA-F]{6}$/.test(String(raw.color ?? ''))) errors.push('color must be a hex colour like "#7C83FD"');
  return errors;
};

const pickStoryMeta = (raw) => Object.fromEntries(OWNER_FIELDS.map((field) => [field, raw[field]]));

const buildIndexEntry = (meta, keys) => {
  const audio = storyKey(meta.id, 'audio.mp3');
  const cover = ['cover.jpg', 'cover.png'].map((file) => storyKey(meta.id, file)).find((key) => keys.includes(key));
  if (!keys.includes(audio)) throw new Error(`${meta.id}: audio.mp3 is missing from the bucket`);
  if (!cover) throw new Error(`${meta.id}: cover.jpg or cover.png is missing from the bucket`);
  const { min, max } = parseAgeRange(meta.ageRange);
  return {
    id: meta.id,
    title: meta.title,
    description: meta.description,
    durationSec: meta.durationSec,
    ageRange: meta.ageRange,
    ageMin: min,
    ageMax: max,
    genres: meta.genres,
    tags: meta.tags,
    language: meta.language,
    audio,
    cover,
    color: meta.color,
    emoji: meta.emoji,
  };
};

const buildIndex = (entries) => [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const CONTENT_TYPES = {
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json',
};

const extensionOf = (key) => key.slice(key.lastIndexOf('.'));

const contentTypeFor = (key) => CONTENT_TYPES[extensionOf(key)] ?? 'application/octet-stream';

const cacheControlFor = (key) => (extensionOf(key) === '.json' ? JSON_CACHE : MEDIA_CACHE);

module.exports = {
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
};
