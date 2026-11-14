// Prints the `latest.json` installed tiili apps read to find a new version, for the release workflow:
//
//   node scripts/updater-manifest.mjs <tag> <folder of .sig files> <notes file> > latest.json
//
// Each platform's updater bundle is found by its signature file's name; a missing one fails the run, so a release
// never tells an installed app about a bundle it can't download.
//
// The steps are pure helpers, exported for scripts/updater-manifest.test.ts; `main` runs them when this file is run.
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RELEASES = "https://github.com/redfellow/tiili/releases/download";

/** The updater bundle of each platform, by the end of its file name. */
export const PLATFORMS = {
  "darwin-aarch64": ".app.tar.gz",
  "windows-x86_64": "-setup.exe",
  "linux-x86_64": ".AppImage",
};

/**
 * The `latest.json` for release `tag` (`vX.Y.Z`) with `notes`, published at `pubDate` (an ISO time), from
 * `signatures`: each `.sig` file's name and its text. Throws when the tag is not a version or a platform has no
 * signature.
 */
export function buildManifest({ tag, notes, signatures, pubDate }) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`give the release tag, vX.Y.Z, not "${tag}".`);
  const platforms = {};
  for (const [platform, ending] of Object.entries(PLATFORMS)) {
    const name = Object.keys(signatures).find((file) => file.endsWith(`${ending}.sig`));
    if (!name) throw new Error(`no ${platform} signature (a *${ending}.sig file).`);
    const file = name.slice(0, -".sig".length);
    platforms[platform] = {
      signature: signatures[name].trim(),
      url: `${RELEASES}/${tag}/${encodeURIComponent(file)}`,
    };
  }
  return { version: tag.slice(1), notes: notes.trim(), pub_date: pubDate, platforms };
}

function main() {
  const [tag, folder, notesFile] = process.argv.slice(2);
  if (!tag || !folder || !notesFile) throw new Error("usage: updater-manifest.mjs <tag> <sig folder> <notes file>");
  const signatures = {};
  for (const name of readdirSync(folder).filter((file) => file.endsWith(".sig"))) {
    signatures[name] = readFileSync(join(folder, name), "utf8");
  }
  const notes = readFileSync(notesFile, "utf8");
  const manifest = buildManifest({ tag, notes, signatures, pubDate: new Date().toISOString() });
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    console.error(`updater-manifest: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
