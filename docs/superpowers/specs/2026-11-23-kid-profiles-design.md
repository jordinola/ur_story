# Kid profiles: design

Date: 2026-11-23 · Status: approved · Size: project (one branch, one commit, one PR)

## Intent

A parent wants each child to have their own space in UR Story: their own favorites, "continue listening" positions and story suggestions, tuned to the child's age and interests. Today the app has a single global library, so two kids share everything.

## Goals

- Create, edit, delete and switch between kid profiles (name, age, interest tags, language, avatar color).
- Scope favorites, progress and completed stories to the active profile.
- Recommend stories per profile (age fit, interest tags, language) and group the home screen into themed sections.
- Enrich the catalog with genres, tags and a numeric age range.
- Keep the app fully usable with zero profiles, and identical to today in that state.

## Non-goals

Accounts, cloud sync, profile photos, server-side recommendations, a parent PIN or password, per-profile screen-time limits, a bottom tab bar.

## Anti-goals (a failure even if it technically works)

- Collecting personal data beyond what is listed (no birthdate, surname, photo, location). Everything stays on device; no analytics.
- A kid can delete or edit a profile by accident.
- Existing users lose their favorites or progress.
- The no-profile experience gets worse or gets blocked behind setup.

## Constraints

- iOS first (iPhone and iPad, portrait and landscape), safe areas, 44pt targets, accessibility labels, Dynamic Type, Reduce Motion.
- Kids Category and COPPA expectations (`docs/DEVELOPMENT_RULES.md` section 5).
- Expo SDK 58, Expo Router, AsyncStorage. Check the SDK 58 docs before using any Expo or React Native API (including any menu or popover API) and add no dependency without justification.
- Design tokens from `src/theme.ts`. Validate remote and stored data at the boundary.

## Approaches considered

1. **Separate `ProfilesProvider`; `LibraryProvider` scoped to the active profile. (Chosen.)** Isolated data, small provider surface, few changes to screens and `PlayerProvider`.
2. Profiles inside `LibraryProvider`. Fewer files, but one provider would own catalog, profiles, favorites, progress and recommendations: hard to test and read.
3. Profiles hold preferences only; favorites and progress stay shared. Cheapest, but fails the goal (siblings share state).

## Decisions

### Profile model

```ts
type Profile = {
  id: string;
  name: string;          // nickname allowed, 1-20 chars, trimmed
  age: number;           // whole years, 2-12
  tags: string[];        // interest tags from the shared vocabulary
  languages: string[];   // e.g. ['en'], ['en','es']; at least one
  color: string;         // avatar color token from the theme
};
```

Initials for the avatar come from `name`. Stored at `storytime:profiles:v1` as `{ profiles: Profile[]; activeId: string | null }`. Read defensively: corrupt or missing data means no profiles. Limit of 6 profiles (my call, keeps the menu usable).

### Catalog enrichment

`Story` gains `ageMin`, `ageMax` (numbers), `genres: string[]` (one to two, for the home sections) and `tags: string[]` (interest tags, same vocabulary as profiles). `ageRange` stays for display. A `normalizeStory` step at the catalog boundary handles old cached or remote catalogs: it derives `ageMin`/`ageMax` from `ageRange` ("3-6"), and defaults `genres` and `tags` to empty. All 8 bundled stories get real values. The tag and genre vocabulary lives in `src/lib/tags.ts` (starting set, my call: Animals, Bedtime, Adventure, Magic, Friendship, Nature, Space, Ocean, Dragons, Feelings).

### Per-profile library

`LibraryProvider` keeps its public API (`isFavorite`, `toggleFavorite`, `getProgress`, `saveProgress`, `markCompleted`, `isCompleted`, `favorites`). Internally it persists `storytime:library:v2` as `{ shared: LibraryState; byProfile: Record<profileId, LibraryState> }` and reads and writes the active profile's slice, or `shared` when none is active. Migration: v1 is read once into `shared`.

- Creating the **first** profile adopts the `shared` slice, so nothing is lost; `shared` is then reset.
- Creating later profiles starts empty.
- Deleting a profile removes its slice. If it was active, activate the first remaining profile, or none.
- If all profiles are deleted, the app returns to the shared, no-profile state.

### Parental gate (answer to "who holds the phone": parent manages, kid listens)

Opening the profile management screens, and every add, edit and delete, requires a gate: a multiplication question with multiple-choice answers (no keyboard), new numbers each time, fully VoiceOver accessible, with a clear Cancel. **Switching** the active profile is not gated. The gate passes once per management session (leaving the management area re-arms it).

### Navigation and UI

- **Header right:** an avatar button. With an active profile it shows the kid's initials on their color; with none it shows a neutral person glyph. It opens a menu: the list of profiles (tap to switch, check on the active one), "Manage profiles" (gated), and room for future items. With no profiles the menu offers "Add a kid profile" (gated).
- **Routes** (new, in `src/app/`): `profiles/index` (list, add, per-row edit and delete) and `profiles/edit` (create and edit, optional `id` param), presented as a modal or stack screens, whichever is more native in SDK 58; swipe-back and safe areas preserved.
- **Edit form:** name, age (stepper or picker), interest tag chips (multi-select), language chips, avatar color swatches. Validation messages are friendly; keyboard handled.
- **Home, no profile:** exactly today's screen, plus a dismissible-free, unobtrusive "Add a kid profile" card at the top.
- **Home, active profile:** loads that profile automatically (the last active one, else the first). With the "All stories" chip, sections: *Continue listening* (stories with saved progress, not completed), *Picked for {name}*, one horizontal row per genre, then *All stories*. The "Favorites" chip stays a flat grid of that profile's favorites. Horizontal rows use `FlatList`.
- **Always-visible active kid:** the avatar in the header; the name appears in the "Picked for {name}" section title.

### Recommendations

Pure functions in `src/lib/recommend.ts`: `scoreStory(story, profile)`, `recommend(stories, profile, { limit, exclude })`, `groupByGenre(stories)`.

- Age fit is a soft factor: inside `[ageMin, ageMax]` scores highest, nearby scores partial, far outside gets a penalty. Nothing is hidden; "All stories" always lists everything.
- Language match is a strong factor; stories in a language the profile didn't pick rank low.
- Each tag or genre overlap with the profile's interests adds to the score.
- "Picked for" shows the top scoring stories (limit 10, score above zero), excluding those already in *Continue listening*. Ties break by catalog order so results are stable.
- Genre rows list only genres that have stories; empty sections never render.

### Testing (per the dev rules)

Unit tests for `normalizeStory`, recommend/score/group, profile storage (valid, missing, corrupt), library v1 to v2 migration and the first-profile adoption, delete behavior. Component and screen tests for the avatar menu, gate (right answer, wrong answer, cancel), profile form validation, profiles list, and the home screen in both states. Existing tests are updated deliberately where behavior moved.

## Left to the builder

Visual details (spacing, avatar sizes, section styling) within `theme.ts` tokens; exact scoring weights; the final tag vocabulary copy; the menu implementation (native menu if SDK 58 offers one that works on iOS and falls back cleanly, otherwise a themed popover); modal versus stack presentation; icon choices.

## Risks and notes

- The persistence change (library v1 to v2) is the riskiest part; it gets the most tests, and v1 data is never deleted until v2 is written successfully.
- Remote catalogs published before this change lack the new fields; `normalizeStory` covers this, but the hosted `stories.json` should be updated too (follow-up outside the app).
- Profile data is children's information held locally. Nothing leaves the device.
- `docs/DEVELOPMENT_RULES.md` on `main` may be older than the copy on `feat/skills-in-dev-rules`; this work follows whichever is current when the PR is opened.
