// Builds Heynote's web app for tiili's Heynote pane into public/heynote/.
//
//   npm run heynote                      clones Heynote at HEYNOTE_COMMIT into a temporary folder and builds it
//   HEYNOTE_SRC=~/src/heynote npm run heynote   builds an existing checkout instead (left as it was afterwards)
//
// The build swaps Heynote's webapp/bridge.js for tiili's heynote/bridge.js (notes in tiili's files, not
// localStorage) and makes the page start Heynote only after the bridge has loaded the library. The output is
// committed, so tiili's own build and checks need neither the network nor Heynote's dependencies.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The Heynote commit public/heynote/ is built from. */
const HEYNOTE_COMMIT = "c301e42f9d432d1449212d36324f5028ca18880c";
const HEYNOTE_REPO = "https://github.com/heyman/heynote.git";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "heynote");

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit" });

let src = process.env.HEYNOTE_SRC ? resolve(process.env.HEYNOTE_SRC) : undefined;
let temp;
if (!src) {
  temp = mkdtempSync(join(tmpdir(), "tiili-heynote-"));
  src = join(temp, "heynote");
  run("git", ["clone", "--quiet", "--filter=blob:none", HEYNOTE_REPO, src]);
  run("git", ["checkout", "--quiet", HEYNOTE_COMMIT], src);
}

/** Bundled files that come from Heynote's own repository rather than an npm package, with their licences. */
const HEYNOTE_ASSETS = [
  ["Hack font", "https://github.com/source-foundry/Hack", "MIT and Bitstream Vera License"],
  ["Open Sans font", "https://github.com/googlefonts/opensans", "Apache-2.0"],
  ["math.js (math.js)", "https://github.com/josdejong/mathjs", "Apache-2.0"],
  ["guesslang-js (guesslang.min.js)", "https://github.com/ray-lothian/guesslang-js", "MIT"],
];

/**
 * A Vite config for the build: Heynote's own, plus a plugin that writes every npm package the bundle takes code
 * from, with its version and licence, to `packages.json` next to the config.
 */
const LICENSE_CONFIG = `import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import base from "./vite.config.js";

/** The licence a package without a "license" field names in its LICENSE file. */
function fromFile(dir) {
  const file = readdirSync(dir).find((name) => /^licen[cs]e/i.test(name));
  const text = file ? readFileSync(dir + "/" + file, "utf8").slice(0, 300) : "";
  if (/Apache License/.test(text)) return "Apache-2.0";
  if (/MIT License|Permission is hereby granted/.test(text)) return "MIT";
  return file ? "see " + file : "unknown";
}

function packagesUsed() {
  return {
    name: "tiili-packages-used",
    generateBundle() {
      const found = new Map();
      for (const id of this.getModuleIds()) {
        const match = /^(.*\\/node_modules\\/(?:@[^/]+\\/)?[^/]+)\\//.exec(id.replace(/\\\\/g, "/"));
        if (!match || found.has(match[1])) continue;
        try {
          const pkg = JSON.parse(readFileSync(match[1] + "/package.json", "utf8"));
          const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
          found.set(match[1], { name: pkg.name, version: pkg.version, license: pkg.license ?? fromFile(match[1]), repo });
        } catch {}
      }
      writeFileSync(new URL("./packages.json", import.meta.url), JSON.stringify([...found.values()], null, 2));
    },
  };
}

export default { ...base, plugins: [...(base.plugins ?? []), packagesUsed()] };
`;

const bridge = join(src, "webapp", "bridge.js");
const index = join(src, "webapp", "index.html");
const original = { bridge: readFileSync(bridge), index: readFileSync(index, "utf8") };

try {
  if (!existsSync(join(src, "node_modules"))) {
    // Install scripts are skipped: the web build needs no Electron binary.
    run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], src);
  }
  copyFileSync(join(root, "heynote", "bridge.js"), bridge);
  const startup =
    '<script type="module">\n' +
    '      import { Heynote, ipcRenderer } from "./bridge.js";\n' +
    "      window.ipcRenderer = ipcRenderer;\n" +
    "      window.heynote = Heynote;\n" +
    "      // The bridge loads the notes before it resolves, so Heynote starts with its library in place.\n" +
    '      await import("./main.js");\n' +
    "    </script>";
  const patched = original.index.replace(
    /<script type="module">[\s\S]*?<\/script>\s*<script type="module" src="main.js"><\/script>/,
    startup,
  );
  if (patched === original.index) throw new Error("Heynote's webapp/index.html changed: update scripts/heynote.mjs");
  writeFileSync(index, patched);

  writeFileSync(join(src, "webapp", "vite.tiili.config.js"), LICENSE_CONFIG);
  run("npx", ["vite", "build", "webapp", "--config", "webapp/vite.tiili.config.js", "--base", "./", "--target", "es2022", "--outDir", out, "--emptyOutDir", "--logLevel", "warn"], src);
  copyFileSync(join(src, "LICENSE"), join(out, "LICENSE"));
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: src, encoding: "utf8" }).trim();
  writeFileSync(
    join(out, "README.md"),
    "# Heynote, built for tiili\n\n" +
      `Built by \`npm run heynote\` from [Heynote](https://github.com/heyman/heynote) commit \`${commit}\`, with ` +
      "tiili's `heynote/bridge.js` in place of Heynote's web bridge. Do not edit these files by hand.\n\n" +
      "Heynote is Copyright (c) Jonatan Heyman, MIT License with the Commons Clause License Condition v1.0: " +
      "see LICENSE in this folder.\n",
  );
  writeThirdParty(JSON.parse(readFileSync(join(src, "webapp", "packages.json"), "utf8")), commit);
  console.log(`Heynote ${commit.slice(0, 7)} built into ${out}`);
} finally {
  writeFileSync(bridge, original.bridge);
  writeFileSync(index, original.index);
  rmSync(join(src, "webapp", "vite.tiili.config.js"), { force: true });
  rmSync(join(src, "webapp", "packages.json"), { force: true });
  if (temp) rmSync(temp, { recursive: true, force: true });
}

/** Writes public/heynote/THIRD_PARTY.md: the npm packages in the bundle and Heynote's own bundled assets. */
function writeThirdParty(packages, commit) {
  const cell = (text) => String(text ?? "").replace(/\|/g, "\\|");
  const link = (repo) => {
    const url = String(repo ?? "").replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
    return url.startsWith("http") ? url : url.startsWith("github:") ? `https://github.com/${url.slice(7)}` : "";
  };
  const rows = packages
    .filter((pkg) => pkg.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((pkg) => `| ${cell(pkg.name)} | ${cell(pkg.version)} | ${cell(pkg.license)} | ${link(pkg.repo)} |`);
  const assets = HEYNOTE_ASSETS.map(([name, url, license]) => `| ${name} | ${url} | ${license} |`);
  writeFileSync(
    join(out, "THIRD_PARTY.md"),
    "# Third-party code in the Heynote build\n\n" +
      `Generated by \`npm run heynote\` from Heynote commit \`${commit}\`. Heynote itself is MIT with the Commons ` +
      "Clause: see LICENSE. Each package below keeps its own licence; its full text ships in the package's " +
      "source repository.\n\n" +
      "## Bundled with Heynote's source\n\n| Asset | Source | Licence |\n| --- | --- | --- |\n" +
      assets.join("\n") +
      "\n\n## npm packages in the bundle\n\n| Package | Version | Licence | Source |\n| --- | --- | --- | --- |\n" +
      rows.join("\n") +
      "\n",
  );
}
