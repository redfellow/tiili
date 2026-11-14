import { WebLinksAddon } from "@xterm/addon-web-links";
import type { IBufferRange, IDisposable, ILink, Terminal } from "@xterm/xterm";
import type { Backend, SessionId } from "./backend";
import type { Platform } from "./keymap";
import {
  findPathCandidates,
  hintText,
  isOpenGesture,
  neverOpens,
  opensDirectly,
  schemeOf,
  type HoveredLink,
  type ResolvedPath,
} from "./links";

/** The hovered line's paths are checked once the pointer rests this long, so passing over lines checks nothing. */
const RESOLVE_DEBOUNCE_MS = 120;
/** Roughly how wide a character of the hint is, to fit an OSC 8 target in the pane. */
const HINT_CHAR_PX = 7;

/** One terminal pane's links: what is hovered, opening it, and forgetting resolved paths when the folder changes. */
export interface PaneLinks {
  /** The link under the pointer, if any. */
  hovered(): HoveredLink | undefined;
  /** Opens `link`: a URL after the scheme rules (asking first where they say so), a path in its app or revealed. */
  open(link: HoveredLink): void;
  /** The pane's shell is now in `place` (its folder and host); paths resolved for another place are forgotten. */
  placeChanged(place: string): void;
  dispose(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

/**
 * Asks whether to open `uri`, whose scheme tiili doesn't open on its own, in a dialog showing its scheme and the
 * full URI. Resolves to true only when the user chose Open.
 */
export function confirmOpenLink(uri: string): Promise<boolean> {
  return new Promise((resolve) => {
    const title = element("h2", { id: "link-dialog-title" }, "Open this link?");
    const scheme = element("p", { className: "link-dialog-scheme" }, `It opens with the app for “${schemeOf(uri)}:” links.`);
    const target = element("pre", { className: "link-dialog-uri", tabIndex: 0 }, uri);
    const cancel = element("button", { type: "button" }, "Cancel");
    const open = element("button", { type: "button", className: "settings-save" }, "Open");
    const dialog = element("dialog", { className: "settings link-dialog" },
      element("form", { method: "dialog" },
        element("header", { className: "settings-header" }, title),
        scheme,
        target,
        element("footer", { className: "settings-footer" }, element("div", { className: "settings-actions" }, cancel, open))));
    dialog.setAttribute("aria-labelledby", title.id);

    let chosen = false;
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dialog.close();
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(chosen);
    });
    cancel.addEventListener("click", () => dialog.close());
    open.addEventListener("click", () => {
      chosen = true;
      dialog.close();
    });
    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}

/** Buffer line `y` (1-based) as text, with the 0-based cell each character sits in. */
function lineCells(term: Terminal, y: number): { text: string; cells: number[] } | undefined {
  const line = term.buffer.active.getLine(y - 1);
  if (!line) return undefined;
  let text = "";
  const cells: number[] = [];
  for (let x = 0; x < line.length; x++) {
    const cell = line.getCell(x);
    if (!cell || cell.getWidth() === 0) continue;
    const chars = cell.getChars() || " ";
    for (let i = 0; i < chars.length; i++) cells.push(x);
    text += chars;
  }
  return { text, cells };
}

/** The text printed in `range`, as one string. */
function rangeText(term: Terminal, range: IBufferRange): string {
  let text = "";
  for (let y = range.start.y; y <= range.end.y; y++) {
    const line = term.buffer.active.getLine(y - 1);
    if (!line) break;
    const from = y === range.start.y ? range.start.x - 1 : 0;
    const to = y === range.end.y ? range.end.x : undefined;
    text += line.translateToString(true, from, to);
  }
  return text;
}

/**
 * Makes `term`'s links clickable: plain URLs, OSC 8 hyperlinks (replacing xterm's handler, which would open them in
 * the webview) and existing paths on the hovered line, resolved by the core in session `session()`'s folder. Hovering
 * underlines a link and shows a hint in `container`; ⌘-click (macOS) or Ctrl-click opens it, even while the running
 * program reports the mouse. Failures go to `report`.
 */
export function attachLinks(
  term: Terminal,
  container: HTMLElement,
  backend: Backend,
  platform: Platform,
  session: () => SessionId | undefined,
  report: (error: unknown) => void,
): PaneLinks {
  const hint = element("div", { className: "terminal-link-hint", hidden: true });
  hint.setAttribute("role", "status");
  container.append(hint);

  // Each hover gets a token, so a late leave from one link doesn't clear the next.
  let current: { link: HoveredLink; token: number } | undefined;
  let nextToken = 0;
  const show = (link: HoveredLink): number => {
    const token = ++nextToken;
    current = { link, token };
    const max = Math.max(16, Math.floor(container.clientWidth / HINT_CHAR_PX) - 24);
    hint.textContent = hintText(link, platform, max);
    hint.hidden = false;
    return token;
  };
  const hide = (token: number | undefined) => {
    if (token === undefined || current?.token !== token) return;
    current = undefined;
    hint.hidden = true;
  };

  const open = (link: HoveredLink) => {
    (async () => {
      if (link.kind === "path") {
        if (link.revealOnly) await backend.revealPath(link.abs);
        else await backend.openPath(link.abs);
        return;
      }
      if (neverOpens(link.uri)) return;
      if (opensDirectly(link.uri)) await backend.openLink(link.uri, false);
      else if (await confirmOpenLink(link.uri)) await backend.openLink(link.uri, true);
    })().catch(report);
  };
  const activate = (event: MouseEvent, link: HoveredLink) => {
    if (isOpenGesture(event, platform)) open(link);
  };

  // Plain URLs.
  let urlToken: number | undefined;
  const web = new WebLinksAddon((event, uri) => activate(event, { kind: "url", uri }), {
    hover: (_event, uri) => {
      urlToken = show({ kind: "url", uri });
    },
    leave: () => hide(urlToken),
  });
  term.loadAddon(web);

  // OSC 8 hyperlinks: the hint shows the real target when the printed text differs.
  let oscToken: number | undefined;
  const oscLink = (uri: string, range: IBufferRange): HoveredLink => {
    const label = rangeText(term, range).trim();
    return label !== uri ? { kind: "url", uri, label } : { kind: "url", uri };
  };
  term.options.linkHandler = {
    activate: (event, uri, range) => activate(event, oscLink(uri, range)),
    hover: (_event, uri, range) => {
      oscToken = show(oscLink(uri, range));
    },
    leave: () => hide(oscToken),
    // Every scheme reaches `activate`, which applies tiili's own rules.
    allowNonHttpProtocols: true,
  };

  // Existing paths on the hovered line, resolved once the pointer rests, cached until the folder changes.
  let place = "";
  let cache = new Map<string, ResolvedPath | null>();
  let pending: { timer: ReturnType<typeof setTimeout>; done: () => void } | undefined;
  const resolve = async (paths: string[]): Promise<Map<string, ResolvedPath | null>> => {
    const id = session();
    const asked = cache;
    const missing = [...new Set(paths.filter((path) => !asked.has(path)))];
    if (id !== undefined && missing.length > 0) {
      const found = await backend.resolvePaths(id, missing);
      missing.forEach((path, i) => asked.set(path, found[i] ?? null));
    }
    return asked;
  };
  const provider: IDisposable = term.registerLinkProvider({
    provideLinks: (y, callback) => {
      pending?.done();
      const line = lineCells(term, y);
      const candidates = line ? findPathCandidates(line.text) : [];
      if (!line || candidates.length === 0 || session() === undefined) {
        callback(undefined);
        return;
      }
      let settled = false;
      const done = (links: ILink[] | undefined) => {
        if (settled) return;
        settled = true;
        callback(links);
      };
      const run = async () => {
        const known = await resolve(candidates.map((c) => c.path));
        const links = candidates.flatMap((candidate): ILink[] => {
          const found = known.get(candidate.path);
          if (!found) return [];
          const link: HoveredLink = { kind: "path", ...found, line: candidate.line };
          let token: number | undefined;
          return [
            {
              range: {
                start: { x: line.cells[candidate.start] + 1, y },
                end: { x: line.cells[candidate.end - 1] + 1, y },
              },
              text: candidate.text,
              activate: (event) => activate(event, link),
              hover: () => {
                token = show(link);
              },
              leave: () => hide(token),
            },
          ];
        });
        done(links.length > 0 ? links : undefined);
      };
      const timer = setTimeout(() => {
        pending = undefined;
        run().catch((error: unknown) => {
          done(undefined);
          console.error(error);
        });
      }, RESOLVE_DEBOUNCE_MS);
      pending = { timer, done: () => (clearTimeout(timer), done(undefined)) };
    },
  });

  // A modifier-click on a hovered link opens it even when the program reports the mouse; the click never reaches the
  // program or xterm, so xterm doesn't open the link a second time.
  let swallowUp = false;
  const onDown = (event: MouseEvent) => {
    if (!current || !isOpenGesture(event, platform)) return;
    event.preventDefault();
    event.stopPropagation();
    swallowUp = true;
    open(current.link);
  };
  const onUp = (event: MouseEvent) => {
    if (!swallowUp) return;
    swallowUp = false;
    event.preventDefault();
    event.stopPropagation();
  };
  container.addEventListener("mousedown", onDown, true);
  container.addEventListener("mouseup", onUp, true);

  return {
    hovered: () => current?.link,
    open,
    placeChanged: (next) => {
      if (next === place) return;
      place = next;
      cache = new Map();
    },
    dispose: () => {
      pending?.done();
      container.removeEventListener("mousedown", onDown, true);
      container.removeEventListener("mouseup", onUp, true);
      provider.dispose();
      web.dispose();
      term.options.linkHandler = null;
      hint.remove();
    },
  };
}
