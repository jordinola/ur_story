# Now-playing view (design)

Trello: "feat: Now-playing view with queue tab, prev/next, shuffle and repeat". Two branches: branch 1 is the layout, branch 2 is history, Shuffle and Repeat. Builds on the merged queue (`QueueProvider`, `UpNextBanner`, story actions).

## Intent

The queue list under the player controls looks tacked on. The story screen becomes an Apple Music style now-playing screen: a big cover, transport controls, and a bottom bar that opens the queue, where the cover shrinks to a row.

## Goals

- Cover view: big cover, title and meta, seek bar, Previous / Play-Pause / Next, bottom bar.
- Queue view: tapping the cover or the Queue button shrinks the cover to a compact row (title and position; no play/pause, the transport stays in view) and shows "Up next" with Move to top and Remove per row.
- Bottom bar, always visible, icon-only: **Queue** and **More**. More opens a sheet with **Speed** and **Sleep timer** (the controls that are chips under the transport today).
- During a bedtime session the Sleep row in More shows "Bedtime ends in mm:ss" instead of the chips (this absorbs the old follow-up that hid the chips during bedtime).
- Previous restarts the current story when there is no earlier story. Next plays the next queued story immediately (no gap) and is disabled when nothing is queued.
- Branch 2: Shuffle and Repeat (off / all / one) as an icon-only chip row between the current-story row and "Up next" in the queue view; a played history so Previous goes back.

## Non-goals

- Reanimated or other new native dependencies.
- Drag-to-reorder, persisting the queue, lock-screen next/previous remote commands (follow-up; confirm expo-audio support first).
- Shuffle/Repeat acting on the whole library: both act on the queue only.
- Changing the autoplay gap, bedtime lock or sleep timer behaviour.

## Anti-goals

- Any visible text label on the icon controls (VoiceOver labels stay).
- A layout that clips at large Dynamic Type, in iPhone landscape or on iPad.
- Changing the `/story/[id]` route, deep links, or mini player navigation.
- Audio logic leaking into UI components: playback stays behind `PlayerProvider` and queue state behind `QueueProvider`.

## Constraints

- iOS first; 44 pt targets; accessibility label, role and state on every control; Reduce Motion respected (`useReduceMotion`: the cover-to-row change is instant); theme tokens; `StyleSheet.create`.
- Transition uses React Native's built-in `Animated` or `LayoutAnimation` (Reanimated is not installed). Check Expo SDK 58 / RN 0.88 docs before using either.
- Bottom bar sits inside the story screen (not app-wide); mini player stays hidden on `/story/*` as today.

## Approaches considered

- **A. Rebuild the story screen in place.** `/story/[id]` keeps its route and gets a `queueOpen` state. Smallest change; deep links and autoplay's `setParams` keep working. **Chosen** (by the user).
- **B. Full-screen modal player route.** Best native feel, but replaces `/story/[id]`, changes navigation and iPad presentation. Rejected: too large and touches stable routes.
- **C. Queue as a bottom sheet over the existing screen.** Not the design asked for (the cover does not shrink to a row). Rejected.

## Design

### Layout (branch 1)

`src/app/story/[id].tsx` composes small components (names are proposals):
- `NowPlayingCover`: big cover, or the compact row when `queueOpen`. Tapping toggles `queueOpen`.
- `TransportControls`: seek bar with times, Previous / Play-Pause / Next. Replaces the transport part of `PlayerControls`. Icons (previous, play, pause, next) are drawn from Views, not text glyphs, so iOS never swaps in emoji. There are no `-15`/`+15` buttons; VoiceOver users seek in 15 s steps with the seek bar's increment and decrement actions.
- `QueuePanel`: replaces `UpNextList`; the heading "Up next", rows with Move to top and Remove, empty state `Your queue is empty` with the hint `Press and hold a story, or tap ⋯ on a card, to add it.` (the decorative ☰ glyph is hidden from VoiceOver).
- `PlayerBottomBar`: Queue and More icon buttons (toggle `queueOpen` / open the sheet).
- `MoreSheet`: Speed (existing `PLAYBACK_RATES`), Sleep timer (existing `SLEEP_OPTIONS`; bedtime label when a session runs).
- `UpNextBanner` stays above the transport as today.

Narrow screens (width < 700 and portrait): the banner, seek bar, transport and error text are pinned in a footer above the bottom bar, outside the `ScrollView`, so they never scroll away. The footer is capped at half the window height and scrolls inside that cap at large Dynamic Type, so the bottom bar can never be pushed off screen.

Landscape and iPad: any landscape orientation (even a 667x375 iPhone SE) and any width >= 700 use two panes (cover left, controls right), with no pinned footer; the queue view replaces the cover pane's content with the list. Builder to define exact behaviour within these constraints.

### Next and Previous (branch 1)

`PlayerProvider` gains no new state. `QueueProvider` gains `playNextNow()` (shift the queue and `play()` without the gap) and the screen's Previous calls `seekTo(0)` (restarts the current story). Next is disabled when the queue is empty.

### Branch 2: history, Shuffle, Repeat (outline; refined when branch 2 starts)

- `QueueProvider` adds `history: Story[]` (most recent last, capped, cleared with the queue on profile switch), `shuffle: boolean`, `repeat: 'off' | 'all' | 'one'`.
- Previous: with no history, or when more than ~3 s of the current story has played, restart the current story; otherwise play the last history story and put the current story at the front of the queue.
- Manual or autoplay start of a new story pushes the previous current story onto `history`.
- Shuffle on permutes the current queue once; later additions are appended unshuffled; toggling off does not restore the old order.
- Repeat all: when the queue is empty at a finish, the queue becomes `history + current` (reshuffled if Shuffle is on) and playback continues; with empty history it repeats the current story. Repeat one replays the current story at once with no gap.
- Chip row: three icon-only chips (shuffle, repeat all, repeat one), repeat chips mutually exclusive, neither selected means off.

## Calls the author made (not yet the user's)

1. Next skips the gap (a deliberate tap should not wait 5 s).
2. Toggling Shuffle off does not restore the previous order.
3. Repeat one replays at once with no gap.
4. Queue entries do not stay after playing; replay for Repeat all comes from `history`.
5. Lock-screen next/previous is out of scope.

## Calls made after the builder check (the author's calls, not yet the user's)

6. **Heart and description stay.** The cover view is a `ScrollView` as today: cover, title row with the favorite heart, meta, then the story description. On narrow screens the seek bar and transport sit in the pinned footer below the scroll area (wide layouts keep them in the right pane). The bottom bar is pinned below that. The compact row in the queue view shows the title and position only (no heart, no description).
7. **Next and bedtime/gap.** Next works during a bedtime session (the child may pick). It cancels a running gap and its banner, and skips the sleep-expiry checks because it is an explicit tap. It is unreachable while the bedtime lock is up; any open More sheet closes when the lock appears.
8. **`-15` / `+15` are removed.** Tapping the seek bar seeks; VoiceOver seeks in 15 s steps via the seek bar's increment and decrement actions, and the bar reports `m:ss of m:ss` as its value.
9. **Wide layouts (iPad, any iPhone landscape):** two panes as today. The bottom bar spans the full width under both panes. In the queue view the left pane shows the compact row on top with the queue list below it; the right pane (title, seek bar, transport) is unchanged.
10. **Scope of the first plan:** branch 1 only. The branch 2 outline above is context and is refined when that branch starts.

## Left to the builder

- Exact component split and file names, sheet implementation (RN `Modal` page sheet vs an inline panel; check Expo SDK 58 docs), icon set (text glyphs vs an existing icon source), the animation primitive.
