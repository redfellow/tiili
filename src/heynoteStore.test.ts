// @harvaaja-test-tier: fast
import { describe, expect, it, vi } from "vitest";
import { applyNoteChange, localNoteStore, type NoteChange, type NotesChanged } from "./heynoteStore";

/** A minimal in-memory `Storage`. */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    key: (i) => [...items.keys()][i] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
  };
}

describe("localNoteStore", () => {
  it("starts empty", async () => {
    expect(await localNoteStore(memoryStorage()).load()).toEqual({ notes: {}, dirs: [], state: null });
  });

  it("keeps notes, folders and state", async () => {
    const store = localNoteStore(memoryStorage());
    await store.write("scratch.txt", "hello", "pane");
    await store.write("a.txt", "a", "pane");
    await store.move("a.txt", "work/b.txt", "pane");
    await store.mkdir("work", "pane");
    await store.mkdir("old", "pane");
    await store.rmdir("old", "pane");
    await store.saveState({ theme: "dark" });
    expect(await store.load()).toEqual({
      notes: { "scratch.txt": "hello", "work/b.txt": "a" },
      dirs: ["work"],
      state: { theme: "dark" },
    });
    await store.remove("scratch.txt", "pane");
    expect(Object.keys((await store.load()).notes)).toEqual(["work/b.txt"]);
  });
});

describe("applyNoteChange", () => {
  const notes = { "a.txt": "a", "work/b.txt": "b" };
  const dirs = ["work"];
  it.each<[string, NoteChange, Record<string, string>, string[]]>([
    ["a write adds or replaces a note", { kind: "write", path: "a.txt", content: "new" }, { "a.txt": "new", "work/b.txt": "b" }, dirs],
    ["a remove drops a note", { kind: "remove", path: "a.txt" }, { "work/b.txt": "b" }, dirs],
    ["a move renames a note", { kind: "move", from: "a.txt", to: "c.txt" }, { "c.txt": "a", "work/b.txt": "b" }, dirs],
    ["a move of a missing note adds nothing", { kind: "move", from: "x.txt", to: "y.txt" }, notes, dirs],
    ["a mkdir adds a folder once", { kind: "mkdir", path: "work" }, notes, ["work"]],
    ["a mkdir adds a new folder", { kind: "mkdir", path: "old" }, notes, ["work", "old"]],
    ["a rmdir drops a folder", { kind: "rmdir", path: "work" }, notes, []],
  ])("%s", (_, change, expectedNotes, expectedDirs) => {
    expect(applyNoteChange(notes, dirs, change)).toEqual({ notes: expectedNotes, dirs: expectedDirs });
    expect(notes).toEqual({ "a.txt": "a", "work/b.txt": "b" });
  });
});

describe("localNoteStore changes", () => {
  it("Typing shows in the other pane: every subscriber hears each change with the origin that made it", async () => {
    const store = localNoteStore(memoryStorage());
    const first: NotesChanged[] = [];
    const second: NotesChanged[] = [];
    store.subscribe((change) => first.push(change));
    const stop = store.subscribe((change) => second.push(change));
    await store.write("a.txt", "a", "pane-1");
    await store.move("a.txt", "b.txt", "pane-2");
    stop();
    await store.remove("b.txt", "pane-1");
    await store.mkdir("work", "pane-2");
    await store.rmdir("work", "pane-2");
    expect(first).toEqual([
      { kind: "write", path: "a.txt", content: "a", origin: "pane-1" },
      { kind: "move", from: "a.txt", to: "b.txt", origin: "pane-2" },
      { kind: "remove", path: "b.txt", origin: "pane-1" },
      { kind: "mkdir", path: "work", origin: "pane-2" },
      { kind: "rmdir", path: "work", origin: "pane-2" },
    ]);
    expect(second).toEqual(first.slice(0, 2));
  });

  it("keeps telling the other panes when one pane's listener throws", async () => {
    const store = localNoteStore(memoryStorage());
    const heard: string[] = [];
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    store.subscribe(() => {
      throw new Error("closed pane");
    });
    store.subscribe((change) => heard.push(change.origin));
    await store.write("a.txt", "a", "pane-1");
    expect(heard).toEqual(["pane-1"]);
  });
});
