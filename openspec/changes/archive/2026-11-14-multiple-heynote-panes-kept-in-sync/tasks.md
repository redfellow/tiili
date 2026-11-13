# Tasks

## 1. Broadcast note changes from Rust

- [x] 1.1 Add `origin` to the mutating `heynote_*` commands and emit `heynote-notes-changed` with a tagged
  `NoteChange` payload after each succeeds; unit-test the payload's JSON shape for each kind in `notes.rs` tests
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib notes`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 2. Frontend note store

- [x] 2.1 Add origin and `subscribe` to `NoteStore`; implement them in the Tauri backend (event listener) and the
  local store (in-process listeners); add a table-driven test of `applyNoteChange` and of the local store notifying
  other subscribers but carrying the origin
  Tests to update: src/heynoteStore.test.ts
  - proof: `npx vitest run src/heynoteStore.test.ts`
  - proof: `npx eslint src/heynoteStore.ts src/heynoteStore.test.ts src/backend.ts src/backend-tauri.ts src/backend-ws.ts`

## 3. Bridge and panes

- [x] 3.1 In `heynote/bridge.js`, pass an origin id on mutations, subscribe to changes, update `notes` and
  `directories`, implement `addOnChangeCallback`/`removeOnChangeCallback` and refresh Heynote's library for
  created, deleted and moved notes; update the header comment
  - proof: `grep -n "addOnChangeCallback(path" heynote/bridge.js`
  - proof: `npx vitest run src/heynoteSaveOnClose.test.ts`
- [x] 3.2 Make `Panes.openHeynote` always open a new pane and update its doc comment
  - proof: `npx eslint src/panes.ts`
  - proof: `npm run typecheck`

## 4. Heynote in every window

- [x] 4.1 Make `Panes.openHeynote` open a pane in the clicked window without claiming Heynote; remove the
  `heynote-focus` listener, `Panes.focusHeynote` if then unused, the release on last-pane close, and
  `claimHeynote`/`releaseHeynote`/`focusHeynote` from `Backend` and its Tauri and WS implementations
  - proof: `npx eslint src/panes.ts src/backend.ts src/backend-tauri.ts src/backend-ws.ts`
- [x] 4.2 Remove `HeynoteOwner`, `heynote_claim`, `heynote_release`, `heynote_focus` and `HEYNOTE_FOCUS_EVENT` from
  `notes.rs`, their registration and managed state in `lib.rs`, and the ownership unit test in `notes.rs`
  Tests to update: src-tauri/src/notes.rs (ownership claim/release test)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib notes`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- Open two Heynote panes, type in one: the other shows the text on the same note.
- Create, delete and move a note in one pane: the other's notes list follows.
- Close one pane and quit; reopen Heynote: nothing typed is lost.
- With two tiili windows, open Heynote in one, then click the Heynote button in the other: a pane opens there, and
  typing in either shows in the other.
- Run `npm run heynote` outside the sandbox (it needs to fetch Heynote's source) and commit the rebuilt
  `public/heynote/`, so the shipped page carries the new bridge; the two-pane checks above then pass.
