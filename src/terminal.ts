import { FitAddon } from "@xterm/addon-fit";
import { LigaturesAddon } from "@xterm/addon-ligatures";
import { SerializeAddon } from "@xterm/addon-serialize";
import { Terminal, type FontWeight } from "@xterm/xterm";
import type { Backend, SessionId } from "./backend";
import { sizeReporter } from "./resize";
import { responsiveFont, zoomedSize } from "./responsive";
import { fontFamilyList, type FontSettings, type Settings } from "./settings";
import { documentTokens, followSystemTheme, terminalTheme } from "./theme";

/** Resizing settles this long before a pane re-fits and tells its shell the new size. */
const RESIZE_SETTLE_MS = 50;

/** One pane's terminal and the shell session behind it. */
export interface PaneTerminal {
  term: Terminal;
  /** The working directory of the pane's shell, when it runs and the platform can read it. */
  cwd(): Promise<string | undefined>;
  /**
   * Holds the terminal at its size while its pane is being resized by hand: it neither refits nor tells
   * its shell. `releaseSize(true)` refits once and sends the new size; `releaseSize(false)` just lets go.
   */
  holdSize(): void;
  releaseSize(refit: boolean): void;
  /** The size of one character cell in CSS pixels, once the terminal has been laid out. */
  cellSize(): { width: number; height: number } | undefined;
  /** The terminal's scrollback and screen as text with escape codes, once everything written to it has landed. */
  serialize(): Promise<string>;
  /** The shell session the terminal shows, while it runs. */
  session(): SessionId | undefined;
  /** Frees the terminal but leaves its shell running, for a pane that moved to another window. */
  detach(): void;
  /** Ends the shell and frees the terminal. */
  dispose(): Promise<void>;
}

/** A running shell session a terminal takes over from another window, with the scrollback it showed there. */
export interface AdoptedSession {
  session: SessionId;
  scrollback: string;
}

/** The addons `applyFont` changes or refits with, per terminal. */
const addons = new WeakMap<Terminal, { fit: FitAddon; ligatures?: LigaturesAddon }>();

/** Resolves once everything written to `term` so far has been parsed. */
function written(term: Terminal, data: string | Uint8Array = ""): Promise<void> {
  return new Promise((resolve) => term.write(data, resolve));
}

/** Counts `applyFont` calls per terminal, so a call whose font loaded late doesn't undo a newer one. */
const fontGenerations = new WeakMap<Terminal, number>();

/** Waits until the font's regular and bold faces are loaded, since xterm measures the font when it changes. */
async function loadFont(font: FontSettings): Promise<void> {
  const family = fontFamilyList(font.family);
  await Promise.all([
    document.fonts.load(`${font.weight} ${font.size}px ${family}`),
    document.fonts.load(`${font.weightBold} ${font.size}px ${family}`),
  ]).catch(() => undefined);
}

/**
 * Sets `term`'s font size, line height and letter spacing: the chosen ones, the size changed by the pane's zoom
 * offset `zoom`, then scaled down for a small pane when responsive text is on. The pane is measured against the
 * tiled area, so a pane that fills it keeps the (zoomed) chosen size.
 */
function applySize(term: Terminal, settings: Settings, zoom: number): void {
  const { responsive } = settings;
  const font = { ...settings.font, size: zoomedSize(settings.font.size, zoom) };
  const pane = term.element?.closest<HTMLElement>(".pane");
  const area = pane?.parentElement?.closest<HTMLElement>("#panes");
  const fitted =
    pane && area
      ? responsiveFont(font, responsive, pane.getBoundingClientRect(), area.getBoundingClientRect())
      : { size: font.size, lineHeight: font.lineHeight, letterSpacing: font.letterSpacing };
  if (term.options.fontSize !== fitted.size) term.options.fontSize = fitted.size;
  if (term.options.lineHeight !== fitted.lineHeight) term.options.lineHeight = fitted.lineHeight;
  if (term.options.letterSpacing !== fitted.letterSpacing) term.options.letterSpacing = fitted.letterSpacing;
}

/**
 * Applies the font settings to `term`: family with Geist Mono as fallback, size changed by the pane's zoom offset
 * `zoom`, weights, line height, letter spacing and the ligatures addon on or off, then refits so the shell gets
 * the new size.
 */
export async function applyFont(term: Terminal, settings: Settings, zoom = 0): Promise<void> {
  const { font } = settings;
  const generation = (fontGenerations.get(term) ?? 0) + 1;
  fontGenerations.set(term, generation);
  await loadFont(font);
  // A newer call started while this font loaded; its settings win.
  if (fontGenerations.get(term) !== generation) return;
  term.options.fontFamily = fontFamilyList(font.family);
  term.options.fontWeight = String(font.weight) as FontWeight;
  term.options.fontWeightBold = String(font.weightBold) as FontWeight;
  applySize(term, settings, zoom);
  term.options.cursorStyle = settings.cursor.style;
  term.options.cursorBlink = settings.cursor.blink;

  const own = addons.get(term);
  if (!own) return;
  if (font.ligatures && !own.ligatures) {
    own.ligatures = new LigaturesAddon();
    term.loadAddon(own.ligatures);
  } else if (!font.ligatures && own.ligatures) {
    own.ligatures.dispose();
    own.ligatures = undefined;
  }
  own.fit.fit();
}

/** Re-reads the theme tokens into the terminal, after the theme setting changed. */
export function refreshTheme(term: Terminal): void {
  term.options.theme = terminalTheme(documentTokens());
}

/**
 * Opens a terminal in `container` connected to a new default shell of its own, started in `cwd` (home folder
 * when absent), styled by `settings()`, which the terminal asks again whenever the system switches light and
 * dark. While the terminal has focus the cursor has the chosen shape (the brick block by default) and blinks if
 * chosen; otherwise it is an outline. The shell runs on `backend`; `onSession` hears the id of each shell session
 * the terminal starts, the first and any after the shell exits. `zoom()` is the pane's zoom offset in pixels,
 * added to the font size whenever the terminal refits, and `onExit` is called when a shell exits. With `adopt`
 * the terminal starts no shell: it shows the adopted scrollback, then takes over that running session, whose output
 * kept during the move follows, and resizes it so full-screen programs redraw.
 */
export async function openTerminal(
  backend: Backend,
  container: HTMLElement,
  settings: () => Settings,
  cwd?: string,
  onSession: (id: number) => void = () => {},
  zoom: () => number = () => 0,
  onExit: () => void = () => {},
  adopt?: AdoptedSession,
): Promise<PaneTerminal> {
  // xterm measures the font when it opens, so the font has to be loaded first.
  await loadFont(settings().font);

  const term = new Terminal({
    cursorStyle: settings().cursor.style,
    cursorInactiveStyle: "outline",
    cursorBlink: settings().cursor.blink,
    // The ligatures addon uses xterm's proposed character joiner API.
    allowProposedApi: true,
    // xterm sizes its scrollbar by the overview ruler's width (14 px by default); the fit addon reserves the same.
    overviewRuler: { width: 8 },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  const serializer = new SerializeAddon();
  term.loadAddon(serializer);
  addons.set(term, { fit });
  term.open(container);
  const stopTheme = followSystemTheme(
    (theme) => {
      term.options.theme = theme;
    },
    () => settings().theme === "system",
  );
  await applyFont(term, settings(), zoom());

  let session: SessionId | undefined;
  let running = false;

  const reportError = (error: unknown) => {
    term.write(`\r\n${String(error)}\r\n`);
  };

  const spawn = async (dir?: string) => {
    session = await backend.spawn(term.rows, term.cols, dir, settings().prompt, (bytes) => term.write(bytes));
    running = true;
    onSession(session);
  };

  const unlistenExit = await backend.onExit((id) => {
    if (id !== session) return;
    running = false;
    onExit();
  });

  term.onData((data) => {
    if (running) backend.write(session as SessionId, data).catch(reportError);
  });

  // Re-fit once resizing settles, then tell the shell its size only if it changed. A font change resizes
  // the terminal without resizing its pane, so that schedules a report too.
  const reporter = sizeReporter(
    () => {
      applySize(term, settings(), zoom());
      fit.fit();
      return { rows: term.rows, cols: term.cols };
    },
    ({ rows, cols }) => {
      if (running) backend.resize(session as SessionId, rows, cols).catch(reportError);
    },
    RESIZE_SETTLE_MS,
  );
  let held = false;
  const schedule = () => {
    if (!held) reporter.schedule();
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(container);
  term.onResize(schedule);

  // Takes over a session moved here from another window. Shrinking it by a row and back sends the program two
  // size changes, so a full-screen one (vim, a coding agent) redraws itself for this terminal.
  const take = async ({ session: id, scrollback }: AdoptedSession) => {
    await written(term, scrollback);
    session = id;
    running = true;
    onSession(id);
    await backend.moves?.attach(id, (bytes) => term.write(bytes));
    if (term.rows > 1) await backend.resize(id, term.rows - 1, term.cols);
    await backend.resize(id, term.rows, term.cols);
  };

  if (adopt) await take(adopt).catch(reportError);
  else await spawn(cwd).catch(reportError);

  const free = () => {
    observer.disconnect();
    reporter.cancel();
    unlistenExit();
    stopTheme();
    running = false;
    term.dispose();
  };

  return {
    term,
    cwd: async () => {
      if (!running || session === undefined) return undefined;
      return backend.cwd(session);
    },
    holdSize: () => {
      held = true;
      reporter.cancel();
    },
    releaseSize: (refit) => {
      held = false;
      if (refit) reporter.schedule();
    },
    cellSize: () => {
      const screen = term.element?.querySelector(".xterm-screen")?.getBoundingClientRect();
      if (!screen || term.cols <= 0 || term.rows <= 0 || screen.width <= 0) return undefined;
      return { width: screen.width / term.cols, height: screen.height / term.rows };
    },
    serialize: async () => {
      await written(term);
      return serializer.serialize();
    },
    session: () => (running ? session : undefined),
    detach: () => {
      session = undefined;
      free();
    },
    dispose: async () => {
      const ended = session;
      session = undefined;
      free();
      if (ended !== undefined) await backend.close(ended);
    },
  };
}
