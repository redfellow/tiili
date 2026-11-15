// @harvaaja-test-tier: fast
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/** The flags each subcommand takes, from the USAGE text in control.rs: `tiili open [--cwd DIR] …` gives open → --cwd. */
function usageFlags(): Map<string, Set<string>> {
  const usage = /pub const USAGE: &str =\s*"((?:[^"\\]|\\.)*)"/.exec(read("src-tauri/src/control.rs"))?.[1];
  if (!usage) throw new Error("no USAGE in control.rs");
  const flags = new Map<string, Set<string>>();
  for (const [, command, rest] of usage.matchAll(/tiili (\w+)([^\\]*)/g)) {
    flags.set(command, new Set(rest.split(" -- ")[0].match(/--[a-z][a-z-]*/g) ?? []));
  }
  return flags;
}

/** The `tiili open` and `tiili list` examples of a doc, with the flags each passes to tiili (those before `--`). */
function examples(text: string): { example: string; command: string; flags: string[] }[] {
  return [...text.matchAll(/tiili (open|list)\b([^`\n]*)/g)].map(([example, command, rest]) => ({
    example,
    command,
    flags: rest.split(" -- ")[0].match(/--[a-z][a-z-]*/g) ?? [],
  }));
}

const DOCS = [
  "integrations/claude/skills/tiili-tiles/SKILL.md",
  "openspec/specs/agent-skills/spec.md",
  "openspec/specs/pane-control/spec.md",
];

describe("tiili CLI examples", () => {
  const usage = usageFlags();

  it("reads open and list from the usage text", () => {
    expect([...usage.keys()].sort()).toEqual(["list", "open"]);
  });

  it.each(DOCS)("A documented flag the CLI lacks: every flag in %s's examples is in the usage text", (file) => {
    const found = examples(read(file));
    expect(found.length, `no tiili open or list example in ${file}`).toBeGreaterThan(0);
    const unknown = found.flatMap(({ example, command, flags }) =>
      flags.filter((flag) => !usage.get(command)?.has(flag)).map((flag) => `${flag} in "${example.trim()}"`),
    );
    expect(unknown).toEqual([]);
  });
});
