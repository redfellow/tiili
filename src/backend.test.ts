// @harvaaja-test-tier: fast
import { describe, expect, it, vi } from "vitest";
import { selectBackend, type Backend, type BackendKind, type PaneMoves } from "./backend";
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
type MenuNew = (options: unknown) => Promise<{ popup: () => Promise<void> }>;
const menuNew = vi.hoisted(() => vi.fn<MenuNew>(async () => ({ popup: async () => undefined })));
vi.mock("@tauri-apps/api/menu", () => ({ Menu: { new: menuNew } }));
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

describe("Tauri backend prompt choice", () => {
  it.each(PROMPT_IDS)("Open panes switch: pty_set_prompt gets prompt %s", async (prompt) => {
    invoke.mockClear();
    await tauriBackend().setPrompt(prompt);
    expect(invoke.mock.calls).toEqual([["pty_set_prompt", { prompt }]]);
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

describe("Tauri backend pane moves", () => {
  const cases: [string, (moves: PaneMoves) => Promise<unknown>, string, Record<string, unknown> | undefined][] = [
    ["Move to a new window: no target", (m) => m.move(undefined, { kind: "heynote" }), "pane_move", { target: null, payload: { kind: "heynote" } }],
    [
      "Move to an existing window: the target's label",
      (m) => m.move("window-2", { kind: "terminal", session: 3, scrollback: "x", zoom: 1 }),
      "pane_move",
      { target: "window-2", payload: { kind: "terminal", session: 3, scrollback: "x", zoom: 1 } },
    ],
    ["output during the move is kept", (m) => m.detach(3), "pty_detach", { id: 3 }],
    ["the arriving pane attaches", (m) => m.attach(3, () => undefined), "pty_attach", { id: 3 }],
    ["other windows are listed", (m) => m.list(), "window_list", undefined],
    ["the window reports its name", (m) => m.setName("tiili"), "window_set_name", { name: "tiili" }],
    ["the arriving window takes its pane", (m) => m.take("move-1"), "pane_move_take", { token: "move-1" }],
  ];
  it.each(cases)("%s", async (_name, call, command, args) => {
    invoke.mockClear();
    const moves = tauriBackend().moves;
    expect(moves).toBeDefined();
    await call(moves as PaneMoves);
    expect(invoke).toHaveBeenCalledTimes(1);
    const [called, passed] = invoke.mock.calls[0];
    expect(called).toBe(command);
    if (args) expect(passed).toMatchObject(args);
  });

  it("Nothing pending: take resolves to undefined", async () => {
    invoke.mockResolvedValueOnce(null);
    await expect((tauriBackend().moves as PaneMoves).take("move-9")).resolves.toBeUndefined();
  });
});

describe("Tauri backend right-click menu", () => {
  it("Move to an existing window: a submenu becomes a native submenu whose items run their actions", async () => {
    menuNew.mockClear();
    const chosen: string[] = [];
    const backend: Backend = tauriBackend();
    await backend.contextMenu([
      { label: "Copy", action: () => chosen.push("copy") },
      { separator: true },
      { label: "Move to Window", items: [{ label: "tiili (2)", action: () => chosen.push("window-2") }] },
    ]);
    const options = menuNew.mock.calls[0][0] as { items: Record<string, unknown>[] };
    expect(options.items.map((item) => item.text ?? item.item)).toEqual(["Copy", "Separator", "Move to Window"]);
    const submenu = options.items[2].items as { id: string; text: string; action: () => void }[];
    expect(submenu.map((item) => item.text)).toEqual(["tiili (2)"]);
    const ids = [...options.items.map((item) => item.id), ...submenu.map((item) => item.id)].filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    submenu[0].action();
    expect(chosen).toEqual(["window-2"]);
  });
});
