const fs = require('node:fs');
const path = require('node:path');
const { storyKey, validateStoryMeta, pickStoryMeta, contentTypeFor, cacheControlFor } = require('./catalog');

const COVER_FILES = ['cover.jpg', 'cover.png'];

class StoryValidationError extends Error {
  constructor(folder, errors) {
    super(`${path.basename(folder)}: ${errors.join('; ')}`);
    this.name = 'StoryValidationError';
    this.errors = errors;
  }
}

const readJson = (file) => {
  if (!fs.existsSync(file)) return { error: 'story.json is missing' };
  try {
    return { value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { error: 'story.json is not valid JSON' };
  }
};

const readDurationSafely = async (file, readDuration) => {
  try {
    const seconds = Math.round(await readDuration(file));
    return seconds > 0 ? { seconds } : { error: 'audio.mp3 has no readable duration' };
  } catch {
    return { error: 'audio.mp3 has no readable duration' };
  }
};

const upload = (key, extra) => ({ key, ...extra, contentType: contentTypeFor(key), cacheControl: cacheControlFor(key) });

const readStoryFolder = async (dir, readDuration) => {
  const folderName = path.basename(dir);
  const errors = [];

  const story = readJson(path.join(dir, 'story.json'));
  if (story.error) errors.push(story.error);
  else errors.push(...validateStoryMeta(story.value, folderName));

  const audioFile = path.join(dir, 'audio.mp3');
  const hasAudio = fs.existsSync(audioFile) && fs.statSync(audioFile).size > 0;
  if (!hasAudio) errors.push('audio.mp3 is missing or empty');

  const covers = COVER_FILES.filter((file) => fs.existsSync(path.join(dir, file)));
  if (covers.length === 0) errors.push('cover.jpg or cover.png is missing');
  if (covers.length === 2) errors.push('both cover.jpg and cover.png exist; keep only one');

  let durationSec = 0;
  if (hasAudio) {
    const duration = await readDurationSafely(audioFile, readDuration);
    if (duration.error) errors.push(duration.error);
    else durationSec = duration.seconds;
  }

  if (errors.length > 0) throw new StoryValidationError(dir, errors);

  const meta = { ...pickStoryMeta(story.value), durationSec };
  const cover = covers[0];
  return {
    meta,
    uploads: [
      upload(storyKey(meta.id, 'audio.mp3'), { file: audioFile }),
      upload(storyKey(meta.id, cover), { file: path.join(dir, cover) }),
      upload(storyKey(meta.id, 'story.json'), { body: `${JSON.stringify(meta, null, 2)}\n` }),
    ],
    staleKeys: COVER_FILES.filter((file) => file !== cover).map((file) => storyKey(meta.id, file)),
  };
};

module.exports = { readStoryFolder, StoryValidationError };
