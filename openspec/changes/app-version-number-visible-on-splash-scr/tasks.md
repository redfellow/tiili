## 1. Version constant
- [x] 1.1 Add `__APP_VERSION__` define in `vite.config.ts` from `package.json`, its declaration under `src/`, and `src/version.ts` exporting `APP_VERSION`
  - proof: `npx eslint vite.config.ts src/version.ts`

## 2. Show it
- [x] 2.1 Add the `v<version>` label bottom-right on the splash overlay in `src/splash.ts`, styled in `src/styles.css`
  - proof: `npx vitest run src/splash.test.ts`
  - proof: `npx eslint src/splash.ts`
- [x] 2.2 Add `tiili <version>` at the left of the settings footer in `src/settingsDialog.ts`, styled in `src/styles.css`
  - proof: `npx eslint src/settingsDialog.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- Launch tiili with the splash due: the version shows bottom-right and leaves with the splash.
- Open Settings: the footer shows `tiili <version>` at the left on each tab.
