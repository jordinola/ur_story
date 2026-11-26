# Cloud story storage (design)

Trello: "Cloud story storage: per-story R2 folders + generated catalog" (https://trello.com/c/9cVBBFoE). Builds on `src/lib/catalog.ts` (the catalog loader) and the existing R2 bucket behind `ASSET_BASE_URL`.

## Intent

Stories are hand-edited in `src/data/stories.json` and their audio sits loose in the bucket. The owner (one person, for now) wants to add a story by preparing one folder and running one command, with the bucket holding everything the app needs: audio, cover and metadata. Nobody should edit the catalog file by hand, and a new story should reach the app without an app update.

## Goals

- **One folder per story in the bucket**: `stories/<id>/audio.mp3`, `cover.jpg` (or `.png`) and `story.json`.
- **A local `content/stories/<id>/` folder is the working copy** the owner prepares and publishes from. `story.json` is committed; the media files are not.
- **A publish script** (approach A, chosen by the user) that validates a story folder, uploads it and rebuilds the catalog.
- **`stories.json` is generated**, never edited by hand. It is rebuilt from the `story.json` files in the bucket, so the bucket is the source of truth and any machine with credentials can publish.
- **Real audio duration**: the script reads it from the mp3 and writes `durationSec`; nobody types it.
- **No app change is needed for the catalog**: the generated entries keep today's `Story` field names, with `audio` and `cover` set to the new bucket paths. Old app versions keep working.
- **Safe publish order**: files first, index last, so the app never sees a story whose files are missing.
- **Cache headers set at upload** so a CDN or the device can cache media and keep the index fresh.
- **Migrate the 8 existing stories** (test audio for now) through the same script, which doubles as the script's end-to-end test.

## Non-goals

- Streaming changes. Streaming from R2 stays; a cache-then-play step was rejected (it delays playback and adds nothing over streaming plus offline downloads).
- An admin UI, a Cloudflare Worker, or automatic rebuilds on upload (approaches B and C).
- Showing the cover inside the app (cards keep colour + emoji). The cover is used for the lock screen artwork, which is the separate "iOS player widget" card.
- The real story audio. The 8 audio files are one test mp3 copied eight times; the owner replaces them later and republishes.
- Setting up the Cloudflare custom domain / CDN. See Constraints.
- Updating the bundled `src/data/stories.json` fallback, deleting the old `audio/<id>.mp3` objects, a `narrator`/`author` field, or per-story ordering.

## Anti-goals

- An index that lists a story whose audio or cover is not in the bucket.
- An index that silently drops a story because its `story.json` is broken (fail loudly, upload nothing).
- Credentials in git or in the app bundle.
- Media files (mp3, covers) committed to git.
- A publish that needs the owner to remember any manual step in the right order.

## Constraints

- No Expo or React Native code changes for the catalog; this is repo tooling (Node scripts, like `scripts/placeholderAudio.js`). Node 22 is installed; `bun` is not, and the repo uses npm, so commands are `npm run ...`.
- R2 is S3-compatible. Uploads use `@aws-sdk/client-s3` against `https://<account>.r2.cloudflarestorage.com`. It and the mp3 duration reader (`music-metadata`) are **dev dependencies** of the repo, not shipped in the app. Add with `npm install -D` (they are not Expo packages, so `expo install` does not apply). Check each package's current docs before using its API.
- The app's `Story` type and `normalizeStory` stay the source of the catalog shape; the script must produce entries `normalizeStory` accepts.
- `ASSET_BASE_URL` (`https://pub-...r2.dev`) is an r2.dev development URL. Cloudflare documents r2.dev as rate-limited and meant for development, and it does not serve through the Cloudflare cache. Real CDN caching needs a custom domain on the bucket, which is a manual Cloudflare setup the owner does separately. The script sets cache headers either way so they take effect once that domain exists.
- Per `docs/DEVELOPMENT_RULES.md`: branch `feat/cloud-story-storage` from `main`, tests first and passing, lint and typecheck clean, one `feat:` commit.

## Approaches considered

- **A. Local publish script (chosen by the user).** Validates, uploads, rebuilds the index. No new infrastructure, fits `scripts/`, can read real audio duration and check files. One manual step: running the command. Needs R2 credentials on the owner's machine.
- **B. Worker rebuilds the index on R2 upload events.** No manual step, but adds a Worker, event notifications and a queue to maintain, and cannot easily check the audio. Overbuilt for one person. Can be added later without changing the folder layout or the app.
- **C. A Worker lists the bucket on every request.** Always current, but slower and costlier per request, and the app loses a plain static file. Rejected.

## Design

### Layout

In the bucket:

```
stories.json                      generated index (array of Story entries)
stories/<id>/audio.mp3
stories/<id>/cover.jpg            or cover.png
stories/<id>/story.json           metadata the owner wrote, plus durationSec
```

Locally (the working copy; `story.json` committed, media git-ignored):

```
content/stories/<id>/audio.mp3
content/stories/<id>/cover.jpg
content/stories/<id>/story.json
```

`.gitignore` gets `/content/stories/*/*` and `!/content/stories/*/story.json`. This folder already exists with the 8 stories, covers (colour + emoji renders, 1024x1024) and `story.json` files.

### `story.json` (what the owner writes)

`id` (slug, equal to the folder name), `title`, `description`, `ageRange` (`"min-max"`), `genres`, `tags`, `language`, `color` (hex), `emoji`. No `durationSec`, `ageMin`/`ageMax`, `audio` or `cover`: the script derives them. The copy uploaded to the bucket also carries the derived `durationSec`.

### Commands (npm scripts; names are proposals)

- `npm run story:publish -- <folder> [--dry-run]` publishes one story folder. `--all` publishes every folder under `content/stories/` (the migration).
- `npm run story:remove -- <id>` removes a story.
- `npm run story:index` rebuilds and uploads `stories.json` only.

Credentials come from env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`), loaded from the git-ignored `.env.local`. `R2_PUBLIC_BASE_URL` is optional and only used to print URLs.

### Publish flow

1. Read and **validate** the folder: required `story.json` fields and types; `id` is a lowercase slug equal to the folder name; `ageRange` parses; `audio.mp3` exists and has a readable duration; a cover exists and is a jpg or png. Any problem stops the run with a message naming the story and the problem; nothing is uploaded.
2. **Read the duration** from the mp3 (rounded to whole seconds) and set `durationSec`.
3. **Upload** `audio.mp3`, the cover and `story.json` to `stories/<id>/` with the right `Content-Type` and `Cache-Control`.
4. **Rebuild the index**: list the `stories/` prefix, read every `story.json`, and fail without uploading if any is missing fields, unreadable, or has no `audio.mp3` or cover in the listing. The cover extension (jpg or png) is taken from that listing, and publishing a story deletes the cover of the other extension. Turn each into an index entry (below) and sort by `id` for stable output.
5. **Upload `stories.json` last.**
6. Print the story's public URLs. `--dry-run` runs steps 1, 2 and 4 and prints what would be uploaded, touching nothing.

### Index entry

Today's `Story` shape: `id`, `title`, `description`, `durationSec`, `ageRange`, `ageMin`, `ageMax`, `genres`, `tags`, `language`, `audio` (`stories/<id>/audio.mp3`), `cover` (`stories/<id>/cover.<ext>`), `color`, `emoji`. `ageMin`/`ageMax` come from `ageRange`. `resolveUrl` already turns relative paths into full URLs, so the app needs no change.

### Remove flow

Rebuild and upload the index **without** the story first, then delete `stories/<id>/`. The app never points at files that are gone.

### Cache headers (my call, see below)

`audio` and cover: `public, max-age=86400`. `story.json` and `stories.json`: `public, max-age=60`.

### Migration

Run `story:publish -- --all` over the 8 test folders. That uploads everything, creates the first `stories.json` (the bucket has none today, so the app has only ever used the bundled catalog) and the app starts reading from the bucket. The old `audio/<id>.mp3` objects and the bundled `stories.json` are left alone in this ticket: the bundled fallback still points at the old paths.

### Testing

Pure logic (validation, `ageRange` parsing, building an index entry, choosing headers, planning the upload and remove order) is unit tested with jest like `scripts/placeholderAudio.test.js`. The R2 calls sit behind a small storage object (list, get, put, delete) with an in-memory fake in the tests, so the publish and remove flows, including the files-before-index order and the fail-loudly rules, are tested without the network. A manual run against the real bucket using the 8 test stories is the end-to-end check: publish, then open the app and confirm a story lists, streams and still downloads for offline use.

## Left to the builder

File and function names, the CLI argument parsing, how the script finds the repo root, the exact validation messages, handling of an empty bucket on the first run, and rounding of the duration.

## Calls I made (not discussed; please check)

- **Cache lifetimes.** Audio and covers are 1 day, not "immutable for a year", because file paths are not versioned: replacing a story's audio in place would otherwise be stale for a year. Index and `story.json` are 60 seconds so new stories show up quickly.
- **Index order is by `id`**, not by publish date or a custom order. This may change how stories are ordered in the app (today: the bundled order).
- **Cover is `cover.jpg` or `cover.png`; audio is `audio.mp3` only.** Other formats can be added later.
- **Single publisher, no locking.** Two people publishing at once could race on the index; acceptable while it is one owner.
- **Old `audio/` objects and the bundled catalog stay** until a later cleanup.
- **`story:publish -- --all` and `story:index` commands** beyond the single publish and remove you described.
- **Dev dependencies** `@aws-sdk/client-s3` and `music-metadata`.
- **Dropping the `bun run` wording** from the earlier discussion: bun is not installed, so these are npm scripts.
