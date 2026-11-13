// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { decodeServer, wsBackend, type SocketLike } from "./backend-ws";
import { PROMPT_IDS } from "./settings";

type Opening = (socket: FakeSocket) => void;

/** The bridge started the shell. */
const startsShell: Opening = (socket) => {
  socket.onopen?.({} as Event);
  socket.receive(JSON.stringify({ type: "ready" }));
};

class FakeSocket implements SocketLike {
  binaryType: BinaryType = "blob";
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor(readonly url: string) {}
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  receive(data: string | ArrayBuffer): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

function setup(opening: Opening = startsShell) {
  const sockets: FakeSocket[] = [];
  const backend = wsBackend({
    openSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      queueMicrotask(() => opening(socket));
      return socket;
    },
    page: { protocol: "http:", host: "127.0.0.1:5173" },
    token: "secret",
    clipboard: { readText: async () => "", writeText: async () => undefined },
  });
  return { backend, sockets };
}

describe("WebSocket backend", () => {
  it.each(PROMPT_IDS)("New panes use the choice: the URL carries prompt %s", async (prompt) => {
    const { backend, sockets } = setup();
    await backend.spawn(24, 80, undefined, prompt, () => undefined);
    expect(new URL(sockets[0].url).searchParams.get("prompt")).toBe(prompt);
  });

  it("Shell in the browser: the URL carries rows, cols, prompt and token, and input and resize frames are sent", async () => {
    const { backend, sockets } = setup();
    const id = await backend.spawn(24, 80, undefined, "off", () => undefined);
    const url = new URL(sockets[0].url);
    expect(url.protocol).toBe("ws:");
    expect(url.host).toBe("127.0.0.1:5173");
    expect(url.pathname).toBe("/pty");
    expect(Object.fromEntries(url.searchParams)).toEqual({ rows: "24", cols: "80", prompt: "off", token: "secret" });
    expect(sockets[0].binaryType).toBe("arraybuffer");

    await backend.write(id, "echo hi\r");
    await backend.resize(id, 30, 100);
    expect(sockets[0].sent.map((frame) => JSON.parse(frame))).toEqual([
      { type: "input", data: "echo hi\r" },
      { type: "resize", rows: 30, cols: 100 },
    ]);
  });

  it("Shell in the browser: binary output reaches the terminal", async () => {
    const { backend, sockets } = setup();
    const output: number[][] = [];
    await backend.spawn(24, 80, undefined, "off", (bytes) => output.push([...bytes]));
    sockets[0].receive(new Uint8Array([104, 105]).buffer);
    expect(output).toEqual([[104, 105]]);
  });

  it("Exit closes the pane: the exit message calls onExit once with the session and code", async () => {
    const { backend, sockets } = setup();
    const exits: [number, number][] = [];
    await backend.onExit((id, code) => exits.push([id, code]));
    const id = await backend.spawn(24, 80, undefined, "off", () => undefined);
    sockets[0].receive(JSON.stringify({ type: "exit", code: 3 }));
    sockets[0].onclose?.({} as CloseEvent);
    expect(exits).toEqual([[id, 3]]);
    await expect(backend.write(id, "x")).rejects.toThrow();
  });

  it("Wrong token: a connection closed before it opens fails the spawn", async () => {
    const { backend } = setup((socket) => socket.onclose?.({} as CloseEvent));
    await expect(backend.spawn(24, 80, undefined, "off", () => undefined)).rejects.toThrow();
  });

  it("No pseudo-terminal available: the bridge's error fails the spawn with the reason, and no exit follows", async () => {
    const { backend } = setup((socket) => {
      socket.onopen?.({} as Event);
      socket.receive(JSON.stringify({ type: "error", message: "openpty: Operation not permitted" }));
      socket.onclose?.({} as CloseEvent);
    });
    const exits: number[] = [];
    await backend.onExit((id) => exits.push(id));
    await expect(backend.spawn(24, 80, undefined, "off", () => undefined)).rejects.toThrow(
      "The dev bridge could not open a shell: openpty: Operation not permitted",
    );
    expect(exits).toEqual([]);
  });

  it("Shell starts: the spawn waits for the bridge's ready message", async () => {
    const { backend, sockets } = setup((socket) => socket.onopen?.({} as Event));
    let resolved = false;
    const spawned = backend.spawn(24, 80, undefined, "off", () => undefined).then((id) => {
      resolved = true;
      return id;
    });
    await new Promise((settle) => setTimeout(settle, 0));
    expect(resolved).toBe(false);
    sockets[0].receive(JSON.stringify({ type: "ready" }));
    await expect(spawned).resolves.toBeTypeOf("number");
  });

  it.each([
    ['{"type":"exit","code":0}', { type: "exit", code: 0 }],
    ['{"type":"ready"}', { type: "ready" }],
    ['{"type":"error","message":"no pty"}', { type: "error", message: "no pty" }],
    ['{"type":"error"}', null],
    ['{"type":"exit"}', null],
    ['{"type":"other","code":1}', null],
    ["not json", null],
    ["null", null],
  ])("decodes %s", (text, expected) => {
    expect(decodeServer(text)).toEqual(expected);
  });
});
