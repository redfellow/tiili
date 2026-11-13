// @harvaaja-test-tier: fast
import { describe, expect, it, vi } from "vitest";
import { selectBackend, type BackendKind } from "./backend";
import { tauriBackend } from "./backend-tauri";
import { PROMPT_IDS } from "./settings";

const invoke = vi.hoisted(() => vi.fn<(command: string, args?: unknown) => Promise<unknown>>(async () => 1));

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
  Channel: class {
    onmessage: ((bytes: number[]) => void) | null = null;
  },
}));
const windowListen = vi.hoisted(() => vi.fn(async () => () => undefined));
vi.mock("@tauri-apps/api/webviewWindow", () => ({ getCurrentWebviewWindow: () => ({ listen: windowListen }) }));
vi.mock("@tauri-apps/api/menu", () => ({ Menu: { new: vi.fn() } }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ readText: vi.fn(), writeText: vi.fn() }));

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

describe("Tauri backend", () => {
  it.each(PROMPT_IDS)("New panes use the choice: pty_spawn gets prompt %s", async (prompt) => {
    invoke.mockClear();
    await expect(tauriBackend().spawn(24, 80, "/tmp", prompt, () => undefined)).resolves.toBe(1);
    expect(invoke).toHaveBeenCalledTimes(1);
    const [command, args] = invoke.mock.calls[0];
    expect(command).toBe("pty_spawn");
    expect(args).toMatchObject({ rows: 24, cols: 80, cwd: "/tmp", prompt });
  });
});

describe("Tauri backend events", () => {
  it("Copy with two windows open: menu and shell events are heard on this window only", async () => {
    windowListen.mockClear();
    const backend = tauriBackend();
    await backend.onAppEvent("clipboard", () => undefined);
    await backend.onExit(() => undefined);
    expect(windowListen.mock.calls.map((call: unknown[]) => call[0])).toEqual(["clipboard", "pty-exit"]);
  });
});
