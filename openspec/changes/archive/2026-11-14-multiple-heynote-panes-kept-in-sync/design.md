# Design

## Approach

- **Rust (`src-tauri/src/notes.rs`)**: each mutating command (`heynote_write`, `_remove`, `_move`, `_mkdir`,
  `_rmdir`) takes an extra `origin: Option<String>` (missing from a page built before this change, which then still
  saves; its changes go out with an empty origin, which every page takes as someone else's) and, after it succeeds, emits `heynote-notes-changed` to the whole app
  (`AppHandle::emit`) with a serde-tagged `NoteChange` payload: `{ kind: "write", path, content }`,
  `{ kind: "remove", path }`, `{ kind: "move", from, to }`, `{ kind: "mkdir" | "rmdir", path }`, plus `origin`.
  Building the payload is a plain function, unit-tested beside the existing `notes.rs` tests.
- **Frontend store (`src/heynoteStore.ts`, `src/backend-tauri.ts`, `src/backend-ws.ts`)**: `NoteStore` gains an
  origin argument on mutations and `subscribe(listener): () => void`. The Tauri store listens to the event; the
  local store (dev server) calls its listeners in-process after each mutation. A pure `applyNoteChange(notes, dirs,
  change)` helper, unit-tested, gives the new maps.
- **Bridge (`heynote/bridge.js`)**: each page makes an origin id, passes it on every mutation, subscribes on load and
  unsubscribes on unload/flush. For a change from another origin it updates `notes` and `directories`, keeps
  `_onChangeCallbacks[path]` from `addOnChangeCallback`/`removeOnChangeCallback` and calls them with the new content
  for writes (upstream Heynote then reloads that buffer), and for create/remove/move/folder changes triggers
  Heynote's library refresh the way upstream's file watcher does (the implementer confirms the exact upstream hook
  in Heynote's Electron preload / notes store and records it in a bridge comment).
- **Panes (`src/panes.ts`)**: `openHeynote` drops the find-and-focus branch. `heynotePane.ts` already sets
  `window.tiiliHeynote` idempotently.

## Why

Feeding Heynote's own change callback is the path upstream uses for files edited outside it, so the editor's reload
logic is reused. A Rust event reaches every window, which the multi-window cards need; tiili's commands are the only
writers we sync, so no file watcher is needed.

## Risks

- Same note edited in two panes at once: the other pane reloads and its cursor may move (accepted on the card).
