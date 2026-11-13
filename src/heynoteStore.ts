/** The Heynote pane's notes as tiili keeps them; see `src-tauri/src/notes.rs` for the files behind them. */
export interface NoteLibrary {
  /** Each note's text by its library path, such as `scratch.txt` or `work/plan.txt`. */
  notes: Record<string, string>;
  /** The library's folders, including empty ones. */
  dirs: string[];
  /** The pane's own settings, open tabs and theme; null before anything was saved. */
  state: Record<string, string> | null;
}

/** One change to the notes, as `src-tauri/src/notes.rs` sends it in its `heynote-notes-changed` event. */
export type NoteChange =
  | { kind: "write"; path: string; content: string }
  | { kind: "remove"; path: string }
  | { kind: "move"; from: string; to: string }
  | { kind: "mkdir" | "rmdir"; path: string };

/** A change and the Heynote page that made it, which ignores its own changes by this origin. */
export type NotesChanged = NoteChange & { origin: string };

/**
 * Where the Heynote pane keeps its notes. Each pane loads the library once and then writes each change, passing
 * its own `origin`; every pane hears every change through `subscribe` and follows the ones other panes made.
 * The Heynote page reaches this through `window.parent.tiiliHeynote` (see `heynote/bridge.js`).
 */
export interface NoteStore {
  load(): Promise<NoteLibrary>;
  write(path: string, content: string, origin: string): Promise<void>;
  remove(path: string, origin: string): Promise<void>;
  move(from: string, to: string, origin: string): Promise<void>;
  mkdir(path: string, origin: string): Promise<void>;
  rmdir(path: string, origin: string): Promise<void>;
  saveState(state: Record<string, string>): Promise<void>;
  /** Calls `listener` after each change to the notes, from any pane; returns what stops it. */
  subscribe(listener: (change: NotesChanged) => void): () => void;
}

/** The notes and folders after `change`; the inputs are left as they were. */
export function applyNoteChange(
  notes: Record<string, string>,
  dirs: string[],
  change: NoteChange,
): { notes: Record<string, string>; dirs: string[] } {
  const next = { ...notes };
  switch (change.kind) {
    case "write":
      next[change.path] = change.content;
      return { notes: next, dirs };
    case "remove":
      delete next[change.path];
      return { notes: next, dirs };
    case "move":
      if (change.from in notes) next[change.to] = notes[change.from];
      delete next[change.from];
      return { notes: next, dirs };
    case "mkdir":
      return { notes, dirs: dirs.includes(change.path) ? dirs : [...dirs, change.path] };
    case "rmdir":
      return { notes, dirs: dirs.filter((dir) => dir !== change.path) };
  }
}

/** Listeners for note changes; one that throws (a closed pane's page) never stops the others. */
export function noteListeners(): {
  subscribe: NoteStore["subscribe"];
  notify(change: NotesChanged): void;
} {
  const listeners = new Set<(change: NotesChanged) => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify: (change) => {
      for (const listener of [...listeners]) {
        try {
          listener(change);
        } catch (error) {
          console.error("A Heynote pane could not take a note change:", error);
        }
      }
    },
  };
}

const PREFIX = "tiili-heynote:";
const NOTE = `${PREFIX}note:`;
const DIRS = `${PREFIX}dirs`;
const STATE = `${PREFIX}state`;

/**
 * A note store in browser storage, for the browser dev server, which has no files to write. It tells the panes of
 * this page about each change itself.
 */
export function localNoteStore(storage: Storage): NoteStore {
  const dirs = (): string[] => JSON.parse(storage.getItem(DIRS) ?? "[]") as string[];
  const setDirs = (list: string[]) => storage.setItem(DIRS, JSON.stringify([...new Set(list)].sort()));
  const { subscribe, notify } = noteListeners();
  const done = (change: NotesChanged) => {
    notify(change);
    return Promise.resolve();
  };
  return {
    load: () => {
      const notes: Record<string, string> = {};
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(NOTE)) notes[key.slice(NOTE.length)] = storage.getItem(key) ?? "";
      }
      const state = storage.getItem(STATE);
      return Promise.resolve({ notes, dirs: dirs(), state: state ? (JSON.parse(state) as Record<string, string>) : null });
    },
    write: (path, content, origin) => {
      storage.setItem(NOTE + path, content);
      return done({ kind: "write", path, content, origin });
    },
    remove: (path, origin) => {
      storage.removeItem(NOTE + path);
      return done({ kind: "remove", path, origin });
    },
    move: (from, to, origin) => {
      const content = storage.getItem(NOTE + from);
      if (content !== null) storage.setItem(NOTE + to, content);
      storage.removeItem(NOTE + from);
      return done({ kind: "move", from, to, origin });
    },
    mkdir: (path, origin) => {
      setDirs([...dirs(), path]);
      return done({ kind: "mkdir", path, origin });
    },
    rmdir: (path, origin) => {
      setDirs(dirs().filter((dir) => dir !== path));
      return done({ kind: "rmdir", path, origin });
    },
    saveState: (state) => Promise.resolve(storage.setItem(STATE, JSON.stringify(state))),
    subscribe,
  };
}
