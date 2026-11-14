import type { Backend, SessionId } from "./backend";
import { showContextMenu } from "./context-menu";
import { localNoteStore } from "./heynoteStore";
import type { PromptId } from "./settings";

/** A message the page sends the dev bridge: typed input, or the terminal's new size. */
export type ClientMessage = { type: "input"; data: string } | { type: "resize"; rows: number; cols: number };
/** A text message the dev bridge sends the page; shell output arrives as binary messages instead. */
export type ServerMessage =
  | { type: "ready" }
  | { type: "error"; message: string }
  | { type: "exit"; code: number };

/** The line a spawn fails with when the bridge reports it could not start the shell. */
const SHELL_FAILED = "The dev bridge could not open a shell: ";

/** The name of the meta tag the dev server puts the bridge's per-run token in. */
export const TOKEN_META = "tiili-bridge-token";

export function encodeClient(message: ClientMessage): string {
  return JSON.stringify(message);
}

/** Reads a text message from the bridge; anything other than a well-formed ready, error or exit message is null. */
export function decodeServer(text: string): ServerMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { type, code, message } = value as { type?: unknown; code?: unknown; message?: unknown };
  if (type === "ready") return { type };
  if (type === "error" && typeof message === "string") return { type, message };
  if (type === "exit" && typeof code === "number") return { type, code };
  return null;
}

/** The bridge's address on the dev server that served the page, with the shell's size, its prompt and the token. */
export function bridgeUrl(
  page: { protocol: string; host: string },
  rows: number,
  cols: number,
  prompt: PromptId,
  token: string,
): string {
  const scheme = page.protocol === "https:" ? "wss:" : "ws:";
  const query = new URLSearchParams({ rows: String(rows), cols: String(cols), prompt, token });
  return `${scheme}//${page.host}/pty?${query}`;
}

/** The parts of a WebSocket the backend uses. */
export interface SocketLike {
  binaryType: BinaryType;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface WsOptions {
  openSocket: (url: string) => SocketLike;
  page: { protocol: string; host: string };
  token: string;
  clipboard: { readText(): Promise<string>; writeText(text: string): Promise<void> };
}

function defaultOptions(): WsOptions {
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${TOKEN_META}"]`);
  return {
    openSocket: (url) => new WebSocket(url),
    page: window.location,
    token: meta?.content ?? "",
    clipboard: navigator.clipboard,
  };
}

/**
 * The browser dev server's backend: one WebSocket per shell to the dev bridge, the browser clipboard and an
 * HTML right-click menu. There are no native menus, saved settings or window to close.
 */
export function wsBackend(overrides: Partial<WsOptions> = {}): Backend {
  const keys: (keyof WsOptions)[] = ["openSocket", "page", "token", "clipboard"];
  const options: WsOptions = keys.every((key) => key in overrides)
    ? (overrides as WsOptions)
    : { ...defaultOptions(), ...overrides };
  const sockets = new Map<SessionId, SocketLike>();
  const exitListeners = new Set<(id: SessionId, code: number) => void>();
  let nextId = 0;

  const socketOf = (id: SessionId): SocketLike => {
    const socket = sockets.get(id);
    if (!socket) throw new Error(`no session ${id}`);
    return socket;
  };
  const exited = (id: SessionId, code: number) => {
    if (!sockets.delete(id)) return;
    for (const listener of exitListeners) listener(id, code);
  };

  return {
    nativeMenus: false,
    spawn: (rows, cols, _cwd, prompt, onOutput) =>
      new Promise((resolve, reject) => {
        const id = ++nextId;
        const socket = options.openSocket(bridgeUrl(options.page, rows, cols, prompt, options.token));
        socket.binaryType = "arraybuffer";
        // The session is registered on open, but the spawn resolves only once the bridge says the shell runs.
        let ready = false;
        socket.onopen = () => {
          sockets.set(id, socket);
        };
        socket.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            onOutput(new Uint8Array(event.data));
            return;
          }
          if (typeof event.data !== "string") return;
          const message = decodeServer(event.data);
          if (message?.type === "ready") {
            ready = true;
            resolve(id);
          } else if (message?.type === "error") {
            sockets.delete(id);
            reject(new Error(SHELL_FAILED + message.message));
          } else if (message?.type === "exit") {
            exited(id, message.code);
          }
        };
        socket.onclose = () => {
          if (!ready) {
            sockets.delete(id);
            reject(new Error("Could not start the shell: the dev bridge refused the connection"));
          }
          // The bridge went away without an exit message: the shell is gone all the same.
          else exited(id, -1);
        };
        socket.onerror = () => undefined;
      }),
    // The dev bridge's shells keep the prompt they started with.
    setPrompt: async () => undefined,
    write: async (id, data) => socketOf(id).send(encodeClient({ type: "input", data })),
    resize: async (id, rows, cols) => socketOf(id).send(encodeClient({ type: "resize", rows, cols })),
    close: async (id) => {
      const socket = sockets.get(id);
      sockets.delete(id);
      socket?.close();
    },
    cwd: async () => undefined,
    onExit: async (callback) => {
      exitListeners.add(callback);
      return () => exitListeners.delete(callback);
    },
    readClipboard: () => options.clipboard.readText(),
    writeClipboard: (text) => options.clipboard.writeText(text),
    contextMenu: async (items) => async (event) => {
      event.preventDefault();
      showContextMenu(items, event.clientX, event.clientY);
    },
    onAppEvent: async () => undefined,
    loadSettings: async () => null,
    saveSettings: async () => undefined,
    setAppIcon: async () => undefined,
    // The dev server has no files of its own for notes: the browser keeps them.
    notes: localNoteStore(localStorage),
    setTitle: async () => undefined,
    closeWindow: async () => undefined,
    // The dev server is one browser page: no other windows, so no pane moves and no settings window; settings show
    // in the page instead.
    newWindow: async () => undefined,
    settingsWindows: undefined,
  };
}
