## 1. Heynote build
- [x] 1.1 `scripts/heynote.mjs` (`npm run heynote`) builds Heynote's web app at a pinned commit with tiili's bridge into `public/heynote/`, with LICENSE and README
- [x] 1.2 `heynote/bridge.js`: notes, folders and state in tiili's note store, loaded before Heynote starts; `tiiliFlush`

## 2. Note store
- [x] 2.1 `src-tauri/src/notes.rs`: load, write, remove, move, mkdir, rmdir, save state; paths kept inside the notes folder; tests
- [x] 2.2 `NoteStore` on the backend: Tauri commands, and localStorage for the browser dev server; tests

## 3. Pane
- [x] 3.1 `src/heynotePane.ts`: the frame, focus, clipboard actions, ⌘X, flush, tiili keys first
- [x] 3.2 `Panes.openHeynote`: one Heynote pane at most, chip, focus, flush on close; clipboard menus routed to it
- [x] 3.3 Heynote button in the top bar, after New pane, without a shortcut

## 4. Verify
- [x] 4.1 Typecheck, lint, vitest and cargo tests
- [ ] 4.2 Try it in the app on macOS: open, type, quit, reopen; copy, paste, cut; focus shortcuts
