# Playback speed and sleep fade-out

## Why
Bedtime listening needs two things the player lacks: a speed control, and a sleep timer that eases out instead of cutting the audio. Lock-screen metadata and the 10/20/30 minute timer already exist in `PlayerProvider`.

## Goals
- Playback speed chips (0.75x, 1x, 1.25x) on the player.
- Sleep timer fades the volume out over its final 10 seconds, then pauses.
- Switching profiles clears the sleep timer.

## Non-goals
- Lock-screen artwork (waits for cover images, group C).
- An "end of story" timer option.
- Remembering speed. It always resets to 1x when a new story starts.

## Approaches
- **Speed:** `PlayerProvider` holds `playbackRate` and calls `player.setPlaybackRate`; chips in `PlayerControls`. Chosen over a native menu (iOS-only, themeable not, new dependency, two taps).
- **Fade:** JS volume ramp (chosen) over a native fade (no `expo-audio` API; would need a custom module). During the last 10 s the sleep tick runs every 250 ms and steps `player.volume` down, then pauses and restores volume to 1.

## Design
- `PlayerContextValue` gains `playbackRate` and `setPlaybackRate(rate)`. `play(newStory)` resets the rate to 1.
- Rate constants and fade length live next to the provider; chips reuse the sleep-chip styling and 44pt targets, with `accessibilityRole="button"` and selected state.
- Volume is restored to 1 whenever the fade stops early: pause, new story, timer cleared or changed, profile switch, unmount.
- The profile-switch layout effect also clears the timer state.

## Left to the builder
Exact fade curve (linear is fine), chip layout on small screens, and copy for accessibility labels.

## Tests
Provider: rate set and reset on a new story; fade steps volume down in the final 10 s, pauses at zero, restores volume; early cancellation paths restore volume; profile switch clears the timer. Component: speed chips render, announce selected state, and call the setter.
