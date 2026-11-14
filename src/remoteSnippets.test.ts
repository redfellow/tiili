// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { REMOTE_SNIPPETS, type RemoteShell } from "./remoteSnippets";

/** How each shell runs the snippet at every prompt. */
const HOOKS: [RemoteShell, string][] = [
  ["bash", "PROMPT_COMMAND"],
  ["zsh", "add-zsh-hook precmd _tiili_report"],
  ["fish", "--on-event fish_prompt"],
];

describe("REMOTE_SNIPPETS", () => {
  it("lists bash, zsh and fish in that order", () => {
    expect(REMOTE_SNIPPETS.map((s) => s.shell)).toEqual(HOOKS.map(([shell]) => shell));
  });

  it.each(HOOKS)("Snippet reports a repository: the %s snippet sends OSC 7 and tiili_repo at every prompt", (shell, hook) => {
    const text = REMOTE_SNIPPETS.find((s) => s.shell === shell)?.text ?? "";
    expect(text).toContain("\\033]7;file://");
    expect(text).toContain("\\033]1337;SetUserVar=tiili_repo=");
    expect(text).toContain("git rev-parse --show-toplevel");
    expect(text).toContain("base64 | tr -d '\\n'");
    expect(text).toContain(hook);
  });
});
