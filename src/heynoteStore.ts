/** The Heynote pane's notes as tiili keeps them; see `src-tauri/src/notes.rs` for the files behind them. */
export interface NoteLibrary {
  /** Each note's text by its library path, such as `scratch.txt` or `work/plan.txt`. */
  notes: Record<string, string>;
  /** The library's folders, including empty ones. */
  dirs: string[];
  /** The pane's own settings, open tabs and theme; null before anything was saved. */
  state: Record<string, string> | null;
}

/**
 * Where the Heynote pane keeps its notes. The pane loads the library once and then writes each change; the
 * Heynote page reaches this through `window.parent.tiiliHeynote` (see `heynote/bridge.js`).
 */
export interface NoteStore {
  load(): Promise<NoteLibrary>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  rmdir(path: string): Promise<void>;
  saveState(state: Record<string, string>): Promise<void>;
}

const PREFIX = "tiili-heynote:";
const NOTE = `${PREFIX}note:`;
const DIRS = `${PREFIX}dirs`;
const STATE = `${PREFIX}state`;

/** A note store in browser storage, for the browser dev server, which has no files to write. */
export function localNoteStore(storage: Storage): NoteStore {
  const dirs = (): string[] => JSON.parse(storage.getItem(DIRS) ?? "[]") as string[];
  const setDirs = (list: string[]) => storage.setItem(DIRS, JSON.stringify([...new Set(list)].sort()));
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
    write: (path, content) => Promise.resolve(storage.setItem(NOTE + path, content)),
    remove: (path) => Promise.resolve(storage.removeItem(NOTE + path)),
    move: (from, to) => {
      const content = storage.getItem(NOTE + from);
      if (content !== null) storage.setItem(NOTE + to, content);
      storage.removeItem(NOTE + from);
      return Promise.resolve();
    },
    mkdir: (path) => Promise.resolve(setDirs([...dirs(), path])),
    rmdir: (path) => Promise.resolve(setDirs(dirs().filter((dir) => dir !== path))),
    saveState: (state) => Promise.resolve(storage.setItem(STATE, JSON.stringify(state))),
  };
}
