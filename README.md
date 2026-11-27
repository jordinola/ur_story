# UR Story (MVP scaffold)

Kids' story audio player for iPhone + iPad, portrait and landscape. No backend.

## What's in it
- Expo (SDK 58) + TypeScript + Expo Router (routes in `src/app/`)
- Library screen with adaptive grid (2 columns on iPhone portrait, more on iPad / landscape) and an All / Favorites filter
- Story screen: stacked on iPhone portrait, two panes on iPad and iPhone landscape
- Audio via `expo-audio`: background playback, lock-screen controls, ±15s, tap-to-seek, speed chips (0.75x/1x/1.25x, resets per story), sleep timer (10/20/30 min) with a 10 second fade-out
- Local-only data (AsyncStorage): favorites, resume position, "listened" badge
- Catalog: bundled `src/data/stories.json`, optionally refreshed from `${ASSET_BASE_URL}/stories.json`

## Prerequisites
- macOS with **Xcode** (App Store). Open it once and accept the license.
- An iOS simulator runtime: Xcode → Settings → Components (or Platforms).
- Xcode command line tools: Xcode → Settings → Locations → Command Line Tools. Or run `sudo xcode-select -s /Applications/Xcode.app`.
- **Node.js** 20 or newer (developed on 22) and npm.
- CocoaPods. `expo run:ios` normally handles it; if pod install fails, run `brew install cocoapods`.

## Run it locally
```bash
npm install
npx expo-doctor              # optional: verifies dependencies and config
npx expo run:ios             # build the dev client and launch it on a simulator
```

Use a development build (`run:ios`), not Expo Go: background audio and lock-screen controls need native config.

The first run generates the `ios/` folder and compiles the native project, so it takes a few minutes. Later runs are much faster. `ios/` is generated (Continuous Native Generation) and git-ignored. Don't edit it by hand; change native settings in `app.json` and config plugins instead.

### Choosing a device
`npx expo run:ios` picks a simulator for you. To choose one:

```bash
npx expo run:ios --device                 # pick from a list of simulators and connected devices
npx expo run:ios --device "iPhone 16 Pro" # or pass a simulator name / UDID
xcrun simctl list devices available       # see which simulators exist
```

Pick an iPad to test the iPad layouts. To add a simulator, open Xcode → Window → Devices and Simulators (Shift+Cmd+2) → Simulators tab → **+**.

### On your own iPhone or iPad
```bash
npx expo run:ios --device
```
Select your device. Xcode asks you to choose your Apple ID team for signing. The device must be in Developer Mode (Settings → Privacy & Security → Developer Mode).

### Day-to-day development
Once a development build is installed, you only need the JS dev server for code changes:
```bash
npx expo start      # press i to open on an iOS simulator
```
Rebuild with `npx expo run:ios` only after changing `app.json`, config plugins, or native dependencies.

Rotate the simulator with Cmd+Left/Right arrow to check landscape.

### Troubleshooting
- **No simulators listed:** install an iOS runtime (Xcode → Settings → Components), then create a device in Devices and Simulators.
- **Build or signing errors:** open Xcode once, accept the license, and check the command line tools setting above.
- **Stale native project:** delete `ios/` and run `npx expo run:ios` again. It is regenerated.
- **Dependency mismatches:** run `npx expo install --fix`, then `npx expo-doctor`.

## Project structure
```
src/
  app/            Expo Router routes (index = library, story/[id] = player)
  components/     StoryCard, MiniPlayer, PlayerControls
  lib/            catalog loading, library (favorites/progress) and player providers
  data/           bundled stories.json catalog
  theme.ts        colors and spacing
  types.ts        Story and library state types
assets/           icons and splash
app.json          Expo config (bundle id, background audio plugin)
```

## Before the audio will play
1. Put your MP3s (and optionally cover images + `stories.json`) in a public Cloudflare R2 bucket.
2. Set `ASSET_BASE_URL` in `src/lib/catalog.ts` (https only).
3. Make each story's `audio` path in `stories.json` match your file paths.

Until then the UI works but playback shows an error message.

### Placeholder audio
To test playback before real recordings exist, install ffmpeg (`brew install ffmpeg`) and run `npm run audio:placeholders`. It writes a quiet tone MP3 per story to `placeholder-audio/` (git-ignored), matching each story's `audio` path, so the folder can be uploaded to R2 as is. Options: `--seconds <n>` for short files, `--silent`, `--force` to overwrite.

### Story format
Each entry in `stories.json` looks like this:
```json
{
  "id": "sleepy-moon",
  "title": "The Sleepy Moon",
  "description": "A little moon who can't fall asleep goes looking for the perfect lullaby.",
  "durationSec": 300,
  "ageRange": "3-6",
  "language": "en",
  "audio": "audio/sleepy-moon.mp3",
  "cover": "covers/sleepy-moon.jpg",
  "color": "#7C83FD",
  "emoji": "🌙"
}
```
`audio` and `cover` are paths relative to `ASSET_BASE_URL`, or full https URLs. `cover` is optional; without it the card falls back to the color and emoji.

## TestFlight builds (EAS)
Builds run in the cloud with EAS, so no Mac is needed. `eas.json` has three profiles:

- `development`: a dev client build for your own registered devices (`npx eas-cli@latest build --profile development --platform ios`).
- `preview`: an internal (ad hoc) build of the real app for registered devices, without TestFlight.
- `production`: an App Store build for TestFlight and release.

The build number is managed by EAS (`appVersionSource: "remote"`) and goes up by one on every production build, so don't set `ios.buildNumber` in `app.json`; EAS ignores it. The user-facing version is `version` in `app.json`. Bump it yourself for each new release.

To ship a TestFlight build:
```bash
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --profile production --platform ios --latest
```
The first run asks you to sign in to your Apple Developer account and lets EAS create the certificates and provisioning profile. `submit` asks for the App Store Connect app if `submit.production.ios.ascAppId` isn't set in `eas.json`; add it once the app record exists so later submits don't prompt.

## Before you ship
- Change `ios.bundleIdentifier` in `app.json` (currently `com.james.urstory`) if you want a different one.
- Replace the placeholder icon and splash in `assets/`.
- Kids Category requirements: no third-party analytics or ads, a parental gate before any paywall or external link, and a privacy policy.

## Not built yet (next steps)
- Offline downloads (expo-file-system)
- RevenueCat paywall behind a parental gate
- Cover images, app icon and splash screen
- Tests (Jest for logic, Maestro for UI flows)

## Checks
```bash
npx tsc --noEmit
npx expo export --platform ios   # bundling smoke test
```
