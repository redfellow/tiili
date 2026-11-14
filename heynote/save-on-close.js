// What a Heynote page saves when it closes, kept apart from heynote/bridge.js so tiili's tests can check it;
// scripts/heynote.mjs copies it next to the bridge. Pure: no page, store or Heynote state.
//
// On close, Heynote hands the bridge the text of every note it has an editor for, open or cached. A note another
// page deleted or moved away is still in that cache, so saving it would bring the note back under its old path.

/** The library paths `change` (a note change another page made) takes away from this page's notes. */
export function pathsGone(change) {
    switch (change.kind) {
        case "remove":
            return [change.path]
        case "move":
            return [change.from]
        default:
            return []
    }
}

/** The `[path, text]` pairs of `contents` to save on close: all but those another page took away (`gone`). */
export function notesToSave(contents, gone) {
    return [...contents].filter(([path]) => !gone.has(path))
}
