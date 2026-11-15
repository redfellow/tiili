// @harvaaja-test-tier: fast
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/**
 * The flags each subcommand takes, from `tiili describe`'s golden output: open → --cwd, --title. The Rust test
 * `describe_matches_the_golden_file` keeps that file equal to the `COMMANDS` table in control.rs.
 */
function usageFlags(): Map<string, Set<string>> {
  const describe = JSON.parse(read("src-tauri/tests/fixtures/describe.json")) as {
    commands: { name: string; args: { kind: string; name: string }[] }[];
  };
  return new Map(
    describe.commands.map(({ name, args }) => [
      name,
      new Set(args.filter((arg) => arg.kind === "option").map((arg) => arg.name)),
    ]),
  );
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

  it("reads open and list from the command table", () => {
    expect([...usage.keys()]).toEqual(expect.arrayContaining(["list", "open"]));
    expect(usage.get("open")).toContain("--cwd");
  });

  it.each(DOCS)("A documented flag the CLI lacks: every flag in %s's examples is in the command table", (file) => {
    const found = examples(read(file));
    expect(found.length, `no tiili open or list example in ${file}`).toBeGreaterThan(0);
    const unknown = found.flatMap(({ example, command, flags }) =>
      flags.filter((flag) => !usage.get(command)?.has(flag)).map((flag) => `${flag} in "${example.trim()}"`),
    );
    expect(unknown).toEqual([]);
  });
});
