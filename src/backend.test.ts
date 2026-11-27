// @harvaaja-test-tier: fast
import { describe, expect, it, vi } from "vitest";
import { selectBackend, type Backend, type BackendKind, type PaneMoves, type UnsavedChoice } from "./backend";
import { tauriBackend } from "./backend-tauri";
import { DEFAULT_SETTINGS, PROMPT_IDS } from "./settings";

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
const getCurrentWindow = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow }));
const emitTo = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@tauri-apps/api/event", () => ({ emitTo }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ readText: vi.fn(), writeText: vi.fn() }));
const message = vi.hoisted(() => vi.fn<(text: string, options?: unknown) => Promise<string>>(async () => "Cancel"));
vi.mock("@tauri-apps/plugin-dialog", () => ({ message }));

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

  const launches: [string, Parameters<Backend["spawn"]>[5], Record<string, unknown>][] = [
    ["Open a pane (a shell): no command, the system default shell", undefined, { command: null, path: null, shell: null }],
    ["Open a pane: the command, no caller PATH", { command: ["top"] }, { command: ["top"], path: null }],
    [
      "Command found on the caller's PATH: the command and that PATH",
      { command: ["tail", "-f", "x.log"], path: "/opt/tools:/usr/bin" },
      { command: ["tail", "-f", "x.log"], path: "/opt/tools:/usr/bin" },
    ],
  ];
  it.each(launches)("%s", async (_name, launch, passed) => {
    invoke.mockClear();
    await tauriBackend().spawn(24, 80, "/tmp", "off", () => undefined, launch);
    expect(invoke.mock.calls[0]).toEqual(["pty_spawn", expect.objectContaining({ cwd: "/tmp", ...passed })]);
  });

  const shells: [string, string | undefined, string | null][] = [
    ["New panes use the chosen shell: its path reaches pty_spawn", "/usr/bin/zsh", "/usr/bin/zsh"],
    ["System default by default: an empty choice reaches pty_spawn as null", "", null],
    ["System default by default: a blank choice reaches pty_spawn as null", "  ", null],
    ["System default by default: no choice reaches pty_spawn as null", undefined, null],
  ];
  it.each(shells)("%s", async (_name, shell, passed) => {
    invoke.mockClear();
    await tauriBackend().spawn(24, 80, "/tmp", "off", () => undefined, undefined, undefined, shell);
    expect(invoke.mock.calls[0]).toEqual(["pty_spawn", expect.objectContaining({ shell: passed })]);
  });

  it("Installed shells listed: the Shell menu's shells come from shells_installed", async () => {
    invoke.mockClear();
    const installed = { default: "fish", shells: ["/bin/bash", "/usr/bin/zsh", "/usr/bin/fish"] };
    invoke.mockResolvedValueOnce(installed);
    await expect(tauriBackend().installedShells()).resolves.toEqual(installed);
    expect(invoke.mock.calls).toEqual([["shells_installed"]]);
  });
});

describe("Tauri backend pane control", () => {
  const cases: [string, { pane: number } | { error: string }, Record<string, unknown>][] = [
    ["Open a pane: the window answers with its session", { pane: 7 }, { requestId: 3, pane: 7, error: null }],
    ["A pane that cannot start: the window answers why", { error: "no such program" }, { requestId: 3, pane: null, error: "no such program" }],
  ];
  it.each(cases)("%s", async (_name, result, args) => {
    invoke.mockClear();
    await tauriBackend().paneControl?.done(3, result);
    expect(invoke.mock.calls).toEqual([["pane_open_done", args]]);
  });

  it("Own and opened panes, Minimized pane listed: the window reports its sessions tab by tab and its minimized ones", async () => {
    invoke.mockClear();
    await tauriBackend().paneControl?.setOrder([[4, 2], [7]], [2]);
    expect(invoke.mock.calls).toEqual([["pane_order_set", { tabs: [[4, 2], [7]], minimized: [2] }]]);
  });

  const closes: [string, string | undefined, Record<string, unknown>][] = [
    ["Close own pane: the window answers it closed", undefined, { requestId: 5, error: null }],
    ["Close own pane: the window answers why it could not", "no such pane", { requestId: 5, error: "no such pane" }],
  ];
  it.each(closes)("%s", async (_name, error, args) => {
    invoke.mockClear();
    await tauriBackend().paneControl?.closed(5, error);
    expect(invoke.mock.calls).toEqual([["pane_close_done", args]]);
  });

  const minimizes: [string, string | undefined, Record<string, unknown>][] = [
    ["Minimize own pane: the window answers it is minimized", undefined, { requestId: 6, error: null }],
    ["Last visible pane: the window answers why it could not", "last_visible_pane", { requestId: 6, error: "last_visible_pane" }],
  ];
  it.each(minimizes)("%s", async (_name, error, args) => {
    invoke.mockClear();
    await tauriBackend().paneControl?.minimized(6, error);
    expect(invoke.mock.calls).toEqual([["pane_minimize_done", args]]);
  });
});

describe("Tauri backend prompt choice", () => {
  it.each(PROMPT_IDS)("Open panes switch: pty_set_prompt gets prompt %s", async (prompt) => {
    invoke.mockClear();
    await tauriBackend().setPrompt(prompt);
    expect(invoke.mock.calls).toEqual([["pty_set_prompt", { prompt }]]);
  });

  it("Pasted text in the theme's colour: pty_set_highlight gets the colour", async () => {
    invoke.mockClear();
    await tauriBackend().setHighlight("#3C6680");
    expect(invoke.mock.calls).toEqual([["pty_set_highlight", { colour: "#3C6680" }]]);
  });
});

describe("Tauri backend links: each goes to its core command, which checks it", () => {
  const cases: [string, (backend: Backend) => Promise<unknown>, string, unknown][] = [
    ["openLink", (b) => b.openLink("vscode://x", true), "link_open", { uri: "vscode://x", confirmed: true }],
    ["resolvePaths", (b) => b.resolvePaths(3, ["a.ts"]), "path_resolve", { paneId: 3, candidates: ["a.ts"] }],
    ["openPath", (b) => b.openPath("/tmp/a.ts"), "path_open", { abs: "/tmp/a.ts" }],
    ["revealPath", (b) => b.revealPath("/tmp/a.ts"), "path_reveal", { abs: "/tmp/a.ts" }],
  ];
  it.each(cases)("%s", async (_name, call, command, args) => {
    invoke.mockClear();
    await call(tauriBackend());
    expect(invoke.mock.calls).toEqual([[command, args]]);
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
    [
      "Pop Out: the whole tab under one move",
      (m) =>
        m.move(undefined, {
          kind: "tab",
          name: "build",
          layout: { colSizes: [1, 1], rowSizes: [1] },
          focused: 1,
          panes: [{ kind: "terminal", session: 3, scrollback: "x", zoom: 0 }, { kind: "heynote" }],
        }),
      "pane_move",
      {
        target: null,
        payload: {
          kind: "tab",
          name: "build",
          layout: { colSizes: [1, 1], rowSizes: [1] },
          focused: 1,
          panes: [{ kind: "terminal", session: 3, scrollback: "x", zoom: 0 }, { kind: "heynote" }],
        },
      },
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

describe("Tauri backend session: each call reaches its core command", () => {
  const cases: [string, (backend: Backend) => Promise<unknown>, string, Record<string, unknown> | undefined][] = [
    ["Two windows reopen: the window takes its saved state", (b) => b.session!.load(), "session_load", undefined],
    ["the window reports its state", (b) => b.session!.update({ tabs: [], activeTab: 0 }), "session_update", { tabState: { tabs: [], activeTab: 0 } }],
    ["Scrollback above the divider: a pane's scrollback is saved", (b) => b.session!.saveScrollback(4, "x"), "session_save_scrollback", { paneId: 4, text: "x" }],
    ["Turned off: saved scrollback and commands are deleted", (b) => b.session!.clearScrollback(), "session_clear_scrollback", undefined],
    ["the window has flushed", (b) => b.session!.flushed(), "session_flushed", undefined],
    ["what runs in a pane is asked", (b) => b.session!.running(3), "pty_running", { id: 3 }],
    ["Up re-runs: the shell starts with the restored history line", (b) => b.spawn(24, 80, "/tmp", "off", () => undefined, undefined, "npm run dev"), "pty_spawn", { history: "npm run dev" }],
  ];
  it.each(cases)("%s", async (_name, call, command, args) => {
    invoke.mockClear();
    invoke.mockResolvedValueOnce({ command: null, program: null });
    await call(tauriBackend());
    const [called, passed] = invoke.mock.calls[0];
    expect(called).toBe(command);
    if (args) expect(passed).toMatchObject(args);
  });
});

describe("Tauri backend settings window", () => {
  it("Open settings twice: each time asks the core to open or focus this window's settings window", async () => {
    invoke.mockClear();
    const settings = tauriBackend().settingsWindows;
    await settings?.open();
    await settings?.open();
    expect(invoke.mock.calls.map((call) => call[0])).toEqual(["settings_open", "settings_open"]);
  });

  it.each([
    ["Keep editing: a handler resolving false keeps the window open", false, true],
    ["Save from the question: Save closes the window itself, so the OS close is held back", false, true],
    ["Close with the OS control: a handler resolving true lets the window close", true, false],
  ])("%s", async (_name, close, prevented) => {
    type Listener = (event: { preventDefault: () => void }) => Promise<void>;
    let listener: Listener | undefined;
    getCurrentWindow.mockReturnValue({ onCloseRequested: async (cb: Listener) => { listener = cb; } });
    await tauriBackend().settingsWindows?.onCloseRequested(async () => close);
    const preventDefault = vi.fn();
    await listener?.({ preventDefault });
    expect(listener).toBeDefined();
    expect(preventDefault).toHaveBeenCalledTimes(prevented ? 1 : 0);
  });

  it("Previews show in the owning window: the preview goes to the owner only", async () => {
    emitTo.mockClear();
    await tauriBackend().settingsWindows?.preview("window-2", DEFAULT_SETTINGS);
    expect(emitTo).toHaveBeenCalledWith("window-2", "settings-preview", DEFAULT_SETTINGS);
  });
});

describe("Confirm closing with unsaved changes: the message box's answer picks what happens", () => {
  it.each<[string, string, UnsavedChoice]>([
    ["Save from the question: Save saves", "Save", "save"],
    ["Save from the question: Yes standing in for Save saves", "Yes", "save"],
    ["Discard discards", "Discard", "discard"],
    ["No standing in for Discard discards", "No", "discard"],
    ["Keep editing: Cancel keeps the settings open", "Cancel", "keep"],
    ["Keep editing: a dismissed box keeps the settings open", "", "keep"],
  ])("%s", async (_name, answer, choice) => {
    message.mockResolvedValueOnce(answer);
    await expect(tauriBackend().confirmUnsaved()).resolves.toBe(choice);
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
