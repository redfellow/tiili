// Renders the shortcut list in src/shortcuts.ts as the README's Markdown tables and the site's HTML table, and puts
// a rendering between the generated:shortcuts markers of a file. Pure helpers, for scripts/docs.mjs (which writes the
// files) and scripts/docs.test.ts (which fails when the committed tables are stale).

export const START_MARKER =
  "<!-- generated:shortcuts: `npm run docs` writes this from src/shortcuts.ts; after a merge conflict here, re-run it -->";
export const END_MARKER = "<!-- end generated:shortcuts -->";

/** The files with generated tables, from the repository root, and the format each takes. */
export const TARGETS = [
  ["README.md", "md"],
  ["site/index.html", "html"],
];

/** The groups in list order, each with its shortcuts that have a chord on some platform. */
function grouped(list) {
  const groups = new Map();
  for (const shortcut of list) {
    if (!shortcut.mac && !shortcut.other) continue;
    if (!groups.has(shortcut.group)) groups.set(shortcut.group, []);
    groups.get(shortcut.group).push(shortcut);
  }
  return [...groups];
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A platform's keys: braces mark key caps, shown as plain text in Markdown and as `<kbd>` in HTML. */
function keysText(keys, format) {
  if (!keys) return "—";
  if (format === "md") return keys.keys.replace(/[{}]/g, "");
  return escapeHtml(keys.keys).replace(/\{([^}]*)\}/g, "<kbd>$1</kbd>");
}

/**
 * The shortcut tables for `format`: "md" gives a `###` heading and table per group, "html" one `<tbody>` per group
 * with a heading row, for the site's `table.keys`.
 */
export function renderShortcuts(list, format) {
  const groups = grouped(list);
  if (format === "md") {
    const tables = groups.map(([group, shortcuts]) =>
      [
        `### ${group}`,
        "",
        "| Action | macOS | Windows and Linux |",
        "| --- | --- | --- |",
        ...shortcuts.map((s) => `| ${s.label} | ${keysText(s.mac, "md")} | ${keysText(s.other, "md")} |`),
      ].join("\n"),
    );
    return `\n${tables.join("\n\n")}\n`;
  }
  if (format === "html") {
    return groups
      .map(([group, shortcuts]) =>
        [
          "        <tbody>",
          `          <tr><th scope="rowgroup" colspan="3">${escapeHtml(group)}</th></tr>`,
          ...shortcuts.map(
            (s) =>
              `          <tr><td>${escapeHtml(s.label)}</td><td>${keysText(s.mac, "html")}</td><td>${keysText(s.other, "html")}</td></tr>`,
          ),
          "        </tbody>",
        ].join("\n"),
      )
      .join("\n");
  }
  throw new Error(`unknown format "${format}": give "md" or "html".`);
}

/**
 * `text` with `rendered` between its start and end markers, each kept on its own line with its indentation. Throws
 * when the markers are missing.
 */
export function fillShortcuts(text, rendered) {
  const start = text.indexOf(START_MARKER);
  const end = text.indexOf(END_MARKER, start);
  if (start < 0 || end < 0) throw new Error(`no ${START_MARKER} … ${END_MARKER} markers`);
  const lineStart = text.lastIndexOf("\n", end) + 1;
  const indent = text.slice(lineStart, end);
  return `${text.slice(0, start + START_MARKER.length)}\n${rendered}\n${indent}${text.slice(end)}`;
}
