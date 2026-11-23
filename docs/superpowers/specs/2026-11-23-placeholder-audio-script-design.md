# Placeholder audio script

## Goal
Let the app play something before real recordings exist. One command generates an MP3 per story in `src/data/stories.json`, named to match each story's `audio` path, ready to upload to the Cloudflare R2 bucket later.

## Behavior
- `npm run audio:placeholders` reads `src/data/stories.json` and writes `placeholder-audio/<story.audio>` (for example `placeholder-audio/audio/sleepy-moon.mp3`).
- Each file is a quiet 220 Hz tone, mono, 64 kbps MP3, as long as the story's `durationSec`. The tone makes it obvious that audio is really playing.
- Flags: `--seconds <n>` overrides the length for every file (short files for fast testing), `--silent` writes silence instead of a tone, `--force` regenerates existing files. Existing files are skipped by default.
- Stories whose `audio` is a full `https://` URL are skipped, since they don't live in our bucket.
- Fails with a clear message if `ffmpeg` is not on the PATH (`brew install ffmpeg`).
- Output folder is git-ignored.

## Structure
`scripts/placeholderAudio.js` exports pure helpers (`planOutputs`, `buildFfmpegArgs`, `parseArgs`) that are unit tested. The CLI part runs only when the file is executed directly and shells out to `ffmpeg` with `execFileSync` (no shell, so paths are never interpreted).

## Out of scope
Uploading to R2, text-to-speech, and wiring `ASSET_BASE_URL`.
