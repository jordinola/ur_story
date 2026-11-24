# Bedtime mode: design

Trello card: "Bedtime mode / child-proof navigation" (Draft #1).

## Intent

The phone is handed to the kid at bedtime. The parent sets a time limit first. The kid browses and picks his own stories. When the time is up, the story fades out and the app locks. Only the parental gate gets back in. The device itself is never locked, only UR Story.

## Goals

- Parent starts a bedtime session with a duration (15, 30 or 45 minutes) from a "Bedtime" entry on the home screen, behind `ParentalGate`.
- The kid keeps the full library and picks stories freely during the session.
- At expiry: fade out over the last 10 seconds, pause, then show a full-screen lock the kid cannot navigate past.
- The lock is passed only through `ParentalGate`. Passing it ends the session.
- A parent can end a running session early from the same "Bedtime" entry, behind the gate.
- While locked, playback cannot be restarted from Control Center or the lock screen.
- The session survives the app being backgrounded or killed: the end time is stored as a timestamp and the app reopens locked if it has passed.
- Profile switching in `ProfileMenu` is gated while a session runs, so the kid cannot swap profiles to dodge the limit.
- Show a one-time Guided Access tip to the parent, because an app cannot block the Home gesture.

## Non-goals

- Blocking the iOS Home gesture or app switcher (only Guided Access can).
- Autoplay-next and queues (separate Draft card).
- Any change to the existing sleep timer's behavior.
- Daily limits or listening stats (Parent dashboard card).

## Anti-goals

- A kid being able to leave the lock by back swipe, deep link, MiniPlayer or switching profile.
- A session that resets because the app was killed.
- Lock logic leaking into `PlayerProvider`, which stays audio-only.

## Constraints

- iOS first; Android and web must not break. iPhone portrait/landscape and iPad.
- Expo SDK 58, Expo Router. No new dependencies expected (AsyncStorage and `AppState` are already available).
- Storage key is namespaced and versioned. Missing or corrupt data falls back to "no session".
- Touch targets 44pt, accessibility labels and roles, Dynamic Type, safe areas.

## Approaches considered

| | Approach | Trade-off |
| --- | --- | --- |
| A | Extend the sleep timer in `PlayerProvider` | Least code, but puts lock state and persistence in the player and tangles two different timers |
| **B** | **New `BedtimeProvider` plus a lock overlay (chosen)** | One new provider and one player method; player and sleep timer untouched; overlay cannot be bypassed by navigation |
| C | A `/locked` route | Back swipe, deep links and the MiniPlayer can bypass it |

Chosen: **B**, because it keeps the player free of lock logic and the lock sits above all routes.

## Design

- `src/lib/bedtime.ts`: pure logic (`startSession`, remaining time, `isExpired`, parse/serialize the stored session with safe defaults for corrupt data).
- `src/lib/BedtimeProvider.tsx`: holds `{ endsAt, locked }`, persists `endsAt` in AsyncStorage, ticks while active, re-checks on `AppState` change to active, and exposes `startBedtime(minutes)`, `unlock()`, `remainingSec`, `active`, `locked`.
- `PlayerProvider`: add `fadeOutAndPause()`, reusing the existing fade code. `BedtimeProvider` calls it at expiry.
- `src/components/BedtimeLock.tsx`: renders `ParentalGate` full screen; mounted in `src/app/_layout.tsx` above the `Stack` and `MiniPlayer` while `locked`. Provider order: `BedtimeProvider` inside `PlayerProvider`.
- `src/components/BedtimeSheet.tsx` and a "Bedtime" entry on the home screen: duration picker behind `ParentalGate`; shows the Guided Access tip once (flag in AsyncStorage). While a session runs the entry shows the time left.
- `ProfileMenu`: while `active`, selecting another profile requires `ParentalGate`.
- Edge cases: starting a session when one is active replaces it; unlocking mid-fade restores volume; a session that expired while the app was closed locks on launch without playing audio.

## Testing

- Unit: `bedtime.ts` (expiry, restore, corrupt storage).
- Provider: start, tick to expiry triggers `fadeOutAndPause` and lock, persistence and restore, `AppState` resume after expiry, unlock ends the session.
- Components: `BedtimeLock` blocks and unlocks via gate, `BedtimeSheet` durations and tip shown once, `ProfileMenu` gated while active.
- Manual: iPhone portrait/landscape and iPad; background playback, lock-screen controls and interruptions re-verified.

## Left to the builder

Exact visual design of the sheet, lock screen copy, the remaining-time label on the home entry, and the Guided Access tip wording (child-appropriate tone for the lock, parent-facing tone for the tip).
