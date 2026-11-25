# Queue and autoplay-next (design)

Trello: "feat: Playlist, queue and autoplay-next". Branch 1 of 2 (branch 2 is listed under Follow-up).

## Intent

Bedtime is two or three stories, not one. Today playback stops when a story ends. A parent (or an older kid) should be able to line up stories, and the next one starts by itself after a short, visible gap. The queue is a general feature: it works with or without bedtime mode.

## Goals

- Add to queue, play next, move to top and remove, from a story and from the queue view.
- When a story finishes and the queue has a next one, start it after a ~5 s cancellable "Up next" gap.
- Empty queue: playback stops after the current story, as today.
- Queue is in memory and resets on app launch.
- Queue is per profile: switching profile clears it (same rule `PlayerProvider` applies to the current story).

## Non-goals

- Persisting the queue across launches.
- Drag-to-reorder (Move to top covers the need; drag is poor for accessibility and small kids' hands).
- Auto-filling the queue from recommendations, "after this story" sleep timer option, hiding the sleep chips during bedtime, lock-screen next/previous. All are branch 2.
- "Most listened" ranking (no play counts exist).
- Any change to how the sleep timer or bedtime fade work.

## Anti-goals

- A story starting after the sleep timer or bedtime session has ended (or while the app is locked).
- The next story starting without the gap, or a gap that can't be cancelled.
- Queue state leaking from one profile to another.

## Constraints

- iOS first; iPhone and iPad, portrait and landscape. 44 pt targets, VoiceOver labels and roles on every control, Dynamic Type, Reduce Motion respected for the countdown.
- Background playback and lock-screen controls keep working. Autoplay must also work with the screen locked, so the gap and the advance run in JS timers that continue in the background audio session.
- Playback logic stays behind `PlayerProvider`; UI does not touch the player API.
- Tokens from `src/theme.ts`, no new dependencies.

## Approaches considered

- **A. Queue inside `PlayerProvider`.** Fewest files, but `PlayerProvider` already holds audio, sleep timer and fade logic; queue rules would tangle with it.
- **B. Separate `QueueProvider` plus pure `lib/queue.ts`.** Queue rules are plain, testable functions; the provider holds state and calls `play()`. `PlayerProvider` only gains a finish signal. **Chosen** (by the user).
- **C. Native playlist in the audio player.** The app plays one source at a time via `player.replace` and handles progress, gap and profile rules in JS; this would rework all of that for no gain. Rejected.

## Design

### `src/lib/queue.ts` (pure)

Queue is `Story[]`. Functions return new arrays and never mutate:
`enqueue(queue, story)`, `playNext(queue, story)` (insert at the front), `moveToTop(queue, id)`, `remove(queue, id)`, `shift(queue)` (returns `{ next, rest }`). A story already in the queue is moved rather than duplicated. The story that is currently playing is not added (no-op).

### `QueueProvider` (`src/lib/QueueProvider.tsx`)

Sits inside `PlayerProvider`, `BedtimeProvider`, `LibraryProvider` and `ProfilesProvider` in `_layout.tsx`. Exposes `queue`, `upNext` (`Story | null` while the gap is counting), `gapRemainingSec`, `enqueue`, `playNext`, `moveToTop`, `remove`, `clear`, `cancelUpNext`.

Behaviour:
- On a finish signal from the player, if the queue is non-empty and no end condition holds, set `upNext` to the head and start a ~5 s countdown. When it reaches zero, `shift` the queue and call `play(next)`.
- End conditions are checked at the finish and again when the gap ends: the app is locked by bedtime mode, or a sleep timer / bedtime fade has just run out and paused playback. If either holds, drop the countdown and do not start. A timer that is still running (not yet expired) does not block the advance; it keeps counting across stories and fades whatever is playing.
- The gap is cancelled (`upNext` cleared, queue kept) when: the user taps Cancel, the user plays any story, the user presses play/pause on the player, or the profile changes (queue is also cleared on a profile change).
- Timers are cleaned up on unmount and on cancel.

### `PlayerProvider` changes

- Expose `finishedAt: number | null` (a counter or timestamp bumped on `didJustFinish`) so the queue can react without owning player internals. A counter is used rather than a boolean so back-to-back finishes of different stories each fire.
- Expose a signal that a sleep timer or bedtime fade expired (for example `sleepExpiredAt`, bumped where the fade effect calls `player.pause()` at zero), so the queue can tell "playback stopped because time ran out" from "the story simply ended". The builder picks the exact shape.

### UI

- **Story actions.** Long-press on a `StoryCard` or `StoryRow` opens a native action sheet: "Play next", "Add to queue", Cancel. Haptic on selection only. (A visible "+" on every card was rejected: the card already carries a favorite button and the grid is dense.) Actions come from cards and rows only; the player screen has no add button in this branch. Long-press is not discoverable on its own, so the empty queue state says "Press and hold a story to add it".
- **Queue view.** An "Up next" list on the player screen below the controls: rows with title, duration, "Move to top" and "Remove" buttons (44 pt, labelled). Empty state: "Nothing queued". The list is short in practice, so a plain list inside the existing scroll is fine.
- **Up next gap.** While `upNext` is set, a banner on the player screen and the mini player shows "Up next: <title> in 5…" with a Cancel button. With Reduce Motion on, no animated progress, text only.
- Parent gate: queue actions are not gated (a kid reordering stories is fine). The auto-fill choice in branch 2 sits behind the gate with bedtime start.

### Tests

- `queue.test.ts`: every pure function incl. duplicates, missing id, empty queue.
- `QueueProvider.test.tsx` with fake timers: advance after the gap; cancel paths; no advance when locked or timer expired; profile switch clears; unmount cleanup.
- Component tests: action sheet choices, queue rows (labels, roles, buttons), banner and Cancel, empty state.
- `PlayerProvider.test.tsx`: finish signal bumps once per finished story.

## Calls made after the builder check (the author's calls, not yet the user's)

1. **Backgrounded or locked app: no gap.** Nothing plays during the gap, so iOS may suspend JS timers. When `AppState` is not `active` at the finish, the next story starts immediately. With the app in the foreground the ~5 s gap applies. The anti-goal "no gap" therefore holds only in the foreground, where the gap can be seen.
2. **The story screen follows the player.** After autoplay the route updates to the new story (`router.setParams`) so the cover and title match the audio. `story/[id].tsx` must not call `play()` again for a story already current.
3. **Manual play removes the story from the queue.** `QueueProvider` also drops any queued entry equal to `current` at advance time, so a finished story is never replayed through the same-id shortcut.
4. **Any resume cancels the gap**, whether from the player, lock screen or Control Center (keyed on `isPlaying` turning true). After Cancel the finished story stays stopped and the queue is kept.
5. **Load failure:** drop the failed story, show the existing error state, and try the next queued story. If the queue is empty, stop.
6. **Expiry baseline:** any sleep or bedtime expiry after the finish signal blocks the advance and clears `upNext` (the banner disappears). Starting a story inside the bedtime fade window is allowed; the fade effect re-applies the fade on its next tick.
7. **Placement:** `QueueProvider` sits below `BedtimeProvider` so it can read `locked`. Bedtime does not read the queue.
8. **Queued stories resume from saved progress**, same as a manual play.

## Left to the builder

- Exact finish-signal and "timer ended" plumbing between `PlayerProvider` and `QueueProvider`, as long as the anti-goals hold.
- Whether the action sheet is `ActionSheetIOS` with an Android fallback or a small shared sheet component, following existing sheet patterns in the app.
- Gap length tuning around 5 s, and exact copy.

## Follow-up (branch 2, own card or same card, own branch)

- Hide the player sleep chips during a bedtime session and show "Bedtime ends in mm:ss". The chips currently overwrite the `sleepEndsAt` the bedtime fade uses, so a kid can change or cancel the fade.
- Sleep timer option "After this story" / "After the queue".
- Opt-in auto-fill when a parent starts bedtime: top N from `recommend()` minus completed stories, default off.
- Lock-screen next control.
