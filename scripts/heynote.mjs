// Builds Heynote's web app for tiili's Heynote pane into public/heynote/.
//
//   npm run heynote                      clones Heynote at HEYNOTE_COMMIT into a temporary folder and builds it
//   HEYNOTE_SRC=~/src/heynote npm run heynote   builds an existing checkout instead (left as it was afterwards)
//
// The build swaps Heynote's webapp/bridge.js for tiili's heynote/bridge.js and adds its heynote/save-on-close.js
// (notes in tiili's files, not localStorage), makes the page start Heynote only after the bridge has loaded the library
// and gives the page tiili's light or dark ground before anything paints. Its fonts ship as .woff2 only. The output is
// committed, so tiili's own build and checks need neither the network nor Heynote's dependencies.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The Heynote commit public/heynote/ is built from. */
const HEYNOTE_COMMIT = "c301e42f9d432d1449212d36324f5028ca18880c";
const HEYNOTE_REPO = "https://github.com/heyman/heynote.git";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "heynote");

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit" });

/** A font URL's file name in `assets`, without its query or fragment. */
const fontFile = (url) => url.replace(/^\.\//, "").replace(/[?#].*$/, "");

/**
 * Leaves Heynote's fonts in `assets` as .woff2 only: each @font-face lists its .woff2 first, which WebKit, WebView2
 * and WebKitGTK all take, so the .woff copies after it are never loaded. Drops every `url(….woff) format("woff")`
 * source from the CSS and deletes the .woff files. Throws, leaving the files as they are, when Heynote's output no
 * longer has that shape: no .woff at all, a .woff source in a face without an existing .woff2 one, or a .woff that is
 * still referenced afterwards.
 */
function dropWoffFonts(assets) {
  const files = readdirSync(assets);
  const woffs = files.filter((f) => f.endsWith(".woff"));
  if (woffs.length === 0) throw new Error("Heynote's build has no .woff fonts any more: update scripts/heynote.mjs");
  const woffSource = /(,\s*)?url\(\s*["']?([^"')]+\.woff(?:[?#][^"')]*)?)["']?\s*\)\s*format\(\s*["']woff["']\s*\)(\s*,)?/g;
  const woff2Source = /url\(\s*["']?([^"')]+\.woff2(?:[?#][^"')]*)?)["']?\s*\)\s*format\(\s*["']woff2["']\s*\)/g;
  const removed = new Set();
  const css = new Map();
  for (const name of files.filter((f) => f.endsWith(".css"))) {
    const text = readFileSync(join(assets, name), "utf8");
    const stripped = text.replace(/@font-face\s*\{[^}]*\}/g, (face) => {
      const dropped = [];
      const kept = face.replace(woffSource, (_source, lead, url, trail) => {
        dropped.push(fontFile(url));
        return lead && trail ? "," : "";
      });
      if (dropped.length === 0) return face;
      const woff2 = [...kept.matchAll(woff2Source)].map((m) => fontFile(m[1]));
      if (woff2.length === 0 || !woff2.every((f) => files.includes(f))) {
        throw new Error(`Heynote's font ${dropped.join(", ")} has no .woff2 beside it in ${name}: update scripts/heynote.mjs`);
      }
      for (const f of dropped) removed.add(f);
      return kept;
    });
    css.set(name, stripped);
  }
  for (const [name, text] of css) {
    if (/format\(\s*["']woff["']\s*\)|\.woff[?#"')]/.test(text)) {
      throw new Error(`Heynote's ${name} still names a .woff font: update scripts/heynote.mjs`);
    }
  }
  const scripts = files.filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(assets, f), "utf8"));
  const loaded = woffs.filter((f) => scripts.some((text) => text.includes(f)));
  if (loaded.length > 0) throw new Error(`Heynote's scripts load ${loaded.join(", ")}: update scripts/heynote.mjs`);
  const unpaired = woffs.filter((f) => !removed.has(f));
  if (unpaired.length > 0) {
    throw new Error(`Heynote's ${unpaired.join(", ")} is not a .woff2 font's fallback: update scripts/heynote.mjs`);
  }
  for (const [name, text] of css) writeFileSync(join(assets, name), text);
  for (const f of woffs) rmSync(join(assets, f));
}

let src = process.env.HEYNOTE_SRC ? resolve(process.env.HEYNOTE_SRC) : undefined;
let temp;
if (!src) {
  temp = mkdtempSync(join(tmpdir(), "tiili-heynote-"));
  src = join(temp, "heynote");
  run("git", ["clone", "--quiet", "--filter=blob:none", HEYNOTE_REPO, src]);
  run("git", ["checkout", "--quiet", HEYNOTE_COMMIT], src);
}

const bridge = join(src, "webapp", "bridge.js");
// The bridge's own module, which Heynote has no file of its own for: added for the build and removed after.
const saveOnClose = join(src, "webapp", "save-on-close.js");
const index = join(src, "webapp", "index.html");
const original = { bridge: readFileSync(bridge), index: readFileSync(index, "utf8") };

try {
  if (!existsSync(join(src, "node_modules"))) {
    // Install scripts are skipped: the web build needs no Electron binary.
    run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], src);
  }
  copyFileSync(join(root, "heynote", "bridge.js"), bridge);
  copyFileSync(join(root, "heynote", "save-on-close.js"), saveOnClose);
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
  // Heynote's page starts in the ground of the mode it opens in (window.parent.tiiliTheme's startKind: the theme
  // chosen inside Heynote, else tiili's light or dark) before any script runs, so it never paints a wrong ground
  // first. The colours are Heynote's editor grounds, as in src/heynotePane.ts.
  const ground =
    "  <script>\n" +
    "      try {\n" +
    '        const kind = parent !== window && parent.tiiliTheme ? parent.tiiliTheme.startKind() : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");\n' +
    '        document.documentElement.dataset.tiiliGround = kind;\n' +
    "      } catch {}\n" +
    "    </script>\n" +
    "    <style>\n" +
    "      html { background: #ffffff; color-scheme: light; }\n" +
    '      html[data-tiili-ground="dark"] { background: #252B37; color-scheme: dark; }\n' +
    "      @media (prefers-color-scheme: dark) { html:not([data-tiili-ground]) { background: #252B37; color-scheme: dark; } }\n" +
    "    </style>\n" +
    "  </head>";
  const grounded = patched.replace("</head>", ground);
  if (grounded === patched) throw new Error("Heynote's webapp/index.html has no </head>: update scripts/heynote.mjs");
  writeFileSync(index, grounded);

  run("npx", ["vite", "build", "webapp", "--base", "./", "--target", "es2022", "--outDir", out, "--emptyOutDir", "--logLevel", "warn"], src);
  dropWoffFonts(join(out, "assets"));
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
  console.log(`Heynote ${commit.slice(0, 7)} built into ${out}`);
} finally {
  writeFileSync(bridge, original.bridge);
  rmSync(saveOnClose, { force: true });
  writeFileSync(index, original.index);
  if (temp) rmSync(temp, { recursive: true, force: true });
}
