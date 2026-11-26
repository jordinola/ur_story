# Kids Category compliance design

Trello: https://trello.com/c/usCHrxtm

## Intent and why

UR Story is a kids' audio app headed for an alpha (TestFlight) and later the App Store Kids Category. Parents need to see, in plain words, what the app does with their child's data, and review needs the right privacy declarations. Most of the behavior is already compliant by construction (no analytics, no ads, no accounts, no outbound links, profiles only in AsyncStorage). This work makes that visible and provable, and gives parents a way to erase everything.

## Goals

- A parent-facing "Privacy & Safety" screen with the bundled policy and a plain summary.
- A "Delete all data" action that erases profiles, library state (favorites, history, listened, resume), bedtime state, catalog cache and downloaded audio.
- A privacy manifest and export-compliance flag declared in `app.json`.
- The policy in one markdown file (`docs/privacy-policy.md`) as the source of truth, with contact `jjob3011@gmail.com`.

## Non-goals

- No hosted policy page or external link helper (`expo-web-browser`). Hosting the markdown (e.g. GitHub Pages) and pasting the URL into App Store Connect is a manual step. A gated `openExternal` helper is written when the first real external link exists.
- No new dependencies, analytics, crash reporting or accounts.
- No Android-specific compliance work (Data safety form) in this ticket.

## Anti-goals

- Deleting data must never leave the app in a broken state (stale in-memory state, orphaned downloads, a playing story with no file).
- Nothing in the kid-facing UI can reach the screen or the delete action without the parental gate.

## Constraints

- iOS first; iPhone and iPad, portrait and landscape; safe areas, 44pt targets, Dynamic Type, VoiceOver labels (DEVELOPMENT_RULES section 5).
- The policy must disclose the one network call: stories and audio come from a Cloudflare R2 bucket, so the device's IP address is visible to Cloudflare. Nothing else is collected or sent.
- Local data to disclose and erase: `storytime:profiles:v1`, `storytime:library:v2` (and legacy `v1`), `storytime:bedtime:v1`, `storytime:bedtime-tip:v1`, `storytime:catalog:v1`, and the downloads directory.

## Approaches considered

- **A. Privacy screen and manifest.** Smallest. No data deletion, which parents and COPPA expectations favor.
- **B. A plus a gated external link helper.** Adds `expo-web-browser` and a code path for a single link that the in-app policy makes unnecessary.
- **C. A plus Delete all data.** Chosen by the user. Strongest trust signal, matches COPPA's "parent can remove their child's data".

## Design (approach C)

- **Entry:** a "Privacy & Safety" row in `ProfileMenu`, below Manage profiles, that goes through the existing `ParentalGate` and opens a `privacy` modal route (`src/app/privacy/`), gated in its layout the same way `profiles/_layout.tsx` is, so each visit asks again.
- **Screen:** plain-language summary (what's stored on the device, what's fetched, what's never collected), the full policy text, the contact email, and the Delete all data button.
- **Policy text:** `docs/privacy-policy.md` is the source; a `src/data/privacyPolicy.ts` module holds the same text for the app. A test asserts the two stay identical, so the hosted and in-app copies cannot drift.
- **Delete all data:** confirmation step (a second explicit "Delete everything" confirm after the gate), then `eraseAllData()` in `src/lib/eraseData.ts`: removes the AsyncStorage keys listed above and the downloads directory, then bumps an epoch in a small `DataResetProvider` that keys the provider tree in `_layout.tsx`. Remounting resets every provider's in-memory state and releases the audio player through its existing teardown. The user lands on home with first-run state.
- **`app.json`:** `ios.privacyManifests` declaring no tracking and no collected data types, with required-reason API entries for the APIs we use (UserDefaults for AsyncStorage, file timestamp for downloads); `ios.infoPlist.ITSAppUsesNonExemptEncryption: false`. Exact keys come from the SDK 58 docs at build time.
- **Tests:** erase logic (every key and the directory removed, failure on one step still attempts the rest and surfaces an error), screen render with the email and policy, gate required, delete confirmation flow, policy file and module identical, provider reset returns defaults.

## Left to the builder

Exact copy of the summary, layout details, the manifest's required-reason codes (verify against Apple's list and the Expo docs), and the confirmation dialog wording (child-appropriate, parent-facing).
