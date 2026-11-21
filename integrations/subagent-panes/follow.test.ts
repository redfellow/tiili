import { describe, expect, it } from "vitest";

// @ts-expect-error follow.mjs is plain JavaScript without type declarations.
import { clean, eventsOf, render, summarizeArgs } from "./follow.mjs";

describe("eventsOf: Oh My Pi session entries", () => {
  it("reads the task, tool calls with their intent, and results", () => {
    expect(
      eventsOf({ type: "message", message: { role: "user", content: [{ type: "text", text: "Count files" }] } }),
    ).toEqual([{ kind: "user", text: "Count files" }]);
    expect(
      eventsOf({
        type: "message",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "Use ls." },
            { type: "toolCall", name: "bash", arguments: { command: "ls | wc -l" }, intent: "Counting files" },
            { type: "text", text: "2" },
          ],
        },
      }),
    ).toEqual([
      { kind: "thinking", text: "Use ls." },
      { kind: "tool", name: "bash", summary: "Counting files" },
      { kind: "text", text: "2" },
    ]);
    expect(
      eventsOf({
        type: "message",
        message: { role: "toolResult", isError: true, content: [{ type: "text", text: "boom" }] },
      }),
    ).toEqual([{ kind: "result", text: "boom", error: true }]);
  });

  it("ends at the session_exit record omp 18.21 writes", () => {
    expect(eventsOf({ type: "custom", customType: "session_exit", data: { reason: "dispose" } })).toEqual([
      { kind: "end", reason: "dispose" },
    ]);
  });

  it("skips bookkeeping entries", () => {
    expect(eventsOf({ type: "model_change", model: "x" })).toEqual([]);
    expect(eventsOf({ type: "custom", customType: "date-cwd-reminder", data: {} })).toEqual([]);
  });
});

describe("eventsOf: Claude Code transcript entries", () => {
  it("reads a string task, tool_use blocks and tool_result blocks", () => {
    expect(eventsOf({ type: "user", message: { role: "user", content: "Review this" } })).toEqual([
      { kind: "user", text: "Review this" },
    ]);
    expect(
      eventsOf({
        type: "assistant",
        message: { role: "assistant", content: [{ type: "tool_use", name: "Read", input: { file_path: "/a.ts" } }] },
      }),
    ).toEqual([{ kind: "tool", name: "Read", summary: "/a.ts" }]);
    expect(
      eventsOf({
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", content: "ok", is_error: false }] },
      }),
    ).toEqual([{ kind: "result", text: "ok", error: false }]);
  });

  it("skips request bookkeeping", () => {
    expect(eventsOf({ type: "api-request", params: {} })).toEqual([]);
    expect(eventsOf({ type: "attachment", attachment: {} })).toEqual([]);
  });
});

describe("rendering", () => {
  it("strips terminal control sequences from transcript text", () => {
    expect(clean("a\x1b[31mred\x1b[0m\x1b]0;title\x07b\x07\tc\n")).toBe("aredb\tc\n");
  });

  it("summarizes arguments by their most telling field", () => {
    expect(summarizeArgs({ path: "src", i: "Listing src" })).toBe("Listing src");
    expect(summarizeArgs({ pattern: "TODO" })).toBe("TODO");
    expect(summarizeArgs({ a: 1 })).toBe('{"a":1}');
  });

  it("shows only the first lines of a long tool result", () => {
    const lines: string[] = render({ kind: "result", text: "1\n2\n3\n4\n5", error: false }, { sawTask: false });
    expect(lines.join("\n")).toContain("… 2 more lines");
    expect(lines.join("\n")).not.toContain("4");
  });

  it("calls the first user message the task and later ones messages", () => {
    const state = { sawTask: false };
    expect(render({ kind: "user", text: "a" }, state)[0]).toContain("task");
    expect(render({ kind: "user", text: "b" }, state)[0]).toContain("message");
  });
});
