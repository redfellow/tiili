// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import {
  AttentionGate,
  type AttentionSignal,
  type GateResult,
  parseOsc9,
  parseOsc99,
  parseOsc777,
  sanitizeMessage,
} from "./attention";

describe("attention signals", () => {
  const parsed: [string, string | undefined, string | undefined][] = [
    ["OSC 9 message: the text is the message", parseOsc9("Build done"), "Build done"],
    ["ConEmu progress ignored: 9;4;1;50 is no message", parseOsc9("4;1;50"), undefined],
    ["ConEmu progress ignored: a bare number is no message", parseOsc9("9"), undefined],
    ["OSC 777 notify: title and body", parseOsc777("notify;Claude;Needs input"), "Claude: Needs input"],
    ["OSC 777 notify: body keeps its semicolons", parseOsc777("notify;T;a;b"), "T: a;b"],
    ["OSC 777 other than notify: ignored", parseOsc777("preexec"), undefined],
    ["OSC 99 plain: payload is the message", parseOsc99(";Hello"), "Hello"],
    ["OSC 99 base64: decoded", parseOsc99("e=1;SGVsbG8="), "Hello"],
    ["OSC 99 unfinished chunk: ignored", parseOsc99("i=1:d=0;Hel"), undefined],
    ["OSC 99 query: ignored", parseOsc99("i=1:p=?;"), undefined],
  ];
  it.each(parsed)("%s", (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });

  const sanitized: [string, string, string | undefined][] = [
    ["Message safety: control characters are removed", "\u001b[31mred\u0007\u009b", "[31mred"],
    ["Message safety: a report over 4096 bytes is ignored", "x".repeat(4097), undefined],
    ["Message safety: 4096 bytes are kept", "x".repeat(4096), "x".repeat(4096)],
  ];
  it.each(sanitized)("%s", (_name, input, expected) => {
    expect(sanitizeMessage(input)).toBe(expected);
  });
});

describe("AttentionGate", () => {
  const bell: AttentionSignal = { kind: "bell" };
  const message: AttentionSignal = { kind: "message", text: "Done" };
  const cases: [string, [AttentionSignal, number][], GateResult[]][] = [
    ["OSC 9 message: marks with the message", [[message, 0]], [{ action: "mark", message: "Done" }]],
    [
      "Bell then OSC 9 within 100 ms: one signal that keeps the message",
      [
        [bell, 0],
        [message, 50],
      ],
      [{ action: "mark" }, { action: "message", message: "Done" }],
    ],
    [
      "OSC 9 then bell within 100 ms: one signal",
      [
        [message, 0],
        [bell, 50],
      ],
      [{ action: "mark", message: "Done" }, undefined],
    ],
    [
      "Rate limit: a second signal within 2 s is dropped, after 2 s fires",
      [
        [bell, 0],
        [message, 500],
        [bell, 2000],
      ],
      [{ action: "mark" }, undefined, { action: "mark" }],
    ],
  ];
  it.each(cases)("%s", (_name, signals, expected) => {
    const gate = new AttentionGate();
    expect(signals.map(([signal, at]) => gate.signal(signal, at))).toEqual(expected);
  });

  it("Hostile file: a thousand bells mark once", () => {
    const gate = new AttentionGate();
    const fired = Array.from({ length: 1000 }, (_, i) => gate.signal(bell, i)).filter(Boolean);
    expect(fired).toHaveLength(1);
  });
});
