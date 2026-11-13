import { describe, expect, it } from "vitest";
import { localNoteStore } from "./heynoteStore";

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
    await store.write("scratch.txt", "hello");
    await store.write("a.txt", "a");
    await store.move("a.txt", "work/b.txt");
    await store.mkdir("work");
    await store.mkdir("old");
    await store.rmdir("old");
    await store.saveState({ theme: "dark" });
    expect(await store.load()).toEqual({
      notes: { "scratch.txt": "hello", "work/b.txt": "a" },
      dirs: ["work"],
      state: { theme: "dark" },
    });
    await store.remove("scratch.txt");
    expect(Object.keys((await store.load()).notes)).toEqual(["work/b.txt"]);
  });
});
