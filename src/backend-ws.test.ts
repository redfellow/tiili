// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { decodeServer, wsBackend, type SocketLike } from "./backend-ws";

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

function setup() {
  const sockets: FakeSocket[] = [];
  const backend = wsBackend({
    openSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      queueMicrotask(() => socket.onopen?.({} as Event));
      return socket;
    },
    page: { protocol: "http:", host: "127.0.0.1:5173" },
    token: "secret",
    clipboard: { readText: async () => "", writeText: async () => undefined },
  });
  return { backend, sockets };
}

describe("WebSocket backend", () => {
  it("Shell in the browser: the URL carries rows, cols and token, and input and resize frames are sent", async () => {
    const { backend, sockets } = setup();
    const id = await backend.spawn(24, 80, undefined, () => undefined);
    const url = new URL(sockets[0].url);
    expect(url.protocol).toBe("ws:");
    expect(url.host).toBe("127.0.0.1:5173");
    expect(url.pathname).toBe("/pty");
    expect(Object.fromEntries(url.searchParams)).toEqual({ rows: "24", cols: "80", token: "secret" });
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
    await backend.spawn(24, 80, undefined, (bytes) => output.push([...bytes]));
    sockets[0].receive(new Uint8Array([104, 105]).buffer);
    expect(output).toEqual([[104, 105]]);
  });

  it("Exit and restart: the exit message calls onExit once with the session and code", async () => {
    const { backend, sockets } = setup();
    const exits: [number, number][] = [];
    await backend.onExit((id, code) => exits.push([id, code]));
    const id = await backend.spawn(24, 80, undefined, () => undefined);
    sockets[0].receive(JSON.stringify({ type: "exit", code: 3 }));
    sockets[0].onclose?.({} as CloseEvent);
    expect(exits).toEqual([[id, 3]]);
    await expect(backend.write(id, "x")).rejects.toThrow();
  });

  it("Wrong token: a connection closed before it opens fails the spawn", async () => {
    const backend = wsBackend({
      openSocket: (url) => {
        const socket = new FakeSocket(url);
        queueMicrotask(() => socket.onclose?.({} as CloseEvent));
        return socket;
      },
      page: { protocol: "http:", host: "localhost" },
      token: "wrong",
      clipboard: { readText: async () => "", writeText: async () => undefined },
    });
    await expect(backend.spawn(24, 80, undefined, () => undefined)).rejects.toThrow();
  });

  it.each([
    ['{"type":"exit","code":0}', { type: "exit", code: 0 }],
    ['{"type":"exit"}', null],
    ['{"type":"other","code":1}', null],
    ["not json", null],
    ["null", null],
  ])("decodes %s", (text, expected) => {
    expect(decodeServer(text)).toEqual(expected);
  });
});
