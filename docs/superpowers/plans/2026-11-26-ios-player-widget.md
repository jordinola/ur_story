# iOS Player Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The iOS lock screen, Control Center and Dynamic Island player shows the story's artwork, real duration and progress, and +/-15s buttons.

**Architecture:** One change to the existing `setActiveForLockScreen` call in `PlayerProvider.play()`: pass the album and artwork in the metadata and `{ isLiveStream: false, showSeekBackward: true, showSeekForward: true, seekBackwardIntervalSeconds: 15, seekForwardIntervalSeconds: 15 }` as options.

**Tech Stack:** `expo-audio` ~58.0.12, jest with `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-11-26-ios-player-widget-design.md`

## Global Constraints

- Only `src/lib/PlayerProvider.tsx` and `src/lib/PlayerProvider.test.tsx` change. No new dependency, no new `Story` field.
- Metadata: `title: story.title`, `artist: 'UR Story'`, `albumTitle: story.genres[0] ?? 'Bedtime stories'`, `artworkUrl: story.cover ? resolveUrl(story.cover) : undefined`.
- Options: `{ isLiveStream: false, showSeekBackward: true, showSeekForward: true, seekBackwardIntervalSeconds: 15, seekForwardIntervalSeconds: 15 }`. No next/previous buttons.
- Per `docs/DEVELOPMENT_RULES.md`: branch `bug/ios-player-widget` (already created), tests first, `npm test`, `npm run lint` and `npm run typecheck` clean, **one commit** `bug: ...` made in the last task including the spec and this plan. No intermediate commits.

## Review Focus

1. A story with no `cover` or with no genres: `artworkUrl` is `undefined` and the album is `Bedtime stories` (Task 1 tests).
2. A `cover` that is already a full `https` URL: `resolveUrl` leaves it unchanged (Task 1 test).
3. Resuming the same story and the profile-switch clear must still behave as before (existing tests stay green).

---

### Task 1: Pass the widget metadata and options

**Files:**
- Modify: `src/lib/PlayerProvider.tsx` (the `setActiveForLockScreen` call in `play()`)
- Test: `src/lib/PlayerProvider.test.tsx` (the `play` describe, next to the existing lock-screen test)

**Interfaces:**
- Consumes: `resolveUrl(path: string): string` (already imported in `PlayerProvider.tsx`), `makeStory(overrides)` from `src/test/fixtures.ts`.
- Produces: no new interface.

- [ ] **Step 1: Write the failing tests.** In the `play` describe of `PlayerProvider.test.tsx`, add tests that call `result.current.play(...)` and assert on `mockPlayer.setActiveForLockScreen` with `toHaveBeenCalledWith(true, metadata, options)`:
  - `passes the cover as artwork, the first genre as album and not-live options`: story `makeStory({ cover: 'stories/sleepy-moon/cover.jpg', genres: ['Bedtime', 'Fantasy'] })` gives metadata `{ title: story.title, artist: 'UR Story', albumTitle: 'Bedtime', artworkUrl: `${ASSET_BASE_URL}/stories/sleepy-moon/cover.jpg` }` and options `{ isLiveStream: false, showSeekBackward: true, showSeekForward: true, seekBackwardIntervalSeconds: 15, seekForwardIntervalSeconds: 15 }`.
  - `falls back to the default album and no artwork for a story without a cover or genres`: `makeStory()` gives `albumTitle: 'Bedtime stories'` and `artworkUrl: undefined`.
  - `keeps a full https cover URL as is`: `makeStory({ cover: 'https://cdn.example.com/c.jpg' })` gives `artworkUrl: 'https://cdn.example.com/c.jpg'`.
- [ ] **Step 2: Run** `npx jest src/lib/PlayerProvider.test.tsx -t "lock"` (or the new test names). Expected: the three new tests FAIL (the call has no third argument and no artwork); the old tests still pass.
- [ ] **Step 3: Implement** the call shown in the Global Constraints in `play()` in `src/lib/PlayerProvider.tsx`, replacing the current `setActiveForLockScreen` call.
- [ ] **Step 4: Run** `npx jest src/lib/PlayerProvider.test.tsx`. Expected: all tests PASS, including the existing `loads the story, enables lock-screen controls and plays` and the profile-switch clear tests.

---

### Task 2: Checks, device check and the single commit

**Files:** none (verification and commit)

- [ ] **Step 1: Run the full checks.** `npm test`, `npm run lint`, `npm run typecheck`. Expected: all pass, no new warnings.
- [ ] **Step 2: Device check.** Run the app on James's iPhone (`npx expo run:ios --device <iPhone UDID>`; the device is `James's iPhone`), play a story and lock the screen. Expected: the cover shows as artwork, the story duration and progress bar show with no "Live", the +/-15s buttons work, the album is the story's first genre. Then switch profile and confirm the widget clears. If "Live" is still shown, stop and bring the finding back (approach B in the spec) rather than working around it.
- [ ] **Step 3: Single commit.** Stage `src/lib/PlayerProvider.tsx`, `src/lib/PlayerProvider.test.tsx`, the spec and this plan; commit once as `bug: show artwork, duration and seek buttons on the iOS player widget` with the repo's body format and the required `Co-Authored-By` line. Never commit `.mcp.json`.
- [ ] **Step 4: Trello.** Move the card to In Progress when Task 1 starts, and to In Test with the PR link when the PR is opened (per `docs/DEVELOPMENT_RULES.md` section 12).
