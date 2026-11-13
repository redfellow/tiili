// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { notesToSave, pathsGone } from "../heynote/save-on-close.js";
import type { NoteChange } from "./heynoteStore";

describe("Deleted or moved note: closing a pane does not bring it back", () => {
  const cached: [string, string][] = [
    ["scratch.txt", "s"],
    ["x.txt", "x"],
    ["work/y.txt", "y"],
  ];
  it.each<[string, NoteChange[], string[]]>([
    ["nothing changed elsewhere: every cached note is saved", [], ["scratch.txt", "x.txt", "work/y.txt"]],
    ["another pane deleted x.txt: it is not written again", [{ kind: "remove", path: "x.txt" }], ["scratch.txt", "work/y.txt"]],
    [
      "another pane moved x.txt away: its old path is not written again",
      [{ kind: "move", from: "x.txt", to: "z.txt" }],
      ["scratch.txt", "work/y.txt"],
    ],
    [
      "writes and folder changes take nothing away",
      [
        { kind: "write", path: "x.txt", content: "new" },
        { kind: "mkdir", path: "work" },
        { kind: "rmdir", path: "old" },
      ],
      ["scratch.txt", "x.txt", "work/y.txt"],
    ],
  ])("%s", (_, changes, saved) => {
    const gone = new Set(changes.flatMap(pathsGone));
    expect(notesToSave(cached, gone).map(([path]) => path)).toEqual(saved);
  });
});
