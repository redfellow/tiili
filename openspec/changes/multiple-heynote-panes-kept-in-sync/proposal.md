# Proposal

## Why

The Heynote button only focuses the open Heynote pane: tiili allows one, because each Heynote page loads every note
once and writes whole notes back, so two pages on one note overwrite each other. The user wants a Heynote tile any
time, as many as wanted, in any window.

## What Changes

- The Heynote button always opens a new Heynote pane after the others and focuses it; the "at most one" rule and
  its "Already open" scenario go.
- Heynote panes stay in sync. Every note write, create, delete or move, and every folder create or remove, made
  through tiili's note store is broadcast as a Rust event (`heynote-notes-changed`) to every window; each Heynote
  page except the one that made the change updates its notes map and folder list and hands note-text changes to
  Heynote through `buffer.addOnChangeCallback`, which `heynote/bridge.js` stubs out today.
- In the browser dev server (no Rust), the local note store broadcasts to the pages of the same tab.
- Accepted: editing the same note in two panes at once reloads it in the other pane and may move its cursor;
  `heynote/state.json` (open tabs, settings) stays last-writer-wins.

## Outcome

- Clicking the Heynote button while a Heynote pane is open
  - Now: the open Heynote pane takes the focus
  - After: a second Heynote pane opens and takes the focus
- Typing in one Heynote pane
  - After: the same note in another Heynote pane shows the typed text

## Assumptions

- Changes are broadcast by tiili's own commands, not by watching the notes folder; files edited outside tiili are
  still only seen on the next open. Ruled out: a filesystem watcher.
- A page ignores its own changes by an origin id it sends with each command. Ruled out: comparing content.
- Works in either order with the multi-window cards: the event is emitted to the whole app, so later windows get it
  with no extra work.
