# Offline downloads (design)

Trello: "feat: Offline downloads". Builds on the existing catalog loader (`catalog.ts`), `PlayerProvider`, the story actions sheet and the parental gate.

## Intent

Bedtime at home works on wifi, but the car and travel do not. A parent should be able to save stories to the phone ahead of time and have them play with no connection, through this app only.

## Goals

- **Manual, per-story download** (option A, chosen by the user). A "Download" choice for a story appears in the story action sheet on cards (the "⋯" menu and long-press) and in the More sheet on the story screen. While downloading, the story shows its progress and can be cancelled.
- **Playback prefers the local file** and falls back to streaming. Queue, history, Shuffle and Repeat are unchanged.
- **Downloaded stories show a badge** on the card ("Downloaded", same style as the "✓ Listened" badge). A **"Downloaded" filter chip** on the home screen (next to "All stories" and "Favorites") lists them with a line showing the count and total size, so a parent can see what is available offline.
- **Only a parent can delete.** "Remove download" (in the same action sheet, on a downloaded story) goes through the parental gate. Starting a download is not gated (a child can start one).
- **Downloaded files are private to the app**: stored under `Paths.document/downloads/`, never exposed in the Files app (do not enable `enableFileSharing`), and playable only through this app.
- Downloads are per device, not per profile.
- A failed, cancelled or interrupted download leaves no half-file behind and is never counted as downloaded.

## Non-goals

- Automatic downloads of favorites or the queue (option B/C from the brainstorm), a wifi-only rule or network detection, background downloads that continue after the app is suspended, resuming a half-finished download, a storage cap.
- Downloading cover images: the current catalog has no `cover` field (stories use an emoji and a colour). Add it when covers exist.
- Detecting that a story's audio changed upstream while a downloaded copy exists (to refresh, remove and download again).
- Cleaning up downloaded files whose story is no longer in the catalog.

## Anti-goals

- Playing or listing a story as downloaded when its file is missing or incomplete.
- Absolute file paths stored anywhere (the iOS app container path can change on update); paths are rebuilt from `Paths.document` every time.
- A child being able to delete a parent's saved stories.
- Downloads exposed outside the app, or counted against iCloud backup if that can be avoided (check the docs; not stated).
- Breaking streaming: with no download, playback behaves exactly as today.

## Constraints

- iOS first; 44 pt targets; accessibility role/label/state; theme tokens; no new dependency (`expo-file-system` ~58 is already installed). Use the current API (`File`, `Directory`, `Paths`, `File.createDownloadTask`), not `expo-file-system/legacy`. Check the SDK 58 docs before using any API.
- Remote audio is on R2 via `resolveUrl(story.audio)`. The catalog still loads from cache and the bundled JSON when offline, so the list works offline.
- Playback logic stays behind `PlayerProvider`; UI does not touch the player or file APIs directly.
- Kids' app rules: no third-party analytics or tracking; downloads are explicit and visible.

## Approaches considered

- **A. A saved index plus the files.** Two sources of truth (AsyncStorage list and the files); an interrupted download or an app update can leave them out of step, so it needs reconcile code. Rejected.
- **B. The downloads folder is the index.** Files under `downloads/` named from the story id; a `DownloadsProvider` lists the folder at launch and keeps an in-memory set. Download to a temporary name and rename on success. Nothing can drift. **Chosen** (by the user).
- **C. Store downloads in `LibraryProvider`.** Library data is per profile; downloads belong to the device. Rejected.

## Design

### Storage layer (`src/lib/downloadStore.ts`, names are proposals)

A thin boundary around `expo-file-system` so the rest of the app never touches it:
- `listDownloaded(): Promise<DownloadedFile[]>` (story id, size in bytes), by listing `Paths.document/downloads/`; ignores `*.part` files and deletes them (leftovers from an interrupted download).
- `download(story, onProgress, signal): Promise<void>` downloads `resolveUrl(story.audio)` to `downloads/<id>.<ext>.part` (extension from the audio path, default `mp3`) with `File.createDownloadTask`, then renames to `<id>.<ext>` only when finished. Cancel (`signal` or task cancel) or any failure deletes the `.part` file and rejects.
- `remove(id): Promise<void>`, `localUri(id): string | null` (`file://` URI built from `Paths.document` each time, or null when the file is missing).
Pure helpers (`downloadFileName(story)`, parsing a file name back to a story id, formatting sizes via the existing `format.ts` style) live in `src/lib/downloads.ts` with unit tests.

### `DownloadsProvider` (`src/lib/DownloadsProvider.tsx`)

Sits above `PlayerProvider` in `_layout.tsx`. Exposes:
- `ready: boolean`, `downloaded: Record<string, { sizeBytes: number }>` (story id to info), `totalBytes`.
- `progress: Record<string, number>` (0..1) for downloads in flight, `errors: Record<string, string>` (friendly message, cleared on retry).
- `download(story)`, `cancel(id)`, `remove(id)`, `localUri(id)`.
Downloads run one at a time in the order requested (a small queue); a second request while one is running waits. On launch it lists the folder (`ready` flips after). If the list fails, treat as nothing downloaded and keep going.

### Player

`PlayerProvider.play` resolves the source as `useDownloads().localUri(story.id) ?? resolveUrl(story.audio)`. A story with a local file that fails to load falls back to streaming once (and the file stays; the parent can remove it).

### UI

- `showStoryActions` gains a fourth choice that depends on state: "Download" (not downloaded, not downloading), "Cancel download" (in flight), "Remove download" (downloaded). "Remove download" runs the parental gate first (reuse `ParentalGate` in a `Modal`, as `BedtimeEntry` does).
- `StoryCard` shows a "Downloaded" badge, or "Downloading 40%" while in flight (text badges in the existing style); the card accessibility label mentions the state.
- Story screen More sheet gets a "Download" / "Cancel download" / "Remove download" row for the current story.
- Home screen: a third filter chip "Downloaded" (with a count) showing downloaded stories; above the list a single line "3 stories · 42 MB". An empty state explains how to download.
- Errors: a friendly message on the card/sheet ("Could not download this story. Check your connection.").

## Calls made by the author (not yet the user's)

1. Covers are out of scope (no `cover` in the catalog).
2. Downloads queue one at a time.
3. The "Downloaded" filter chip on the home screen replaces a separate Downloads screen; removal happens from the story action sheet.
4. A locally playing story that fails falls back to streaming once.
5. Stale or orphaned downloads are not detected.

## Calls made after the builder check (the author's calls, not yet the user's)

6. **Playback proof gates the rest.** The first task proves on a device that expo-audio plays a downloaded `file://` URI. If it does not, work stops and the result is reported to the user before any UI is built (no silent plan B).
7. **Local file that will not load:** if a local source has not loaded after about 10 seconds, or the player reports an error, `PlayerProvider` replaces the source with the streaming URL once for that play (a flag prevents loops). The file stays; a parent can remove it.
8. **Removing the story that is playing is blocked:** while a story is the player's current story, "Remove download" is not offered (the action sheet omits it). Stories in the queue or history are fine; they fall back to streaming.
9. **Gate host:** a `RemoveDownloadGate` component mounted once in `_layout.tsx` shows the `ParentalGate` in a `Modal`, driven by `DownloadsProvider.requestRemove(story)` (the provider holds the story awaiting confirmation; passing the gate calls `remove`). From the More sheet the sheet closes first, then `requestRemove` runs, so two modals never stack.
10. **Interrupted downloads:** when the app returns to the foreground, any download whose task is no longer active is marked failed ("Download interrupted. Try again."), its `.part` file removed, and its progress cleared.
11. **Filter chip:** "Downloaded" is a third value of the existing exclusive home filter (All / Favorites / Downloaded). The count and total size are for downloaded stories that exist in the catalog only; orphaned files are not counted or shown.
12. **No cellular warning** and no network detection (that would need `expo-network`, a new dependency).

## Left to the builder

- Exact file and type names; whether the rename uses `File.move`; the extension default; how the `ParentalGate` modal is shared between `BedtimeEntry` and the remove action (extract or duplicate minimally, follow existing patterns).
- First task: prove on a device that expo-audio plays a downloaded `file://` URI (the docs show no example), before building UI on top.
