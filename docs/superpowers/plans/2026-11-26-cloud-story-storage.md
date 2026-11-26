# Cloud Story Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local publish script that validates a story folder, uploads it to R2 under `stories/<id>/`, and regenerates `stories.json` from the bucket.

**Architecture:** Plain CommonJS Node scripts under `scripts/stories/`, in the style of `scripts/placeholderAudio.js` (`module.exports`, `require.main === module`, jest tests beside the code). All R2 access goes through a small `Store` object (`list`, `get`, `put`, `delete`); tests use an in-memory fake, and one thin adapter talks to R2 through the S3 API. The CLI is a thin wrapper over the flows.

**Tech Stack:** Node 22, jest (`jest-expo` preset, already configured), `@aws-sdk/client-s3` and `music-metadata` (new dev dependencies).

**Spec:** `docs/superpowers/specs/2026-11-26-cloud-story-storage-design.md`

## Global Constraints

- No app code changes: do not touch `src/`. Generated entries must be accepted by `normalizeStory` in `src/lib/catalog.ts` and use the `Story` field names from `src/types.ts`.
- npm, not bun. Commands are `npm run story:publish`, `npm run story:remove`, `npm run story:index`.
- `@aws-sdk/client-s3` and `music-metadata` are added with `npm install -D`. Check each package's current docs before using its API (`music-metadata` is ESM-only in recent versions: load it with dynamic `import()` from the CLI path only, never at jest-loaded module top level).
- Credentials only from env vars `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (optional `R2_PUBLIC_BASE_URL` for printing URLs), loaded from the git-ignored `.env.local`. Never in git.
- Bucket layout: `stories.json`, `stories/<id>/audio.mp3`, `stories/<id>/cover.jpg|png`, `stories/<id>/story.json`.
- Cache-Control: audio and cover `public, max-age=86400`; `story.json` and `stories.json` `public, max-age=60`. Content-Type: `audio/mpeg`, `image/jpeg`, `image/png`, `application/json`.
- Index entry fields: `id, title, description, durationSec, ageRange, ageMin, ageMax, genres, tags, language, audio, cover, color, emoji`; `audio` = `stories/<id>/audio.mp3`, `cover` = `stories/<id>/cover.<ext>`; sorted by `id`.
- Order: story files first, `stories.json` last. Remove: index without the story first, then delete its files.
- Per `docs/DEVELOPMENT_RULES.md`: branch `feat/cloud-story-storage` (already created), tests first, `npm run lint` and `npm run typecheck` clean, **one commit** `feat: ...` made in the last task, including the spec and this plan. No intermediate commits.

## Review Focus

Failure inputs the spec implies but its tasks would not otherwise exercise (each has a test in the named task):

1. `story.json` with `id` that differs from the folder name, has uppercase, spaces or `../` (Task 1).
2. A bucket with more than 1000 objects: the listing is paginated and every `story.json` must still be found (Task 4).
3. One broken or missing-file story already in the bucket: the index is not uploaded and the error names that story (Task 3).
4. First run against a bucket with no `stories.json` and no stories (Task 3).
5. Removing the last story, or a story that does not exist: `[]` is a valid index; an unknown id fails with a clear message and changes nothing (Task 3).

---

### Task 1: Catalog helpers

**Files:**
- Create: `scripts/stories/catalog.js`
- Test: `scripts/stories/catalog.test.js`

**Interfaces:**
- Produces:
  - `STORIES_PREFIX = 'stories/'`, `INDEX_KEY = 'stories.json'`
  - `storyKey(id: string, file: string): string` → `stories/<id>/<file>`
  - `parseAgeRange(ageRange: unknown): { min: number, max: number } | null` (null when not `"<n>-<n>"` or min > max)
  - `validateStoryMeta(raw: unknown, folderName: string): string[]` (empty array = valid)
  - `pickStoryMeta(raw: object): StoryMeta` (only `id, title, description, ageRange, genres, tags, language, color, emoji`)
  - `buildIndexEntry(meta: StoryMeta & { durationSec: number }, keys: string[]): IndexEntry` (`keys` = every bucket key under that story's folder; throws `Error` naming the story when `audio.mp3` or a `cover.jpg|png` is missing)
  - `buildIndex(entries: IndexEntry[]): IndexEntry[]` (sorted by `id`)
  - `contentTypeFor(key: string): string`, `cacheControlFor(key: string): string`

- [ ] **Step 1: Write the failing tests** in `catalog.test.js`:
  - `parseAgeRange('3-6')` equals `{ min: 3, max: 6 }`; `'6-3'`, `'all'`, `undefined` return `null`.
  - `validateStoryMeta`: a complete valid object with `folderName` equal to its `id` returns `[]`; each missing required field adds an error naming the field; `id` `'Moon Tiger'`, `'../x'`, `'MoonTiger'` and an id different from the folder name each return an error; `genres: 'x'` (not an array of strings) errors; `color: 'red'` (not `#RRGGBB`) errors; `language` other than a 2-letter code errors.
  - `pickStoryMeta` drops `audio`, `cover`, `durationSec`, `ageMin`, `ageMax` and unknown keys.
  - `buildIndexEntry` with keys `['stories/a/audio.mp3','stories/a/cover.png','stories/a/story.json']` gives `audio: 'stories/a/audio.mp3'`, `cover: 'stories/a/cover.png'`, `ageMin`/`ageMax` from `ageRange`, and the rest copied; missing audio or cover throws with the id in the message.
  - `buildIndex` sorts `[b, a]` to `[a, b]`; `buildIndex([])` equals `[]`.
  - `cacheControlFor('stories/a/audio.mp3')` and `.../cover.jpg` are `'public, max-age=86400'`; `'stories.json'` and `'stories/a/story.json'` are `'public, max-age=60'`. `contentTypeFor` returns `audio/mpeg`, `image/jpeg`, `image/png`, `application/json` for the four extensions.
- [ ] **Step 2: Run** `npx jest scripts/stories/catalog.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the functions above in `scripts/stories/catalog.js`, exported with `module.exports`. Id rule: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.
- [ ] **Step 4: Run** the same command. Expected: PASS.

---

### Task 2: Read and validate a story folder

**Files:**
- Create: `scripts/stories/storyFolder.js`
- Test: `scripts/stories/storyFolder.test.js` (uses a temp dir from `fs.mkdtempSync(os.tmpdir())`)

**Interfaces:**
- Consumes: `validateStoryMeta`, `pickStoryMeta`, `storyKey`, `contentTypeFor`, `cacheControlFor` from `catalog.js`.
- Produces:
  - `class StoryValidationError extends Error` with `errors: string[]`
  - `type Upload = { key: string, file?: string, body?: string, contentType: string, cacheControl: string }`
  - `readStoryFolder(dir: string, readDuration: (file: string) => Promise<number>): Promise<{ meta: StoryMeta & { durationSec: number }, uploads: Upload[], staleKeys: string[] }>`. `uploads` has the audio and cover (as `file` paths) and `story.json` (as `body`, the picked meta plus `durationSec`, 2-space JSON). `staleKeys` is the cover key of the other extension (so switching `cover.jpg` to `cover.png` removes the old one).

- [ ] **Step 1: Write the failing tests** in `storyFolder.test.js`, with a helper that writes a valid folder and a fake `readDuration = async () => 420.4`:
  - valid folder: `meta.durationSec` is `420`, `uploads` keys are `stories/<id>/audio.mp3`, `.../cover.jpg`, `.../story.json`, the story.json body parses to the picked meta plus `durationSec: 420`, `staleKeys` is `['stories/<id>/cover.png']`.
  - owner-written extra fields (`audio`, `durationSec: 1`) are ignored and replaced.
  - throws `StoryValidationError` whose `errors` mention: missing `story.json`; invalid JSON; missing `audio.mp3`; zero-byte `audio.mp3`; no cover; cover with both jpg and png present; `readDuration` returning `0` or rejecting; folder name different from `id`. Several problems at once are all reported in one error.
- [ ] **Step 2: Run** `npx jest scripts/stories/storyFolder.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `readStoryFolder` and `StoryValidationError` in `storyFolder.js`. Collect every error before throwing; round the duration with `Math.round`.
- [ ] **Step 4: Run** the same command. Expected: PASS.

---

### Task 3: Publish, remove and index flows

**Files:**
- Create: `scripts/stories/flows.js`, `scripts/stories/memoryStore.js` (in-memory `Store` used by tests; lives beside the code so the CLI tests can reuse it)
- Test: `scripts/stories/flows.test.js`

**Interfaces:**
- Consumes: Task 1 helpers; `Upload` from Task 2.
- Produces:
  - `type Store = { list(prefix: string): Promise<string[]>, get(key: string): Promise<string>, put(key: string, body: Buffer | string, options: { contentType: string, cacheControl: string }): Promise<void>, delete(keys: string[]): Promise<void> }`
  - `createMemoryStore(initial?: Record<string, string>): Store & { objects: Map<string, ...>, calls: string[] }` (`calls` records `put:<key>` / `delete:<key>` in order)
  - `buildCatalog(store: Store, options?: { excludeId?: string }): Promise<IndexEntry[]>` (lists `stories/`, groups keys by id, reads each `story.json`, `buildIndexEntry`; collects every failing story and throws one `Error` listing them all; never writes)
  - `uploadIndex(store: Store, entries: IndexEntry[]): Promise<void>` (puts `stories.json`)
  - `publishStory(store: Store, folder: { meta, uploads: Upload[], staleKeys: string[] }, options: { dryRun?: boolean }): Promise<{ uploaded: string[], indexCount: number }>`
  - `removeStory(store: Store, id: string, options: { dryRun?: boolean }): Promise<{ deleted: string[] }>`

- [ ] **Step 1: Write the failing tests** in `flows.test.js`:
  - `publishStory` on an empty store (first run, no `stories.json`) puts the three story keys, then `stories.json` **last** (assert the order in `calls`), with the right `contentType`/`cacheControl`; the index parses to one entry.
  - publishing a second story keeps the first in the index, sorted by id; republishing the same id does not duplicate it.
  - `staleKeys` are deleted after the uploads and before the index.
  - a story already in the bucket with an invalid `story.json`, or missing `audio.mp3`, makes `publishStory` throw with that id in the message and `calls` contains **no** `stories.json` put.
  - `dryRun: true` makes no `put` or `delete` calls and returns the keys it would upload and `indexCount`.
  - `removeStory` writes `stories.json` without the id **before** deleting its keys (assert order); removing the last story writes `[]`; removing an unknown id throws "not found" and makes no calls.
  - `buildCatalog` with `excludeId` omits that story.
- [ ] **Step 2: Run** `npx jest scripts/stories/flows.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `flows.js` and `memoryStore.js`. `publishStory` order: puts of `uploads`, deletes of `staleKeys`, `buildCatalog`, `uploadIndex`. Because the new story's files are already in the store at catalog time, `buildCatalog` includes it; in `dryRun` compute `indexCount` as the catalog excluding the id plus one.
- [ ] **Step 4: Run** the same command. Expected: PASS.

---

### Task 4: R2 adapter, duration reader and credentials

**Files:**
- Create: `scripts/stories/r2Store.js`, `scripts/stories/audioDuration.js`
- Modify: `package.json` / `package-lock.json` (dev dependencies, via `npm install -D @aws-sdk/client-s3 music-metadata`)
- Test: `scripts/stories/r2Store.test.js`

**Interfaces:**
- Consumes: `Store` from Task 3.
- Produces:
  - `createR2Store(client: { send(command: unknown): Promise<any> }, bucket: string): Store` (uses `ListObjectsV2Command` following `NextContinuationToken`, `GetObjectCommand`, `PutObjectCommand` with `ContentType` and `CacheControl`, `DeleteObjectsCommand` in batches of at most 1000 keys)
  - `readR2Config(env: Record<string, string | undefined>): { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl?: string }` (throws `Error` listing every missing required variable by name)
  - `createS3Client(config): S3Client` (endpoint `https://<accountId>.r2.cloudflarestorage.com`, region `auto`)
  - `readMp3Duration(file: string): Promise<number>` in `audioDuration.js` (seconds, using `music-metadata` through dynamic `import()`; rejects when no duration is found)

- [ ] **Step 1: Install** the two dev dependencies with `npm install -D @aws-sdk/client-s3 music-metadata`; read their current docs for the API names used above.
- [ ] **Step 2: Write the failing tests** in `r2Store.test.js` with a fake `client.send` that records commands:
  - `list('stories/')` over a fake that returns two pages (a `NextContinuationToken` on the first, 1000 keys then 3 keys) returns all 1003 keys (Review Focus 2).
  - `get` returns the body text; `put` sends `ContentType` and `CacheControl`; `delete` of 2500 keys sends three `DeleteObjectsCommand`s.
  - `readR2Config({})` throws a message containing all four variable names; with all four set it returns the config; `publicBaseUrl` is optional.
- [ ] **Step 3: Run** `npx jest scripts/stories/r2Store.test.js`. Expected: FAIL.
- [ ] **Step 4: Implement** `r2Store.js` and `audioDuration.js` per the signatures. `audioDuration.js` must not be imported by any test (the duration reader is injected elsewhere), because `music-metadata` is ESM-only.
- [ ] **Step 5: Run** the same command. Expected: PASS.

---

### Task 5: CLI, npm scripts and git ignore

**Files:**
- Create: `scripts/storyCli.js`
- Test: `scripts/storyCli.test.js`
- Modify: `package.json` (scripts), `.gitignore`

**Interfaces:**
- Consumes: Tasks 2 to 4.
- Produces:
  - `parseArgs(argv: string[]): { command: 'publish' | 'remove' | 'index', folders: string[], all: boolean, dryRun: boolean, id?: string }` (throws `Error` on an unknown command or flag, on `publish` with neither folders nor `--all`, and on `remove` without an id)
  - `run(argv: string[], deps: { store: Store, readDuration: (file: string) => Promise<number>, contentRoot: string, log: (line: string) => void, publicBaseUrl?: string }): Promise<void>` (does the work; testable with the memory store)
  - npm scripts `story:publish`, `story:remove`, `story:index`, each `node scripts/storyCli.js <command>`, so `npm run story:publish -- content/stories/sleepy-moon --dry-run` works.

- [ ] **Step 1: Write the failing tests** in `storyCli.test.js`:
  - `parseArgs(['publish', 'content/stories/a', '--dry-run'])` and `parseArgs(['publish', '--all'])`, `['remove', 'a']`, `['index']` parse as specified; `[]`, `['publish']`, `['remove']`, `['publish', '--nope']` throw.
  - `run(['publish', '--all'], ...)` over a temp content root with two valid folders and the memory store publishes both and uploads one `stories.json` listing both; with one invalid folder it throws and uploads nothing for any story.
  - `run(['publish', folder], ...)` logs a URL per uploaded key when `publicBaseUrl` is set.
  - `run(['index'], ...)` rebuilds and uploads `stories.json` only; `run(['remove', 'a'], ...)` removes it.
- [ ] **Step 2: Run** `npx jest scripts/storyCli.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `scripts/storyCli.js` with the `require.main === module` pattern: `process.loadEnvFile('.env.local')` when the file exists, then `readR2Config`, `createR2Store(createS3Client(...))`, `readMp3Duration`, `contentRoot` = `<repo>/content/stories`. `--all` publishes each subfolder in alphabetical order, validating all folders before uploading any. Print errors without a stack trace and exit 1.
- [ ] **Step 4: Add** the three npm scripts to `package.json`, and to `.gitignore` the lines `/content/stories/*/*` and `!/content/stories/*/story.json`.
- [ ] **Step 5: Run** `npx jest scripts` and check `git status --short content` shows only the eight `story.json` files as new. Expected: tests PASS; media files not listed.

---

### Task 6: End-to-end check, migration and the single commit

**Files:**
- Modify: none (verification and commit), `.env.local` (created by the owner, never committed)

- [ ] **Step 1: Run the full checks.** `npm test`, `npm run lint`, `npm run typecheck`. Expected: all pass with no new warnings.
- [ ] **Step 2: Ask the owner** to create `.env.local` with the four R2 variables (R2 API token with read and write on the bucket). Do not read or print the file.
- [ ] **Step 3: Dry run.** `npm run story:publish -- --all --dry-run`. Expected: eight stories validated, each with `durationSec` 420 (the test audio), the keys listed, nothing uploaded.
- [ ] **Step 4: Migrate.** `npm run story:publish -- --all`. Expected: files under `stories/<id>/` and a `stories.json` with eight entries in the bucket; the printed URLs return HTTP 200 (`curl -I`).
- [ ] **Step 5: Check the app.** `GET <ASSET_BASE_URL>/stories.json` parses, then run the app on a dev build: the catalog lists the eight stories, one plays, and a download still works. Record anything unexpected instead of working around it.
- [ ] **Step 6: Remove check.** Publish a temporary ninth folder, run `npm run story:remove -- <id>`, and confirm it is gone from the bucket and the index.
- [ ] **Step 7: Single commit.** Stage the scripts, tests, `package.json`, `package-lock.json`, `.gitignore`, the eight `content/stories/*/story.json`, the spec and this plan; commit once as `feat: add cloud story storage and publish script` with the repo's commit body format and the required `Co-Authored-By` line. Never commit `.env.local`, media files or `.mcp.json`.
- [ ] **Step 8: Trello.** Move the card to In Test when the PR is opened, add the PR link and the manual results from steps 4 to 6 (per `docs/DEVELOPMENT_RULES.md` section 12).
