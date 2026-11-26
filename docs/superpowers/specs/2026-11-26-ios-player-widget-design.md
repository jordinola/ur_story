# iOS player widget (design)

Trello: "Fix iOS player widget (lock screen, notification center, control center, Dynamic Island)" (https://trello.com/c/92QO2JCT). Follows the merged cloud story storage work (PR #19), which put a cover image for every story in the bucket and in the generated `stories.json`.

## Intent

While a story plays on iOS, the system player (lock screen, notification center, Control Center, Dynamic Island) shows the title, app name and controls, but no artwork, a "Live" label instead of the duration and progress bar, and fixed artist and album text. It should look like a normal audio player for the story that is playing.

## Goals

- Show the story's cover as artwork.
- Show the real duration and progress, not "Live".
- Show +/-15s buttons (they match the in-app +/-15s controls). `expo-audio` defaults the interval to 10 s, so both intervals are set to 15 explicitly (found on the device check).
- Album is the story's first genre, falling back to `Bedtime stories`. Artist stays `UR Story`.

## Non-goals

- Next and previous buttons: `expo-audio` 58.0.12 supports them only for an `AudioPlaylist`, not a single `AudioPlayer`. Already tracked in `2026-11-25-now-playing-view-design.md`.
- A generic fallback image for stories without a cover (it would need hosting in the bucket): such a story shows no artwork.
- Artwork while offline: the artwork is a remote URL, so it is not shown without a connection.
- A narrator or author field, or any other new `Story` field.

## Anti-goals

- Breaking the existing lock-screen behaviour: the session still starts on `play()` and is cleared on a profile switch.
- Passing a non-remote or malformed artwork URL.

## Constraints

- One change in `PlayerProvider.play()` (`src/lib/PlayerProvider.tsx`); no new dependency. `expo-audio` ~58.0.12 accepts only `title`, `artist`, `albumTitle` and `artworkUrl` as metadata and reads the duration from the loaded audio.
- `story.cover` is a path relative to the bucket (`stories/<id>/cover.jpg`); `resolveUrl` (already imported) makes it a full URL.
- Per `docs/DEVELOPMENT_RULES.md`: branch `bug/ios-player-widget` from `main`, tests first, one `bug:` commit, lint and typecheck clean, re-verify lock-screen controls.

## Approaches considered

- **A. Pass the metadata and `isLiveStream: false` in the existing `setActiveForLockScreen` call (chosen by the user).** One call, no new state.
- **B. Also call `updateLockScreenMetadata` once the audio has loaded.** More code and a status effect for a problem we have not confirmed. Kept as a fallback only if the on-device check still shows "Live" after A.

## Design

In `play()`, replace the current call with:

```ts
player.setActiveForLockScreen(
  true,
  {
    title: story.title,
    artist: 'UR Story',
    albumTitle: story.genres[0] ?? 'Bedtime stories',
    artworkUrl: story.cover ? resolveUrl(story.cover) : undefined,
  },
  { isLiveStream: false, showSeekBackward: true, showSeekForward: true, seekBackwardIntervalSeconds: 15, seekForwardIntervalSeconds: 15 },
);
```

Cause of "Live" (from reading `expo-audio`'s `MediaController.swift`, not yet confirmed on a device): `isLiveStream` defaults to whether the player item's duration is indefinite, evaluated once when the session is activated, which is before the audio has loaded. Passing `isLiveStream: false` removes that.

## Testing

Unit tests in `PlayerProvider.test.tsx` for the arguments of `setActiveForLockScreen` (with and without a cover, with and without genres). Manual check on James's iPhone: artwork, duration and progress, no "Live", +/-15s buttons work, and the widget is cleared on a profile switch. If "Live" is still shown, add approach B and say so in the PR.

## Left to the builder

Test names and how the new assertions are arranged.
