## Approach
- `vite.config.ts`: `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`, reading `package.json`; declare `const __APP_VERSION__: string` in a `.d.ts` under `src/`. Vitest uses the same config, so tests see it.
- `src/version.ts`: `export const APP_VERSION = __APP_VERSION__;` one place to import.
- `src/splash.ts`: append a `span.splash-version` (`v${APP_VERSION}`) to the overlay, coloured `--splash-muted`, absolutely placed bottom-right; it goes with the overlay.
- `src/settingsDialog.ts`: a `span.settings-version` (`tiili ${APP_VERSION}`) first in `settings-footer`, pushed left with `margin-right: auto`.
- Styles in `src/styles.css`. No new test: copy and placement are not tested per workspace rules; typecheck proves the global is declared.
