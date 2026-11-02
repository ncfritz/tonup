# 0010: v1 stack

- Status: Accepted
- Date: 2026-11-02
- Builds on: [0002](0002-expo.md)

## Context

ADR 0002 chose Expo and said the implementation plan would fix the libraries, matching Tippytoe by default. The plan ([../../plan/v1-implementation.md](../../plan/v1-implementation.md) §1) now does.

## Decision

Use Tippytoe's stack and tooling, with the same versions where both apps use a package:

- **App:** Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6 (strict, `noUncheckedIndexedAccess`), React Compiler on, typed routes.
- **Navigation:** expo-router (`src/app/`), with our own tab bar (`src/ui/TabBar.tsx`) for the floating pill and the dartboard Play button.
- **Styling:** Unistyles 3 with ten named themes (`<theme>-<mode>`, for example `pro-dark`). Adaptive themes are off; `ThemeSync` picks the theme from the theme and appearance settings.
- **Fonts:** Barlow and Barlow Condensed (`@expo-google-fonts`), as in the Pro mockups. The Pro themes add their own fonts in M14.
- **State and data:** Zustand; expo-sqlite with Drizzle ORM and bundled SQL migrations (from M2).
- **Drawing and motion:** react-native-svg for the board, charts and icons; Reanimated 4 and Gesture Handler for the loupe, drag and the replay scrubber.
- **i18n:** i18next with ICU and typed keys; English only at launch.
- **Platform:** expo-haptics, expo-keep-awake, expo-speech (caller), expo-iap (StoreKit 2, from M10), expo-sharing and expo-document-picker (export and import, from M9).
- **Quality:** Jest (jest-expo) and React Native Testing Library, Maestro flows, ESLint 9 (eslint-config-expo) with Prettier, simple-git-hooks and lint-staged; `pnpm check` runs typecheck, lint, tests and the contrast check.
- **Builds:** local `expo prebuild` and Xcode (`pnpm ios`), iOS 18.0, iPhone only for v1, bundle ID `app.tonup.ios`.

Packages are added in the milestone that first needs them, not all at once.

## Consequences

- Patterns and scripts can be copied from Tippytoe with little change, and upgrades to a new Expo SDK can be done for both apps together.
- The domain layer (`src/domain`) is plain TypeScript, enforced by ESLint, so game rules are tested without React Native.
- iPad support and Android are left for later; nothing here rules them out.
