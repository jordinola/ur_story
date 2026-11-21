# Development Rules

The standard for every feature and bug fix in UR Story. Humans and Claude follow it. If a rule must be broken, say why in the PR description.

Stack: Expo SDK 58, React Native 0.88, React 19, TypeScript, Expo Router (`src/app/`), `expo-audio`, AsyncStorage. Primary target: **iPhone and iPad (iOS)**.

---

## 1. Core principles

1. **iOS first.** Android and web must not break, but iOS behavior and polish decide every trade-off.
2. **Stack best practices are mandatory**, not optional (see sections 5 and 6).
3. **One branch, one commit, one PR.** No exceptions (see section 3).
4. **Green before commit.** Nothing is committed or amended while tests, lint, or typecheck fail.
5. **Tests with every change.** As much coverage as is practical (see section 4).
6. **Don't trust memory for Expo APIs.** They change every SDK. Read the `expo` major version in `package.json` and check `https://docs.expo.dev/versions/v<major>.0.0/` (or `https://docs.expo.dev/llms.txt`) before touching any Expo, EAS, or React Native API.

---

## 2. Workflow overview

```
main ──► branch ──► code + tests ──► checks green ──► single commit ──► push ──► PR
                         ▲                                  │
                         └──── review feedback: amend + force-push (with lease)
```

1. Update `main` and branch from it.
2. Write a failing test, then the code (TDD where practical).
3. Run the checks (section 4.3). All must pass.
4. Commit once. Later changes **amend** that commit.
5. Push and open the PR with the template (section 7).

---

## 3. Git rules

### 3.1 Branches

- Always branch from an up-to-date `main`:
  ```bash
  git switch main && git pull --ff-only
  git switch -c <type>/<short-kebab-description>
  ```
- Never commit directly to `main`.
- Branch type matches the commit type: `feat/` or `bug/` (for example `feat/sleep-timer-presets`, `bug/resume-position-reset`).
- One concern per branch. Unrelated work gets its own branch, even if small.
- A new feature or bug means a **new branch**, never a continuation of an old one.

### 3.2 One commit per branch

- A branch contains exactly **one commit** on top of `main`.
- The first set of changes creates the commit. **Every later change is amended into it**, including after the PR is open:
  ```bash
  git add -A
  git commit --amend            # keep the message in sync with the changes
  git push --force-with-lease   # never plain --force
  ```
- Never add a second commit, fixup commit, or merge commit to a feature branch.
- If `main` moved, rebase the single commit onto it (`git rebase main`), re-run the checks, then force-push with lease.
- Before pushing, confirm: `git log --oneline main..HEAD` shows exactly one line.
- `--force-with-lease` is allowed only on your own feature branch, never on `main`.

### 3.3 Commit message format (commit lint)

```
<type>: <brief description of the overall change>

- <individual change 1>
- <individual change 2>
- <individual change 3>
```

Rules:

- `<type>` is exactly `feat` (new functionality, enhancement) or `bug` (bug fix), followed by `: ` (colon and space).
- Subject line: imperative mood ("add", not "added"), lowercase after the colon, no trailing period, 72 characters or fewer.
- A blank line separates the subject from the body.
- The body is a list of `- ` bullets, one per individual change: what changed and why when it isn't obvious.
- When amending, **update the subject and bullets** so they describe the whole commit, not just the latest tweak.
- Include the attribution trailer the tooling requires (for example `Co-Authored-By`) at the end.

Example:

```
feat: add sleep timer presets to the story screen

- Add 10/20/30 minute presets to the sleep timer sheet
- Persist the last used preset in AsyncStorage
- Fade out audio during the final 10 seconds before stopping
- Add unit tests for timer countdown and persistence
```

Non-conforming types (`fix`, `chore`, `refactor`, `docs`) are not used. Classify the change as `feat` or `bug`. Refactors, docs, and tooling that support a feature ride with that feature. Standalone ones use `feat`.

### 3.4 Pre-commit gate

A commit or amend may only be created when **all** of these pass locally (section 4.3):

- tests
- lint
- typecheck

If something fails, fix it first. Do not commit "to fix later", do not skip with `--no-verify`, and do not disable or delete a failing test to get green. A failing test is either a real bug (fix the code) or an outdated expectation (update it deliberately and say so in the PR).

---

## 4. Testing and quality gates

### 4.1 What to test

Every change ships with tests. Default to adding them; skipping needs a stated reason in the PR.

| Change | Required tests |
| --- | --- |
| Bug fix | A regression test that fails before the fix and passes after |
| New logic (`src/lib`, hooks, utils) | Unit tests, including edge cases and error paths |
| New or changed component | Component tests with React Native Testing Library: render, interaction, accessibility labels, states (loading, empty, error) |
| New or changed screen or route | Render test plus the main navigation flow |
| Persistence (AsyncStorage) | Tests with a mocked store: read, write, corrupt or missing data |
| Audio and native modules | Mock at the module boundary, test our logic around it |

Good tests are deterministic (no real timers, network, or filesystem; use fakes), assert behavior rather than implementation details, query by role, label, or text rather than test IDs when possible, and are named by behavior ("resumes from the saved position").

### 4.2 Tooling

- Runner: `jest-expo` with `@testing-library/react-native`. Install with `npx expo install` so versions match the SDK.
- Tests are colocated as `*.test.ts(x)` next to the code, or in a `__tests__/` folder beside it. They never go in `src/app/`, because every file there becomes a route.
- If the project has no test script yet, adding the test setup is the first task, in its own branch.

### 4.3 Checks before every commit and amend

```bash
npm test                 # all tests pass
npx expo lint            # no lint errors
npx tsc --noEmit         # no type errors
```

Also run `npx expo-doctor` whenever dependencies or `app.json` change.

Manual verification is required for UI and native-behavior changes: run on an iOS simulator (`npx expo run:ios`) in **iPhone portrait, iPhone landscape, and iPad**, and describe what you checked in the PR. Tests passing is not evidence that the UI works.

---

## 5. iOS best practices (mandatory)

Follow Apple's Human Interface Guidelines. Review each item for any UI or native change.

**Layout and devices**
- Support iPhone and iPad, portrait and landscape (`supportsTablet` is on). Use adaptive layouts (window size, not device model checks).
- Respect safe areas with `react-native-safe-area-context` (notch, Dynamic Island, home indicator). Never hardcode inset values.
- Handle the keyboard, split view, and Stage Manager resizing without clipped content.

**Interaction**
- Touch targets are at least 44x44 pt.
- Use native-feeling gestures and transitions. Preserve the swipe-back gesture. Don't hijack system gestures.
- Provide haptic feedback sparingly and only for meaningful actions (`expo-haptics`).
- Use the system font stack and SF Symbols or equivalent. Keep type consistent with the theme in `src/theme.ts`.

**Accessibility (not optional)**
- Every interactive element has `accessibilityLabel`, `accessibilityRole`, and state where relevant.
- Support Dynamic Type (don't lock font sizes where text must scale; test large sizes).
- Keep text contrast at WCAG AA or better. Don't convey meaning by color alone.
- Test with VoiceOver for new screens and controls. Respect Reduce Motion.

**Audio and background behavior** (core to this app)
- Keep background playback, lock-screen and Control Center controls, and audio interruption handling (calls, Siri, other apps) working. Re-test on any player change.
- Handle route changes (headphones unplugged should pause).
- Never block the JS thread during playback updates.

**Platform and privacy**
- Request permissions only when needed, with accurate usage strings in `app.json`. Don't ask for more than the feature requires.
- Follow App Store Review Guidelines. Because this is a kids' audio app, also follow the Kids Category and COPPA expectations: no third-party analytics or ads without explicit approval, no collection of personal data.
- Respect light and dark appearance or deliberately lock it (currently `userInterfaceStyle: "light"`) and keep that decision consistent.

**Performance**
- Keep launch fast. Defer heavy work and use the splash screen correctly.
- Use `FlatList` / `FlashList` for lists, memoize rows, and avoid inline closures in hot paths. Don't render long lists in a `ScrollView`.
- Keep animations on the native driver or Reanimated (UI thread) and aim for 60 fps (120 on ProMotion).
- Watch memory and battery: clean up listeners, timers, and audio resources on unmount.

---

## 6. Tech stack best practices (mandatory)

### Expo and React Native
- Use **Continuous Native Generation**. Never create or edit `ios/` or `android/` by hand. Configure native behavior via `app.json` and config plugins.
- Install packages with `npx expo install <pkg>`, never `npm install <pkg>`, so versions match the SDK.
- Prefer Expo modules over third-party libraries. Justify any new dependency in the PR (size, maintenance, native code).
- Libraries with native code need a development build, not Expo Go.
- Use `process.env.EXPO_PUBLIC_*` for public config. Never commit secrets.
- Don't use deprecated or removed APIs. Check the SDK 58 docs and fix deprecation warnings rather than silencing them.

### Expo Router
- All routes live in `src/app/`, and every file there is a screen. Non-route code (components, hooks, utils, tests) lives outside it.
- Use `Link`, `router`, `useLocalSearchParams` from `expo-router`. Type route params.
- Use `_layout.tsx` for navigators and shared chrome. Support deep links (`urstory://`).

### TypeScript
- `strict` mode stays on. No `any` (use `unknown` and narrow), no `@ts-ignore` (use `@ts-expect-error` with a reason, and only when unavoidable).
- Shared types live in `src/types.ts` or next to their feature. Prefer discriminated unions to boolean flags.
- Validate data from outside the app (remote `stories.json`, AsyncStorage) at the boundary before trusting its shape.

### React
- Function components and hooks only. Keep components small and single-purpose.
- Respect the Rules of Hooks and exhaustive dependency arrays. Don't suppress the lint rule.
- Derive state instead of duplicating it. Lift state only as high as needed. Use the existing providers (`LibraryProvider`, `PlayerProvider`) rather than adding global state ad hoc.
- Always clean up effects (listeners, timers, subscriptions).
- Memoize only where it measurably helps. Don't pre-optimize.

### Data and storage
- AsyncStorage is for small local state (favorites, resume position, listened). Keep keys namespaced and versioned, and handle missing or corrupt values with safe defaults.
- Remote catalog fetches must have a timeout, error handling, and a fallback to the bundled `src/data/stories.json`. The app must work offline.

### Audio (`expo-audio`)
- Keep player logic behind `PlayerProvider`. UI components don't touch the player API directly.
- Release players on teardown. Keep the audio mode config (background playback, interruptions) in one place.

### Styling and assets
- Use design tokens from `src/theme.ts`. No magic colors, spacing, or font sizes in components.
- Use `StyleSheet.create`. Provide `@1x/@2x/@3x` or vector assets, and optimize image and audio sizes.

---

## 7. Project structure and code style

```
src/
  app/          routes only (Expo Router)
  components/   reusable UI (+ colocated tests)
  lib/          logic, providers, hooks, utils (+ colocated tests)
  data/         bundled static data
  theme.ts      design tokens
  types.ts      shared types
```

- Match the style of the surrounding code: naming, file layout, comment density. Components in `PascalCase.tsx`, utils and hooks in `camelCase.ts`.
- Prefer small, focused files. If a file grows past what's easy to read, split it.
- Comments explain **why**, not what. Don't commit commented-out code, `console.log` debugging, or TODOs without an issue reference.
- Keep diffs focused. Don't mix unrelated formatting or refactors into a feature or bug change.
- Handle errors explicitly. Don't swallow them silently, and show friendly, child-appropriate states in the UI.
- Never commit secrets, tokens, `.env` files, or personal data.

---

## 8. Pull requests

- One PR per branch, containing exactly one commit (section 3.2).
- PR title equals the commit subject (`feat: ...` or `bug: ...`).
- Open as a draft until checks pass and the checklist is complete.
- Changes after opening (including review feedback) are **amended into the commit and force-pushed with lease**. Do not add commits. Note the update in a PR comment so reviewers know to re-review.
- Keep PRs small and reviewable. If a change is big, split the work into separate branches that each deliver value.
- Merge strategy: **squash or rebase-merge** (the branch is already a single commit). Delete the branch after merge.
- End the PR description with the attribution line the tooling requires.

### PR description template

Copy into every PR:

````markdown
## Summary
<!-- What does this change do, and why? 1-3 sentences. -->

## Type
- [ ] `feat` New feature or enhancement
- [ ] `bug` Bug fix

## Related
<!-- Issue, ticket, or discussion links. "None" if not applicable. -->

## Changes
<!-- Mirror the commit body: one bullet per individual change. -->
-
-

## How to test
<!-- Steps a reviewer can follow. Include the expected result. -->
1.
2.

## Screenshots / recordings
<!-- Required for UI changes. Before/after, and iPhone + iPad where relevant. -->

## Tests
<!-- What tests were added or updated? If none, explain why. -->
- [ ] Unit / component tests added or updated
- [ ] Bug fixes include a regression test

## Checklist
- [ ] Branched from latest `main`, and the branch has **exactly one commit**
- [ ] Commit message follows `feat|bug: description` + bullet list, and matches this PR
- [ ] `npm test` passes
- [ ] `npx expo lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npx expo-doctor` passes (if dependencies or `app.json` changed)
- [ ] Verified on iOS simulator: iPhone portrait, iPhone landscape, iPad
- [ ] Accessibility checked: labels, Dynamic Type, VoiceOver, 44pt targets
- [ ] Background audio / lock-screen controls re-verified (if player-related)
- [ ] Safe areas and keyboard handled (if UI-related)
- [ ] No `ios/` or `android/` hand edits; native changes go through `app.json` / config plugins
- [ ] New dependencies installed via `npx expo install` and justified below
- [ ] No secrets, debug logs, or commented-out code
- [ ] Docs updated (README / this document) if behavior or workflow changed

## Risks and notes
<!-- Migrations, new permissions, new dependencies and why, known limitations, follow-ups. -->
````

---

## 9. Bug-fix specifics

1. Reproduce first. Write a failing test that captures the bug.
2. Find the root cause rather than patching the symptom.
3. Fix it, confirm the test now passes, and run the full suite.
4. Commit as `bug: <what was broken, fixed>`, with bullets for the cause and the fix.
5. In the PR, describe the root cause and how it was verified.

## 10. Definition of done

A feature or bug is done only when:

- [ ] The work is on its own branch from `main`, in exactly one commit with a conforming message
- [ ] Tests were added and `npm test`, lint, and typecheck all pass
- [ ] iOS best practices (section 5) were reviewed and UI was verified on simulator
- [ ] The PR is open with the template filled in, and any review changes were amended into the single commit
- [ ] No unrelated changes slipped in

---

## 11. Keeping this document current

Changing the workflow, stack, or standards is itself a change. Edit this file in a `feat` branch under the same rules, and update the pointer in `AGENTS.md` if the path changes.
