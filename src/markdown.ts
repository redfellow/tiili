/**
 * A small Markdown parser for release notes: headings, paragraphs, `-`/`*`/`1.` lists, and inline bold, italic,
 * code and links. It is pure and returns plain data; the update dialog builds DOM nodes from it with `textContent`
 * only, never HTML. Anything else (nested lists, tables, images, blockquotes, fenced code) comes out as paragraph text.
 */

/** A piece of a line: plain text, bold, italic, inline code, or a link whose `href` is always an `https:` URL. */
export type Inline =
  | { kind: "text" | "strong" | "em" | "code"; text: string }
  | { kind: "link"; text: string; href: string };

/** A block of the notes. Every heading level is one kind of heading. */
export type Block =
  | { kind: "heading"; inlines: Inline[] }
  | { kind: "paragraph"; inlines: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] };

/**
 * The notes without what the dialog leaves out: `<details>` blocks, the `**Full changelog` line and HTML tags. Tag
 * removal repeats until the text stops changing (one pass can leave a new tag behind, as in `<scr<b>ipt>`), then
 * any leftover `<` or `>` is dropped.
 */
function clean(body: string): string {
  let text = body
    .replace(/<details[\s\S]*?<\/details\s*>/gi, "")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("**Full changelog"))
    .join("\n");
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = text.replace(/<[^>]*>/g, "");
  }
  return text.replace(/[<>]/g, "");
}

// Inline code, bold, italic, or a link whose URL may hold one level of brackets, as in `javascript:alert(1)`.
const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;

/** The inline runs of one line of text. A link keeps its URL only when it starts with `https://`. */
export function parseInline(line: string): Inline[] {
  const runs: Inline[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = runs.at(-1);
    if (last?.kind === "text") last.text += text;
    else runs.push({ kind: "text", text });
  };
  let at = 0;
  for (const match of line.matchAll(INLINE)) {
    pushText(line.slice(at, match.index));
    at = match.index + match[0].length;
    const [, code, strong, em, linkText, href] = match;
    if (code !== undefined) runs.push({ kind: "code", text: code });
    else if (strong !== undefined) runs.push({ kind: "strong", text: strong });
    else if (em !== undefined) runs.push({ kind: "em", text: em });
    else if (href.startsWith("https://")) runs.push({ kind: "link", text: linkText, href });
    else pushText(linkText);
  }
  pushText(line.slice(at));
  return runs;
}

const HEADING = /^#{1,6}\s+(.*?)\s*#*$/;
const UNORDERED = /^[-*+]\s+(.*)$/;
const ORDERED = /^\d+[.)]\s+(.*)$/;
const FENCE = /^(```|~~~)/;

/** The release body as Markdown blocks, without `<details>` blocks, the Full changelog line and HTML tags. */
export function parseMarkdown(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | undefined;

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", inlines: parseInline(paragraph.join(" ")) });
    if (list) blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    paragraph = [];
    list = undefined;
  };

  for (const raw of clean(body).split("\n")) {
    const line = raw.trim();
    if (!line || FENCE.test(line)) {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      if (heading[1]) blocks.push({ kind: "heading", inlines: parseInline(heading[1]) });
      continue;
    }
    const unordered = UNORDERED.exec(line);
    const ordered = unordered ? null : ORDERED.exec(line);
    const item = unordered ?? ordered;
    if (item) {
      const isOrdered = ordered !== null;
      if (paragraph.length || (list && list.ordered !== isOrdered)) flush();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push(item[1]);
      continue;
    }
    // A line that follows a list item without a blank line continues that item.
    if (list) list.items[list.items.length - 1] += ` ${line}`;
    else paragraph.push(line);
  }
  flush();
  return blocks;
}
