# Playback speed and sleep fade-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add speed chips (0.75x/1x/1.25x) and a 10 second sleep-timer volume fade to the player.

**Architecture:** `PlayerProvider` owns `playbackRate` and the fade; `PlayerControls` renders the chips. The fade is a JS volume ramp driven by the existing sleep tick, which runs every 250 ms during the final 10 s.

**Tech Stack:** expo-audio (`player.setPlaybackRate`, `player.volume`), React Native Testing Library, jest fake timers.

**Spec:** `docs/superpowers/specs/2026-11-23-player-speed-sleep-fade-design.md`

## Global Constraints

- Speeds are exactly `0.75`, `1`, `1.25`. Rate resets to `1` whenever a different story starts (not remembered per profile).
- Fade length is 10 s, linear, volume 1 -> 0, then pause, then volume back to 1.
- Chips: touch target >= 44pt, `accessibilityRole="button"`, `accessibilityState={{ selected }}`, styles from `src/theme.ts` (reuse the sleep chip styles).
- Match existing code style in `PlayerProvider.tsx` and `PlayerControls.tsx`. Checks: `npm test`, `npx expo lint`, `npx tsc --noEmit`.

## Review Focus

- Pause mid-fade: volume returns to 1 (otherwise the next play is silent).
- New story mid-fade: volume 1, timer state unchanged by the fade code itself.
- Timer cleared or changed mid-fade: volume 1.
- Profile switch with a timer running: timer cleared, volume 1.
- Provider unmount mid-fade: volume restored.

---

### Task 1: Playback speed

**Files:**
- Modify: `src/lib/PlayerProvider.tsx`, `src/components/PlayerControls.tsx`
- Test: `src/lib/PlayerProvider.test.tsx`, `src/components/PlayerControls.test.tsx`

**Interfaces:**
- Produces: `PlayerContextValue.playbackRate: number`, `PlayerContextValue.setPlaybackRate: (rate: number) => void`, exported `PLAYBACK_RATES = [0.75, 1, 1.25] as const` from `PlayerProvider.tsx`.

- [ ] **Step 1: Failing provider tests.** Add `setPlaybackRate: jest.fn()` to `mockPlayer`. Tests in a new `describe('playback speed')`: `defaults to 1x`; `setPlaybackRate(1.25) calls player.setPlaybackRate(1.25) and updates playbackRate`; `playing a different story resets the rate to 1 and calls player.setPlaybackRate(1)`; `replaying the current story keeps the rate`.
- [ ] **Step 2: Failing component tests** in `PlayerControls.test.tsx`: renders three buttons labelled `0.75x speed`, `1x speed`, `1.25x speed`; the current rate has `accessibilityState.selected === true`; pressing `1.25x speed` calls `setPlaybackRate(1.25)`. Follow the file's existing way of mocking `usePlayer`.
- [ ] **Step 3: Run** `npx jest src/lib/PlayerProvider.test.tsx src/components/PlayerControls.test.tsx`. Expected: new tests FAIL.
- [ ] **Step 4: Implement** `playbackRate` state plus `setPlaybackRate` (calls `player.setPlaybackRate`) in `PlayerProvider`; reset to 1 inside the new-story branch of `play`; add both to the context value. Add a speed chip row to `PlayerControls`, between the transport row and the sleep row, reusing `chip`/`chipActive` styles.
- [ ] **Step 5: Run** the same command. Expected: PASS.

### Task 2: Sleep fade-out and timer cleanup

**Files:**
- Modify: `src/lib/PlayerProvider.tsx`
- Test: `src/lib/PlayerProvider.test.tsx`

**Interfaces:**
- Consumes: the sleep timer state in `PlayerProvider` (`sleepEndsAt`, `setSleepTimer`).
- Produces: `FADE_SECONDS = 10` and `FADE_TICK_MS = 250` constants (module-private); no new public API.

- [ ] **Step 1: Failing tests** in `describe('sleep timer')`, with `mockPlayer.volume = 1` added to the mock: `volume stays 1 until 10 s remain`; `volume ramps linearly down in the final 10 s` (at 5 s remaining, volume ~0.5); `pauses and restores volume to 1 when the timer ends`; and one test each for the Review Focus cases: pause mid-fade, playing a new story mid-fade, `setSleepTimer(null)` mid-fade, profile switch mid-fade (also expects `sleepMinutes` null), and unmount mid-fade. Each expects `mockPlayer.volume === 1`.
- [ ] **Step 2: Run** `npx jest src/lib/PlayerProvider.test.tsx -t "sleep timer"`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** in the sleep effect: tick every 1000 ms until remaining <= `FADE_SECONDS`, then every `FADE_TICK_MS`, setting `player.volume = remaining / FADE_SECONDS` (compute remaining from `sleepEndsAt` in ms). At zero: pause, set volume 1, clear state. Add one `restoreVolume` helper that sets `player.volume = 1`, called from the effect cleanup, `toggle`'s pause path, `play` (new story), and the profile-switch layout effect, which also resets the sleep state.
- [ ] **Step 4: Run** the full suite, `npx expo lint`, and `npx tsc --noEmit`. Expected: all pass.

### Task 3: Docs and manual check

**Files:**
- Modify: `README.md` (one line each for speed and fade, if features are listed there)

- [ ] **Step 1: Update README** feature list if it lists player features.
- [ ] **Step 2: Manual iOS check** on the simulator: speed chips change the pitch-corrected speed and reset on a new story; a 10 minute timer fades out; sleep timer cleared on profile switch. Note the result for the PR.
