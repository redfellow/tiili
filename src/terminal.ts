import { FitAddon } from "@xterm/addon-fit";
import { LigaturesAddon } from "@xterm/addon-ligatures";
import { Terminal, type FontWeight } from "@xterm/xterm";
import type { Backend, SessionId } from "./backend";
import { sizeReporter } from "./resize";
import { fontFamilyList, type FontSettings, type Settings } from "./settings";
import { documentTokens, followSystemTheme, terminalTheme } from "./theme";

const EXIT_MESSAGE = "[process exited] Press Enter to start a new shell";
/** Resizing settles this long before a pane re-fits and tells its shell the new size. */
const RESIZE_SETTLE_MS = 50;

/** One pane's terminal and the shell session behind it. */
export interface PaneTerminal {
  term: Terminal;
  /** The working directory of the pane's shell, when it runs and the platform can read it. */
  cwd(): Promise<string | undefined>;
  /** Ends the shell and frees the terminal. */
  dispose(): Promise<void>;
}

/** The addons `applyFont` changes or refits with, per terminal. */
const addons = new WeakMap<Terminal, { fit: FitAddon; ligatures?: LigaturesAddon }>();

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
 * Applies the font settings to `term`: family with Geist Mono as fallback, size, weights, line height, letter
 * spacing and the ligatures addon on or off, then refits so the shell gets the new size.
 */
export async function applyFont(term: Terminal, settings: Settings): Promise<void> {
  const { font } = settings;
  const generation = (fontGenerations.get(term) ?? 0) + 1;
  fontGenerations.set(term, generation);
  await loadFont(font);
  // A newer call started while this font loaded; its settings win.
  if (fontGenerations.get(term) !== generation) return;
  term.options.fontFamily = fontFamilyList(font.family);
  term.options.fontSize = font.size;
  term.options.fontWeight = String(font.weight) as FontWeight;
  term.options.fontWeightBold = String(font.weightBold) as FontWeight;
  term.options.lineHeight = font.lineHeight;
  term.options.letterSpacing = font.letterSpacing;

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
 * dark. The cursor is a solid block while the terminal has focus and an outline otherwise. The shell runs on
 * `backend`.
 */
export async function openTerminal(
  backend: Backend,
  container: HTMLElement,
  settings: () => Settings,
  cwd?: string,
): Promise<PaneTerminal> {
  // xterm measures the font when it opens, so the font has to be loaded first.
  await loadFont(settings().font);

  const term = new Terminal({
    cursorStyle: "block",
    cursorInactiveStyle: "outline",
    cursorBlink: false,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  addons.set(term, { fit });
  term.open(container);
  const stopTheme = followSystemTheme(
    (theme) => {
      term.options.theme = theme;
    },
    () => settings().theme === "system",
  );
  await applyFont(term, settings());

  let session: SessionId | undefined;
  let running = false;

  const reportError = (error: unknown) => {
    term.write(`\r\n${String(error)}\r\n`);
  };

  const spawn = async (dir?: string) => {
    session = await backend.spawn(term.rows, term.cols, dir, (bytes) => term.write(bytes));
    running = true;
  };

  const unlistenExit = await backend.onExit((id) => {
    if (id !== session) return;
    running = false;
    term.write(`\r\n${EXIT_MESSAGE}\r\n`);
  });

  term.onData((data) => {
    if (running) {
      backend.write(session as SessionId, data).catch(reportError);
    } else if (data.includes("\r")) {
      const ended = session;
      session = undefined;
      const restart = ended === undefined ? Promise.resolve() : backend.close(ended);
      restart.then(() => spawn()).catch(reportError);
    }
  });

  // Re-fit once resizing settles, then tell the shell its size only if it changed. A font change resizes
  // the terminal without resizing its pane, so that schedules a report too.
  const reporter = sizeReporter(
    () => {
      fit.fit();
      return { rows: term.rows, cols: term.cols };
    },
    ({ rows, cols }) => {
      if (running) backend.resize(session as SessionId, rows, cols).catch(reportError);
    },
    RESIZE_SETTLE_MS,
  );
  const observer = new ResizeObserver(() => reporter.schedule());
  observer.observe(container);
  term.onResize(() => reporter.schedule());

  await spawn(cwd).catch(reportError);

  return {
    term,
    cwd: async () => {
      if (!running || session === undefined) return undefined;
      return backend.cwd(session);
    },
    dispose: async () => {
      observer.disconnect();
      unlistenExit();
      stopTheme();
      const ended = session;
      session = undefined;
      running = false;
      term.dispose();
      if (ended !== undefined) await backend.close(ended);
    },
  };
}
