// Keep identical to docs/privacy-policy.md (privacyPolicy.test.ts enforces it).
export const PRIVACY_CONTACT_EMAIL = 'jjob3011@gmail.com';

export const PRIVACY_SUMMARY: readonly string[] = [
  'Everything about your child stays on this device.',
  'No ads, no analytics, no tracking and no accounts.',
  'Stories and audio come from the internet. Only the IP address of the device is visible to the server.',
  'Profiles, favorites, history and downloads can be erased at any time.',
];

export const PRIVACY_POLICY = `# UR Story Privacy Policy

Last updated: 26 November 2026

UR Story is a story-listening app for children. This policy explains, in plain words, what the app does with information. The short version: everything about your child stays on your device, and we collect nothing.

## Who we are

UR Story is made by James Ordinola. You can reach us at jjob3011@gmail.com.

## What stays on your device

The app saves the following on your device only. It is never sent to us or to anyone else:

- Kid profiles: a name, an age, interests and languages that a grown-up enters
- Favorites, listening history and where each story was paused
- Bedtime mode settings
- Stories you choose to download for offline listening

## What the app fetches from the internet

To show the story list and play stories, the app downloads them from a Cloudflare R2 storage bucket. As with any internet request, Cloudflare can see the device's IP address when this happens. The app sends no profile information, no identifiers and nothing else with these requests.

## What we never do

- We show no ads.
- We use no analytics, tracking or crash-reporting tools.
- We have no accounts and ask for no sign-in.
- We do not collect, sell, rent or share personal information.
- We do not ask for the microphone, camera, contacts, location or photos.

## Children's privacy

The app is designed for children, and we follow the spirit of COPPA and the App Store Kids Category rules. Because we collect no personal information, there is nothing about your child for us to store, sell or disclose. Areas meant for grown-ups, such as profiles, bedtime mode and this screen, are protected by a grown-ups-only question.

## Erasing your data

A grown-up can erase everything the app has saved at any time: open the profile menu, choose Privacy & Safety, answer the grown-ups-only question and choose Delete all data. This removes all profiles, favorites, history, settings and downloaded stories from the device. Deleting the app does the same.

## Changes to this policy

If this policy changes, the new version will ship with an app update, and the date above will change.

## Contact

Questions about privacy? Email jjob3011@gmail.com.
`;
