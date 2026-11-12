// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { selectBackend, type BackendKind } from "./backend";

describe("Backend selection: Tauri internals pick the Tauri backend, otherwise the WebSocket one", () => {
  const cases: [string, object, BackendKind][] = [
    ["Tauri window", { __TAURI_INTERNALS__: {} }, "tauri"],
    ["Tauri internals set to undefined", { __TAURI_INTERNALS__: undefined }, "tauri"],
    ["plain browser window", { location: {} }, "dev"],
    ["empty window", {}, "dev"],
  ];
  it.each(cases)("%s", (_name, win, kind) => {
    expect(selectBackend(win)).toBe(kind);
  });
});
