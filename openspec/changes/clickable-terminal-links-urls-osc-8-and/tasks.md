## 1. Rust

- [ ] 1.1 Add `src-tauri/src/links.rs` with `classify_url` and `resolve_path` (relative, `~/`, absolute, drive paths, line suffix stripped, reveal-only rules per platform) and a table-driven test `src-tauri/tests/links.rs` (first line `// @harvaaja-test-tier: fast`) covering allowed, confirmed and denied schemes and path resolution in a temp folder
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test links`
- [ ] 1.2 Add commands `link_open`, `path_resolve` (plain text for remote and WSL hosts), `path_open` (refuses reveal-only) and `path_reveal`, registered in `lib.rs`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test links`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 2. Frontend

- [ ] 2.1 Add `@xterm/addon-web-links`; add `src/links.ts` with `findPathCandidates` and `isOpenGesture`, and a table-driven `src/links.test.ts` (first line `// @harvaaja-test-tier: fast`)
  - proof: `npx vitest run src/links.test.ts`
  - proof: `npx eslint src/links.ts src/links.test.ts`
- [ ] 2.2 Extend `Backend` (`backend.ts`, `backend-tauri.ts`, `backend-ws.ts`) with `openLink`, `resolvePaths`, `openPath`, `revealPath`
  - proof: `npx vitest run src/backend.test.ts src/backend-ws.test.ts`
  - proof: `npx eslint src/backend.ts src/backend-tauri.ts src/backend-ws.ts`
- [ ] 2.3 Add `src/terminalLinks.ts`: web links addon, OSC 8 `linkHandler`, path link provider (hovered line only, debounced, cached per cwd), hover hint inside the pane, confirm dialog, capture-phase modifier-click for mouse-reporting programs; wire it into terminal panes only (not Heynote) in `terminal.ts`/`panes.ts`, styles in `styles.css` from brand tokens
  - proof: `npx eslint src/terminalLinks.ts src/terminal.ts src/panes.ts`
- [ ] 2.4 Prepend link items to the right-click menu in `src/clipboard.ts` from the hovered link (Open Link/Copy Link; Open/Reveal in Finder·Show in Explorer·Show in Folder/Copy Path)
  - proof: `npx eslint src/clipboard.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- On macOS, Windows and Linux: ⌘/Ctrl-click a URL, an OSC 8 link (`printf '\e]8;;https://example.com\e\\text\e]8;;\e\\'`) and an existing `src/main.ts:10`; plain click does nothing.
- Inside Claude Code, ⌘/Ctrl-click a URL opens it.
- A `vscode://` link asks first; a `javascript:` OSC 8 link never opens.
- `./script.sh` with exec bit only reveals; a folder opens in the file manager.
- Right-click on a URL and a path shows the link items; paths in an ssh pane are plain text.
