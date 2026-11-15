// Writes the shortcut tables into README.md and site/index.html from the list in src/shortcuts.ts:
//
//   npm run docs
//
// Each file holds its table between generated:shortcuts markers; scripts/docs.test.ts fails when one is stale. Node
// loads the TypeScript list directly (type stripping, Node 22.6 and later).
import { readFileSync, writeFileSync } from "node:fs";
import { SHORTCUTS } from "../src/shortcuts.ts";
import { fillShortcuts, renderShortcuts, TARGETS } from "./docs-render.mjs";

for (const [file, format] of TARGETS) {
  const url = new URL(`../${file}`, import.meta.url);
  const text = readFileSync(url, "utf8");
  const next = fillShortcuts(text, renderShortcuts(SHORTCUTS, format));
  if (next === text) {
    console.log(`docs: ${file} is up to date`);
  } else {
    writeFileSync(url, next);
    console.log(`docs: wrote ${file}`);
  }
}
