# Playback history, real Previous, Shuffle and Repeat (design)

Trello: "feat: Playback history, real Previous, Shuffle and Repeat". Second half of the now-playing work; builds on the merged now-playing view (PR #15) and the queue (`QueueProvider`, `queue.ts`).

## Intent

Previous only restarts the current story today, and the queue has no Shuffle or Repeat. Add a played history so Previous can go back, plus Shuffle and Repeat (off / all / one), like a music player. Bedtime use: a parent lines up a few stories, optionally loops them, and the sleep timer or bedtime session ends playback.

## Goals

- **History:** a per-profile, in-memory list of stories that have played this session (most recent last, capped).
- **Previous:** if more than ~3 s of the current story have played, or there is no history, restart the current story (on the very first story Previous repeats it, as the user asked). Otherwise play the most recent history story and put the current story at the front of the queue.
- **Shuffle:** a toggle. Turning it on shuffles the current queue once; stories added later are appended unshuffled; turning it off does not restore the old order.
- **Repeat:** off / all / one.
  - **Repeat one:** when the story finishes it replays at once, with no countdown, whether or not the queue has stories.
  - **Repeat all:** when a story finishes and the queue is empty, the loop restarts from the stories played so far plus the current one, in order (reshuffled if Shuffle is on). With nothing in history it replays the current story. It only ends when Repeat is turned off or a sleep timer or bedtime session ends playback. The apps this follows (Apple Music, Spotify) loop the whole list; a one-item list loops that item.
  - **Repeat off:** unchanged: playback stops after the current story when the queue is empty.
- **Next:** an explicit tap overrides Repeat one and plays the next queued story. When the queue is empty, Next is enabled only with Repeat all (it starts the loop); otherwise it stays dimmed as today.
- **UI:** an icon-only chip row in the queue view between the current-story row and "Up next": Shuffle, Repeat all, Repeat one. The repeat chips exclude each other; neither selected means off. Each chip has a VoiceOver label (Shuffle, Repeat all, Repeat one), selected state, a 44 pt target, and a visible non-colour cue for the selected state (as the bottom bar's dot does).
- Shuffle, Repeat and history reset on app launch and on profile switch, like the queue.

## Non-goals

- Lock-screen next/previous buttons. Expo's docs say these exist only for `AudioPlaylist` (a native playlist); there is no handler for a single player, and moving playback to `AudioPlaylist` is a rewrite. A follow-up if wanted.
- Persisting history, Shuffle or Repeat across launches; drag-to-reorder; shuffling the whole library; a loop counter or "play N times".
- Changing the "Up next" countdown, bedtime lock or sleep timer behaviour.

## Anti-goals

- A story starting after a sleep timer or bedtime expiry, or while bedtime is locked, because of Repeat (the same end checks as autoplay apply to the loop and to Repeat one).
- Repeat one or the loop starting a second story at the same time as the normal advance (exactly one next story per finish).
- History or loop state leaking across profiles.
- Emoji or text glyphs for the chips (they render as system emoji on iOS); the icons are drawn with `react-native-svg`.

## Constraints

- iOS first; 44 pt targets; accessibility role/label/state on every control; theme tokens; the only new dependency is `react-native-svg` (for the chip icons); playback logic behind `PlayerProvider`, queue/playlist state behind `QueueProvider`.
- Replaying the current story is not `play(story)` (the player's same-id shortcut would only resume): seek to 0 and play (builder to confirm the working call in `PlayerProvider`).

## Approaches considered

- **A. Grow `QueueProvider` directly.** Fewest files, but the provider is already about 260 lines of timers, gap and bedtime logic; history and repeat rules would make the finish path hard to read and test. Rejected.
- **B. Pure playlist logic in `lib/`, `QueueProvider` as thin glue.** The queue, history, shuffle flag and repeat mode are one plain state value with pure, unit-tested transitions (record a played story, Previous, Next, shuffle once, what plays after a finish). `QueueProvider` calls them and keeps the timers, gap and bedtime checks. **Chosen** (by the user).
- **C. A separate history provider next to `QueueProvider`.** Two providers must agree on what is current; Shuffle and Repeat need both. Rejected.

## Design

### Pure logic (`src/lib/playlist.ts`, names are proposals)

State: `{ queue: Story[]; history: Story[]; shuffle: boolean; repeat: 'off' | 'all' | 'one' }`. Functions return new state and never mutate. The existing `queue.ts` functions stay and are reused.
- `recordPlayed(state, story)`: append to history (cap ~50, drop oldest; no duplicate of the last entry).
- `previous(state, current, positionSec)`: returns `{ action: 'restart' } | { action: 'play', story, state }` per the Previous rule (the current story goes to the front of the queue).
- `afterFinish(state, current)`: returns what should happen when a story finishes: `{ type: 'replay' }` (Repeat one), `{ type: 'play', story, state }` (queue head, or the Repeat all loop start with the rebuilt queue), or `{ type: 'stop' }`.
- `next(state, current)`: like `afterFinish` for Repeat off/all but ignoring Repeat one; `canNext(state)`.
- `setShuffle(state, on)`, `setRepeat(state, mode)`. Shuffle uses an injectable random source so tests are deterministic.

### `QueueProvider` (glue)

- Holds the playlist state (keeping the ref-as-source-of-truth pattern) and exposes `history`, `shuffle`, `repeat`, `setShuffle`, `setRepeat`, `playPrevious()`, `canNext`.
- The `current` effect records the previous current story into history when `current` changes to a different story, except when the change is the Previous navigation itself (a ref marks it so the story we went back to is not pushed again).
- The finish handler calls `afterFinish`. `replay` seeks to 0 and plays at once with no countdown; `play` goes through the existing gap (or immediate advance when backgrounded); `stop` does nothing. Every path keeps the bedtime-lock and sleep-expiry checks.
- `playNextNow` uses `next`; the profile-switch layout effect also resets history, shuffle and repeat.

### UI

- `PlaybackModeChips` (name proposal): a full-width row of three icon chips in the queue view between the compact row and `QueuePanel`; narrow and wide layouts both.
- `TransportControls`: Previous calls `playPrevious()` (still cancels a running countdown); Next dimmed unless `canNext`.
- Chip icons (the user chose "B, drawn vector icons" on a mockup): feather-style stroke icons (shuffle: two crossing arrows; repeat: a loop of two arrows; repeat one: the loop with a small "1" in the middle) drawn with `react-native-svg`, installed with `npx expo install react-native-svg` (Expo-supported package with native code, so a new development build is needed; justify it in the PR). Stroke colour comes from theme tokens; icons are decorative and the chip carries the label.

## Calls made after the builder check (the author's calls, not yet the user's)

1. **Loop set:** when Repeat all restarts the loop, the list is the history with duplicates removed (keeping first-occurrence order) plus the current story, and history is cleared at that moment, so every pass is a clean copy and nothing doubles. Previous right after a restart therefore restarts the current story (there is no earlier story).
2. **One-story loop:** with Repeat all, an empty queue and no history, the story replays at once (seek to 0 and play), exactly like Repeat one, with no countdown.
3. **Previous starts the earlier story from the beginning**, not from its saved position (music-player norm). `PlayerProvider.play` gains an optional `{ fromStart: true }` that skips the pending resume seek; no other behaviour of `play` changes.
4. **Shuffle at a loop restart** avoids starting with the story that just finished when the list has more than one story.
5. **Previous while paused:** the restart branch keeps today's behaviour (seek to 0, play state unchanged); going back to a history story starts playing it.
6. **Position threshold:** Previous uses the player's `position` as is; a quick Next then Previous (position near 0) goes back to the prior story, which is intended.

## Left to the builder

- Exact function names and file split; the history cap (about 50); the call that replays a finished story (seek 0 + play).
- The exact SVG paths (feather-style `shuffle`, `repeat`, and `repeat` plus a "1") and component names.
